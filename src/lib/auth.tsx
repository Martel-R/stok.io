

'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, User as FirebaseAuthUser, GoogleAuthProvider, signInWithPopup, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, Unsubscribe, updateDoc, writeBatch, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { User, Branch, Product, Organization, EnabledModules, BrandingSettings, PermissionProfile, Subscription } from '@/lib/types';
import { auth, db } from '@/lib/firebase';
import { MOCK_PRODUCTS } from '@/lib/mock-data';
import { addMonths } from 'date-fns';

const availableAvatars = [
    'https://placehold.co/100x100.png?text=🦊',
    'https://placehold.co/100x100.png?text=🦉',
    'https://placehold.co/100x100.png?text=🐻',
    'https://placehold.co/100x100.png?text=🦁',
    'https://placehold.co/100x100.png?text=🦄',
];
const getRandomAvatar = () => availableAvatars[Math.floor(Math.random() * availableAvatars.length)];

interface UserWithOrg extends User {
    organization?: Organization;
    isImpersonating?: boolean;
}

interface AuthContextType {
  isAuthenticated: boolean;
  user: UserWithOrg | null;
  organizations: Organization[];
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  signup: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string, isFirstUser?: boolean }>;
  createUser: (email: string, name: string, role: string, organizationId: string, customerId?: string) => Promise<{ success: boolean; error?: string, userId?: string }>;
  updateUserProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  changeUserPassword: (currentPass: string, newPass: string) => Promise<{ success: boolean, error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  deleteTestData: (organizationId: string) => Promise<void>;
  updateOrganizationModules: (modules: EnabledModules) => Promise<void>;
  updateOrganizationBranding: (branding: BrandingSettings) => Promise<void>;
  logout: () => void;
  loading: boolean;
  cancelLogin: () => void;
  startImpersonation: (orgId: string) => void;
  stopImpersonation: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

const defaultPermissions: EnabledModules = {
    dashboard: { view: true, edit: true, delete: true },
    products: { view: true, edit: true, delete: true },
    combos: { view: true, edit: true, delete: true },
    inventory: { view: true, edit: true, delete: true },
    pos: { view: true, edit: true, delete: true },
    assistant: { view: true, edit: true, delete: true },
    reports: { view: true, edit: true, delete: true },
    settings: { view: true, edit: true, delete: true },
    kits: { view: true, edit: true, delete: true },
    customers: { view: true, edit: true, delete: true },
    appointments: { view: true, edit: true, delete: true },
    services: { view: true, edit: true, delete: true },
};

const professionalPermissions: EnabledModules = {
    ...defaultPermissions,
    products: { view: false, edit: false, delete: false },
    combos: { view: false, edit: false, delete: false },
    inventory: { view: false, edit: false, delete: false },
    pos: { view: false, edit: false, delete: false },
    assistant: { view: false, edit: false, delete: false },
    reports: { view: false, edit: false, delete: false },
    settings: { view: false, edit: false, delete: false },
    kits: { view: false, edit: false, delete: false },
    customers: { view: true, edit: false, delete: false },
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<UserWithOrg | null>(null);
  const [organizations, setOrganizations] = React.useState<Organization[]>([]);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = React.useState<Branch | null>(null);
  const [loading, setLoading] = React.useState(true);
  const loginCancelledRef = React.useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    const unsubscribers: Unsubscribe[] = [];

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      // Clean up previous listeners
      unsubscribers.forEach(unsub => unsub());
      unsubscribers.length = 0;
      
      if (firebaseUser) {
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (userDocSnap.exists()) {
          const baseUser = { id: userDocSnap.id, ...userDocSnap.data() } as User;
          const isSuperAdmin = baseUser.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
          const impersonatedOrgId = localStorage.getItem('impersonatedOrgId');
          const isImpersonating = isSuperAdmin && !!impersonatedOrgId;

          const effectiveOrgId = isImpersonating ? impersonatedOrgId : baseUser.organizationId;
          
          let userData: UserWithOrg = { ...baseUser, isImpersonating };

          if (isSuperAdmin && !isImpersonating) {
            // Super admin not impersonating: Fetch all orgs, set full permissions
            const allOrgsQuery = collection(db, 'organizations');
            const unsub = onSnapshot(allOrgsQuery, (snapshot) => {
              const orgs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Organization));
              setOrganizations(orgs);
              // Set a default org context to avoid errors, but don't limit branches
              setUser({ ...userData, organization: orgs[0], enabledModules: defaultPermissions });
              setBranches([]); // No specific branches when not impersonating
              setCurrentBranchState(null);
              setLoading(false);
            });
            unsubscribers.push(unsub);
          } else if (effectiveOrgId) {
            // Regular user or impersonating super admin
            const orgDocRef = doc(db, 'organizations', effectiveOrgId);
            const unsubOrg = onSnapshot(orgDocRef, async (orgDoc) => {
              if (!orgDoc.exists()) {
                setUser(null); setLoading(false); return;
              }
              const orgData = { id: orgDoc.id, ...orgDoc.data() } as Organization;
              
              // Get permission profiles for the organization
              const profilesQuery = query(collection(db, 'permissionProfiles'), where('organizationId', '==', effectiveOrgId));
              const profilesSnap = await getDocs(profilesQuery);
              const profiles = profilesSnap.docs.map(p => ({ id: p.id, ...p.data() } as PermissionProfile));
              const userProfile = profiles.find(p => p.id === baseUser.role);
              
              const orgModules = orgData.enabledModules || {};
              let finalPermissions: Partial<EnabledModules> = {};

              if (isImpersonating) {
                finalPermissions = { ...defaultPermissions, ...orgModules };
              } else if (userProfile?.permissions) {
                Object.keys(orgModules).forEach(key => {
                  const moduleKey = key as keyof EnabledModules;
                  if (orgModules[moduleKey]) {
                    finalPermissions[moduleKey] = userProfile.permissions[moduleKey] || { view: false, edit: false, delete: false };
                  }
                });
              }

              userData = { ...userData, organization: orgData, enabledModules: finalPermissions as EnabledModules, paymentStatus: orgData.paymentStatus };
              setUser(userData);
              
              // Fetch branches for the organization
              const branchesQuery = query(collection(db, 'branches'), where('organizationId', '==', effectiveOrgId));
              const unsubBranches = onSnapshot(branchesQuery, (branchSnap) => {
                const orgBranches = branchSnap.docs.map(b => ({ id: b.id, ...b.data() } as Branch));
                const userBranches = isImpersonating ? orgBranches : orgBranches.filter(b => b.userIds.includes(baseUser.id));
                
                setBranches(userBranches);
                
                const storedBranchId = localStorage.getItem('currentBranchId');
                const storedBranch = userBranches.find(b => b.id === storedBranchId);

                if (storedBranch) {
                  setCurrentBranchState(storedBranch);
                } else if (userBranches.length > 0) {
                  setCurrentBranchState(userBranches[0]);
                  localStorage.setItem('currentBranchId', userBranches[0].id);
                } else {
                  setCurrentBranchState(null);
                }
                setLoading(false);
              });
              unsubscribers.push(unsubBranches);
            });
            unsubscribers.push(unsubOrg);
          } else {
             // User exists but has no org ID (edge case)
            setUser(null); setLoading(false);
          }
        } else {
          // User document doesn't exist in Firestore (should not happen in normal flow)
          setUser(null); setLoading(false);
        }
      } else {
        // No Firebase user
        setUser(null);
        setOrganizations([]);
        setBranches([]);
        setCurrentBranchState(null);
        setLoading(false);
      }
    });
    unsubscribers.push(authUnsubscribe);

    return () => unsubscribers.forEach(unsub => unsub());
  }, []);
  
  const signup = async (email: string, pass: string, name: string): Promise<{ success: boolean; error?: string, isFirstUser?: boolean }> => {
    setLoading(true);
    try {
      const usersSnapshot = await getDocs(collection(db, "users"));
      const isFirstUser = usersSnapshot.empty;
      
      const organizationId = doc(collection(db, 'organizations')).id;

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      const avatar = getRandomAvatar();
      await updateProfile(firebaseUser, {
        displayName: name,
        photoURL: avatar
      });

      const batch = writeBatch(db);

      const adminProfileRef = doc(collection(db, 'permissionProfiles'));
      const professionalProfileRef = doc(collection(db, 'permissionProfiles'));

      const newUser: User = {
        id: firebaseUser.uid,
        name,
        email,
        role: adminProfileRef.id,
        avatar: avatar,
        organizationId: organizationId
      };

      batch.set(doc(db, "users", firebaseUser.uid), newUser);
      
      const newSubscription: Subscription = {
          planName: 'Plano Pro',
          price: 99.90,
          startDate: Timestamp.now(),
          endDate: Timestamp.fromDate(addMonths(new Date(), 12)),
          paymentRecords: [],
      };
      
      batch.set(doc(db, "organizations", organizationId), { 
        ownerId: newUser.id, 
        name: name,
        paymentStatus: 'active',
        enabledModules: defaultPermissions,
        subscription: newSubscription
      });
      
      const adminProfile: Omit<PermissionProfile, 'id'> = {
          name: 'Admin',
          organizationId: organizationId,
          permissions: defaultPermissions
      };
      batch.set(adminProfileRef, adminProfile);

      const professionalProfile: Omit<PermissionProfile, 'id'> = {
          name: 'Profissional',
          organizationId: organizationId,
          permissions: professionalPermissions
      };
      batch.set(professionalProfileRef, professionalProfile);


      await batch.commit();
      
      return { success: true, isFirstUser };
    } catch (error: any) {
      console.error("Firebase Signup Error:", error);
      let errorMessage = "Ocorreu um erro desconhecido.";
      if (error.code === 'auth/email-already-in-use') {
        errorMessage = 'Este e-mail já está em uso.';
      } else if (error.code === 'auth/weak-password') {
        errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
      }
      return { success: false, error: errorMessage };
    } finally {
      // setLoading will be set to false by onAuthStateChanged listener
    }
  };

  const createUser = async (email: string, name: string, role: string, organizationId: string, customerId?: string): Promise<{ success: boolean; error?: string; userId?: string; }> => {
    try {
        const { getApp, initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth: getAuth_local, createUserWithEmailAndPassword: createUserWithEmailAndPassword_local, sendPasswordResetEmail: sendPasswordResetEmail_local, signOut: signOut_local } = await import('firebase/auth');

        const tempAppName = `temp-auth-app-${'\'\'\''}${Date.now()}${'\'\'\''}`;
        const tempAppConfig = { ...getApp().options, appName: tempAppName };
        const tempApp = initializeApp(tempAppConfig, tempAppName);
        const tempAuthInstance = getAuth_local(tempApp);

        const userCredential = await createUserWithEmailAndPassword_local(tempAuthInstance, email, Math.random().toString(36).slice(-10));
        const firebaseUser = userCredential.user;

        const newUser: User = {
            id: firebaseUser.uid,
            name,
            email,
            role,
            avatar: getRandomAvatar(),
            organizationId: organizationId,
            ...(customerId && { customerId: customerId }),
        };
        
        await setDoc(doc(db, "users", firebaseUser.uid), newUser);

        await sendPasswordResetEmail_local(tempAuthInstance, email);

        await signOut_local(tempAuthInstance);
        await deleteApp(tempApp);

        return { success: true, userId: firebaseUser.uid };
    } catch (error: any) {
        console.error("Admin Create User Error:", error);
        let errorMessage = "Ocorreu um erro desconhecido.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este e-mail já está em uso.';
        }
        return { success: false, error: errorMessage };
    }
  }


  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoading(true);
    loginCancelledRef.current = false;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        return true;
    } catch (error) {
        console.error("Firebase Login Error:", error);
        if (loginCancelledRef.current) {
            return false;
        }
        setLoading(false);
        return false;
    }
  };

  const loginWithGoogle = async (): Promise<boolean> => {
    setLoading(true);
    loginCancelledRef.current = false;
    try {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(auth, provider);
        return true;
    } catch (error) {
        console.error("Google Login Error:", error);
        if (loginCancelledRef.current) {
            return false;
        }
        setLoading(false);
        return false;
    }
  }

  const cancelLogin = () => {
      loginCancelledRef.current = true;
      setLoading(false);
  }

  const logout = async () => {
    setLoading(true);
    try {
        await signOut(auth);
        setUser(null);
        localStorage.removeItem('currentBranchId');
        localStorage.removeItem('impersonatedOrgId');
        router.push('/login');
    } catch (error) {
        console.error("Firebase Logout Error:", error);
    } finally {
        setLoading(false);
    }
  };

  const startImpersonation = (orgId: string) => {
    localStorage.setItem('impersonatedOrgId', orgId);
    router.push('/dashboard');
    window.location.reload(); // Force a full reload to re-trigger the auth provider
  };
  
  const stopImpersonation = () => {
    localStorage.removeItem('impersonatedOrgId');
    localStorage.removeItem('currentBranchId');
    router.push('/super-admin');
    window.location.reload();
  };

  const setCurrentBranch = (branch: Branch) => {
    localStorage.setItem('currentBranchId', branch.id);
    setCurrentBranchState(branch);
  }

  const updateUserProfile = async (data: Partial<User>) => {
    if (!auth.currentUser || !user) {
        return { success: false, error: 'Usuário não autenticado.'};
    }
    try {
        await updateProfile(auth.currentUser, {
            displayName: data.name,
            photoURL: data.avatar,
        });

        const userRef = doc(db, 'users', user.id);
        const updateData = { ...data };
        delete updateData.paymentStatus;
        await updateDoc(userRef, updateData);
        
        setUser(prev => prev ? { ...prev, ...data } : null);
        
        return { success: true };
    } catch (error: any) {
        console.error('Error updating profile:', error);
        return { success: false, error: 'Falha ao atualizar o perfil.' };
    }
  }

  const changeUserPassword = async (currentPass: string, newPass: string) => {
    if (!auth.currentUser || !auth.currentUser.email) {
        return { success: false, error: 'Usuário não autenticado.' };
    }
    
    const cred = EmailAuthProvider.credential(auth.currentUser.email, currentPass);
    
    try {
        await reauthenticateWithCredential(auth.currentUser, cred);
        await updatePassword(auth.currentUser, newPass);
        return { success: true };
    } catch (error: any) {
        console.error('Error changing password:', error);
        let message = 'Falha ao alterar a senha.';
        if (error.code === 'auth/wrong-password') {
            message = 'A senha atual está incorreta.';
        }
        return { success: false, error: message };
    }
  };

  const sendPasswordReset = async (email: string) => {
    setLoading(true);
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error: any) {
      console.error("Password Reset Error:", error);
      let message = "Ocorreu um erro.";
      if (error.code === 'auth/user-not-found') {
          message = "Nenhum usuário encontrado com este e-mail.";
      }
      return { success: false, error: message };
    } finally {
        setLoading(false);
    }
  };

  const deleteTestData = async (organizationId: string) => {
    const collectionsToDelete = ['products', 'combos', 'sales', 'stockEntries', 'kits'];
    const batch = writeBatch(db);

    for (const collectionName of collectionsToDelete) {
        const q = query(collection(db, collectionName), where("organizationId", "==", organizationId));
        const snapshot = await getDocs(q);
        snapshot.forEach(doc => {
            batch.delete(doc.ref);
        });
    }

    await batch.commit();
  };

  const updateOrganizationModules = async (modules: EnabledModules) => {
    if (!user?.organizationId) {
        throw new Error("Organização não encontrada.");
    }
    const orgRef = doc(db, 'organizations', user.organizationId);
    await updateDoc(orgRef, { enabledModules: modules });
  };
  
  const updateOrganizationBranding = async (branding: BrandingSettings) => {
    if (!user?.organizationId) {
        throw new Error("Organização não encontrada.");
    }
    const orgRef = doc(db, 'organizations', user.organizationId);
    await updateDoc(orgRef, { branding: branding });
  };

  const isAuthenticated = !!user;
  
  React.useEffect(() => {
    if (typeof window === 'undefined' || loading) return;

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot-password');
    const isDashboardPage = pathname.startsWith('/dashboard');
    const isPortalPage = pathname.startsWith('/portal');

    if (!isAuthenticated) {
      if (isDashboardPage || isPortalPage) {
        router.push('/login');
      }
      return;
    }

    // User is authenticated
    const isSuperAdmin = user.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;

    if (isAuthPage) {
      if (isSuperAdmin && !user.isImpersonating) {
        router.push('/super-admin');
      } else if (user.role === 'customer') {
        router.push('/portal');
      } else {
        router.push('/dashboard');
      }
    } else if (user.role === 'customer' && isDashboardPage) {
      router.push('/portal');
    } else if (user.role !== 'customer' && isPortalPage) {
      router.push('/dashboard');
    } else if (isSuperAdmin && !user.isImpersonating && isDashboardPage) {
      router.push('/super-admin');
    }
  }, [isAuthenticated, loading, pathname, router, user]);


  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, loginWithGoogle, logout, loading, signup, createUser, cancelLogin, branches, currentBranch, setCurrentBranch, updateUserProfile, changeUserPassword, sendPasswordReset, deleteTestData, updateOrganizationModules, updateOrganizationBranding, startImpersonation, stopImpersonation, organizations }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = React.useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};




    