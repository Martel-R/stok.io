

'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, User as FirebaseAuthUser, GoogleAuthProvider, signInWithPopup, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, Unsubscribe, updateDoc, writeBatch, deleteDoc, serverTimestamp, Timestamp } from "firebase/firestore";
import type { User, Branch, Product, Organization, EnabledModules, BrandingSettings, PermissionProfile, Subscription } from '@/lib/types';
import { auth, db } from '@/lib/firebase';
import { addMonths } from 'date-fns';
import { logUserActivity } from './logging';

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
    expenses: { view: true, edit: true, delete: true },
    backup: { view: true, edit: true, delete: true },
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
    appointments: { view: true, edit: false, delete: false },
    services: { view: true, edit: false, delete: false },
    expenses: { view: true, edit: false, delete: false },
    backup: { view: true, edit: false, delete: false },
};

const runDataIntegrityCheck = async (organizationId: string) => {
    if (sessionStorage.getItem(`integrityCheck_${organizationId}`)) {
      return;
    }
  
    console.log("Running data integrity check for organization:", organizationId);
  
    const collectionsToFix = [
      'products', 'combos', 'kits', 'services', 'customers',
      'anamnesisQuestions', 'suppliers', 'branches', 'expenses', 'appointments', 'permissionProfiles'
    ];
  
    try {
      const batch = writeBatch(db);
      let updatesMade = 0;
  
      for (const collectionName of collectionsToFix) {
        const q = query(collection(db, collectionName), where("organizationId", "==", organizationId));
        const snapshot = await getDocs(q);
        
        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.isDeleted === undefined || data.isDeleted === null) {
            batch.update(doc.ref, { isDeleted: false });
            updatesMade++;
          }
        });
      }
  
      if (updatesMade > 0) {
        await batch.commit();
        console.log(`Data integrity check complete. Updated ${updatesMade} records.`);
      } else {
        console.log("Data integrity check complete. No records needed updating.");
      }
      
      sessionStorage.setItem(`integrityCheck_${organizationId}`, 'true');
  
    } catch (error) {
      console.error("Error during data integrity check:", error);
    }
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
    let unsubscribers: Unsubscribe[] = [];

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribers.forEach(unsub => unsub());
      unsubscribers = [];
      setLoading(true);

      if (firebaseUser) {
        const userDocSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
        if (!userDocSnap.exists()) {
          setUser(null); setLoading(false); return;
        }

        const baseUser = { id: userDocSnap.id, ...userDocSnap.data() } as User;
        const isSuperAdmin = baseUser.email === process.env.NEXT_PUBLIC_SUPER_ADMIN_EMAIL;
        const impersonatedOrgId = localStorage.getItem('impersonatedOrgId');
        const isImpersonating = isSuperAdmin && !!impersonatedOrgId;

        const effectiveOrgId = isImpersonating ? impersonatedOrgId : baseUser.organizationId;
        
        let userData: UserWithOrg = { ...baseUser, isImpersonating };

        if (isSuperAdmin && !isImpersonating) {
            const unsub = onSnapshot(collection(db, 'organizations'), (snapshot) => {
                setOrganizations(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Organization)));
                setUser({ ...userData, enabledModules: defaultPermissions });
                setBranches([]);
                setCurrentBranchState(null);
                setLoading(false);
            });
            unsubscribers.push(unsub);
            return;
        }

        if (effectiveOrgId) {
            await runDataIntegrityCheck(effectiveOrgId);

            const orgDoc = await getDoc(doc(db, 'organizations', effectiveOrgId));
            if (!orgDoc.exists()) {
                setUser(null); setLoading(false); return;
            }
            
            const orgData = { id: orgDoc.id, ...orgDoc.data() } as Organization;
            const profilesSnap = await getDocs(query(collection(db, 'permissionProfiles'), where('organizationId', '==', effectiveOrgId)));
            const profiles = profilesSnap.docs.map(p => ({ id: p.id, ...p.data() } as PermissionProfile));
            
            const orgModules = orgData.enabledModules || {};
            let finalPermissions: Partial<EnabledModules> = {};

            if (isImpersonating || baseUser.role === 'admin') {
                Object.keys(orgModules).forEach(key => {
                    const moduleKey = key as keyof EnabledModules;
                    if (orgModules[moduleKey]) {
                        finalPermissions[moduleKey] = { view: true, edit: true, delete: true };
                    }
                });
            } else {
                const userProfile = profiles.find(p => p.id === baseUser.role);
                if (userProfile?.permissions) {
                    Object.keys(orgModules).forEach(key => {
                        const moduleKey = key as keyof EnabledModules;
                        if (orgModules[moduleKey]) {
                            finalPermissions[moduleKey] = userProfile.permissions[moduleKey] || { view: false, edit: false, delete: false };
                        }
                    });
                }
            }
            
            userData = { ...userData, organization: orgData, enabledModules: finalPermissions as EnabledModules, paymentStatus: orgData.paymentStatus };
            setUser(userData);

            const branchesQuery = query(collection(db, 'branches'), where('organizationId', '==', effectiveOrgId));
            const unsubBranches = onSnapshot(branchesQuery, (branchSnap) => {
                const allOrgBranches = branchSnap.docs.map(b => ({ id: b.id, ...b.data() } as Branch));
                const activeBranches = allOrgBranches.filter(b => !b.isDeleted);
                const userBranches = isImpersonating || baseUser.role === 'admin' ? activeBranches : activeBranches.filter(b => b.userIds.includes(baseUser.id));
                
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
                    localStorage.removeItem('currentBranchId');
                }
                setLoading(false);
            });
            unsubscribers.push(unsubBranches);
        } else {
            setUser(null); setLoading(false);
        }
      } else {
        setUser(null); setOrganizations([]); setBranches([]); setCurrentBranchState(null); setLoading(false);
      }
    });

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
        role: 'admin',
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
          permissions: defaultPermissions,
          isDeleted: false,
      };
      batch.set(adminProfileRef, adminProfile);

      const professionalProfile: Omit<PermissionProfile, 'id'> = {
          name: 'Profissional',
          organizationId: organizationId,
          permissions: professionalPermissions,
          isDeleted: false,
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

        const tempAppName = `temp-auth-app-${Date.now()}-${Math.random()}`;
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
        const userCredential = await signInWithEmailAndPassword(auth, email, pass);
        const loggedInUser = await getDoc(doc(db, 'users', userCredential.user.uid));
        if (loggedInUser.exists()) {
             logUserActivity({
                userId: loggedInUser.id,
                userName: loggedInUser.data().name,
                organizationId: loggedInUser.data().organizationId,
                action: 'login_success'
            });
        }
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
        const result = await signInWithPopup(auth, provider);
        const userDocRef = doc(db, 'users', result.user.uid);
        const userDocSnap = await getDoc(userDocRef);

        if (!userDocSnap.exists()) {
            // This is a new Google user, need to create a profile
            const organizationId = doc(collection(db, 'organizations')).id;
            const newUser: User = {
                id: result.user.uid,
                name: result.user.displayName || 'Usuário Google',
                email: result.user.email!,
                role: 'admin',
                avatar: result.user.photoURL || getRandomAvatar(),
                organizationId: organizationId,
            };
            
            const batch = writeBatch(db);
            batch.set(userDocRef, newUser);
            batch.set(doc(db, 'organizations', organizationId), {
                ownerId: newUser.id,
                name: `${newUser.name}'s Organization`,
                paymentStatus: 'active',
                enabledModules: defaultPermissions,
            });
            await batch.commit();
        }

        const loggedInUser = (await getDoc(userDocRef)).data() as User;
         logUserActivity({
            userId: loggedInUser.id,
            userName: loggedInUser.name,
            organizationId: loggedInUser.organizationId,
            action: 'login_success_google'
        });

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
        if(user) {
            logUserActivity({
                userId: user.id,
                userName: user.name,
                organizationId: user.organizationId,
                action: 'logout',
            });
        }
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
  };

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
    const isSuperAdminPage = pathname.startsWith('/super-admin');

    if (!isAuthenticated) {
      if (isDashboardPage || isPortalPage || isSuperAdminPage) {
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
    } else if (!isSuperAdmin && isSuperAdminPage) {
      router.push('/dashboard');
    }
  }, [isAuthenticated, loading, pathname, router, user]);


  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, loginWithGoogle, logout, loading, signup, createUser, cancelLogin, branches, currentBranch, setCurrentBranch, updateUserProfile, changeUserPassword, sendPasswordReset, updateOrganizationModules, updateOrganizationBranding, startImpersonation, stopImpersonation, organizations }}>
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

