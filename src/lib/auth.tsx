

'use client';

import React from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, User as FirebaseAuthUser, GoogleAuthProvider, signInWithPopup, EmailAuthProvider, reauthenticateWithCredential, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, Unsubscribe, updateDoc, writeBatch, deleteDoc } from "firebase/firestore";
import type { User, UserRole, Branch, Product, Organization, EnabledModules } from '@/lib/types';
import { auth, db } from '@/lib/firebase';
import { MOCK_PRODUCTS } from '@/lib/mock-data';

const availableAvatars = [
    'https://placehold.co/100x100.png?text=🦊',
    'https://placehold.co/100x100.png?text=🦉',
    'https://placehold.co/100x100.png?text=🐻',
    'https://placehold.co/100x100.png?text=🦁',
    'https://placehold.co/100x100.png?text=🦄',
];
const getRandomAvatar = () => availableAvatars[Math.floor(Math.random() * availableAvatars.length)];


interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  signup: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string, isFirstUser?: boolean }>;
  createUser: (email: string, pass: string, name: string, role: UserRole, organizationId: string, customerId?: string) => Promise<{ success: boolean; error?: string, userId?: string }>;
  updateUserProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  changeUserPassword: (currentPass: string, newPass: string) => Promise<{ success: boolean, error?: string }>;
  sendPasswordReset: (email: string) => Promise<{ success: boolean; error?: string }>;
  deleteTestData: (organizationId: string) => Promise<void>;
  updateOrganizationModules: (modules: EnabledModules) => Promise<void>;
  logout: () => void;
  loading: boolean;
  cancelLogin: () => void;
}

const AuthContext = React.createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<User | null>(null);
  const [branches, setBranches] = React.useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = React.useState<Branch | null>(null);
  const [loading, setLoading] = React.useState(true);
  const loginCancelledRef = React.useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    let branchesUnsubscribe: Unsubscribe | null = null;
    let orgUnsubscribe: Unsubscribe | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthUser | null) => {
      setLoading(true);
      if (branchesUnsubscribe) branchesUnsubscribe();
      if (orgUnsubscribe) orgUnsubscribe();

      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let currentUser: User;
        if (userDocSnap.exists()) {
            currentUser = userDocSnap.data() as User;
            setUser(currentUser);
        } else {
             const usersSnapshot = await getDocs(collection(db, "users"));
             const isFirstUser = usersSnapshot.empty;
             const organizationId = isFirstUser ? doc(collection(db, 'organizations')).id : '';
             
             const newUser: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'Usuário Google',
                role: 'admin', 
                avatar: firebaseUser.photoURL || getRandomAvatar(),
                organizationId: organizationId,
            }
            await setDoc(userDocRef, newUser);
            if(isFirstUser) {
                 await setDoc(doc(db, "organizations", organizationId), { ownerId: newUser.id, name: `${newUser.name}'s Organization`, paymentStatus: 'active' });
            }
            currentUser = newUser;
            setUser(currentUser);
        }

        if (currentUser.organizationId) {
            const orgDocRef = doc(db, "organizations", currentUser.organizationId);
            orgUnsubscribe = onSnapshot(orgDocRef, async (orgDoc) => {
                if (orgDoc.exists()) {
                    const orgData = orgDoc.data() as Organization;
                    let modules = orgData.enabledModules;
                    
                    if (!modules) {
                        modules = {
                            dashboard: true,
                            products: true,
                            combos: true,
                            inventory: true,
                            pos: true,
                            assistant: true,
                            reports: true,
                            settings: true,
                            kits: true,
                            customers: true,
                            appointments: true,
                            services: true,
                        };
                        await updateDoc(orgDocRef, { enabledModules: modules });
                    }

                    setUser(prevUser => prevUser ? { ...prevUser, paymentStatus: orgData.paymentStatus, enabledModules: modules } : null);
                }
            });

            const q = query(collection(db, "branches"), where("organizationId", "==", currentUser.organizationId));
            branchesUnsubscribe = onSnapshot(q, (snapshot) => {
                const userBranches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
                const userFilteredBranches = userBranches.filter(b => b.userIds.includes(currentUser.id));
                setBranches(userFilteredBranches);

                const storedBranchId = localStorage.getItem('currentBranchId');
                const storedBranch = userFilteredBranches.find(b => b.id === storedBranchId);
                if (storedBranch) {
                    setCurrentBranchState(storedBranch);
                } else if (userFilteredBranches.length > 0) {
                    setCurrentBranchState(userFilteredBranches[0]);
                } else {
                    setCurrentBranchState(null);
                }
            });
        } else {
            setBranches([]);
            setCurrentBranchState(null);
        }
      } else {
        setUser(null);
        setBranches([]);
        setCurrentBranchState(null);
      }
      setLoading(false);
    });

    return () => {
      authUnsubscribe();
      if (branchesUnsubscribe) branchesUnsubscribe();
      if (orgUnsubscribe) orgUnsubscribe();
    };
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

      const newUser: User = {
        id: firebaseUser.uid,
        name,
        email,
        role: 'admin',
        avatar: avatar,
        organizationId: organizationId
      };

      const batch = writeBatch(db);
      
      batch.set(doc(db, "users", firebaseUser.uid), newUser);
      
      batch.set(doc(db, "organizations", organizationId), { 
        ownerId: newUser.id, 
        name: `${name}'s Company`,
        paymentStatus: 'active',
        enabledModules: {
            dashboard: true,
            products: true,
            combos: true,
            inventory: true,
            pos: true,
            assistant: true,
            reports: true,
            settings: true,
            kits: true,
            customers: true,
            appointments: true,
            services: true,
        }
      });

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

  const createUser = async (email: string, pass: string, name: string, role: UserRole, organizationId: string, customerId?: string): Promise<{ success: boolean; error?: string; userId?: string; }> => {
    try {
        const { getApp, initializeApp, deleteApp } = await import('firebase/app');
        const { getAuth: getAuth_local } = await import('firebase/auth');

        const tempAppName = `temp-auth-app-${Date.now()}`;
        const tempAppConfig = { ...getApp().options, appName: tempAppName };
        const tempApp = initializeApp(tempAppConfig, tempAppName);
        const tempAuthInstance = getAuth_local(tempApp);

        const userCredential = await createUserWithEmailAndPassword(tempAuthInstance, email, pass);
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

        await signOut(tempAuthInstance);
        await deleteApp(tempApp);

        return { success: true, userId: firebaseUser.uid };
    } catch (error: any) {
        console.error("Admin Create User Error:", error);
        let errorMessage = "Ocorreu um erro desconhecido.";
        if (error.code === 'auth/email-already-in-use') {
            errorMessage = 'Este e-mail já está em uso.';
        } else if (error.code === 'auth/weak-password') {
            errorMessage = 'A senha deve ter pelo menos 6 caracteres.';
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
        router.push('/login');
    } catch (error) {
        console.error("Firebase Logout Error:", error);
    } finally {
        setLoading(false);
    }
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
        delete updateData.paymentStatus; // Do not allow user to update their own payment status
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

  const isAuthenticated = !!user;
  
  React.useEffect(() => {
    if (typeof window === 'undefined') return;

    if (loading) return; 

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup') || pathname.startsWith('/forgot-password');
    const isDashboardPage = pathname.startsWith('/dashboard');

    if (!isAuthenticated && isDashboardPage) {
        router.push('/login');
        return;
    }

     if (isAuthenticated) {
        if(isAuthPage) {
            if (user.role === 'cashier') {
                router.push('/dashboard/pos');
            } else {
                router.push('/dashboard');
            }
        } else if (user.role === 'cashier' && pathname !== '/dashboard/pos' && pathname !== '/dashboard/profile') {
            router.push('/dashboard/pos');
        }
    }
  }, [isAuthenticated, loading, pathname, router, user]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, loginWithGoogle, logout, loading, signup, createUser, cancelLogin, branches, currentBranch, setCurrentBranch, updateUserProfile, changeUserPassword, sendPasswordReset, deleteTestData, updateOrganizationModules }}>
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
