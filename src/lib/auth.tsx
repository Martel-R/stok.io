
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, User as FirebaseAuthUser, GoogleAuthProvider, signInWithPopup, EmailAuthProvider, reauthenticateWithCredential, updatePassword } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, Unsubscribe, updateDoc, writeBatch } from "firebase/firestore";
import type { User, UserRole, Branch } from '@/lib/types';
import { auth, db } from '@/lib/firebase';
import { MOCK_PRODUCTS } from '@/lib/mock-data';


interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  signup: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string, isFirstUser?: boolean }>;
  createUser: (email: string, pass: string, name: string, role: UserRole, organizationId: string) => Promise<{ success: boolean; error?: string }>;
  updateUserProfile: (data: Partial<User>) => Promise<{ success: boolean; error?: string }>;
  changeUserPassword: (currentPass: string, newPass: string) => Promise<{ success: boolean, error?: string }>;
  logout: () => void;
  loading: boolean;
  cancelLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [currentBranch, setCurrentBranchState] = useState<Branch | null>(null);
  const [loading, setLoading] = useState(true);
  const loginCancelledRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let branchesUnsubscribe: Unsubscribe | null = null;

    const authUnsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthUser | null) => {
      if (branchesUnsubscribe) branchesUnsubscribe(); // Unsubscribe from previous user's branches listener

      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDocSnap = await getDoc(userDocRef);
        
        let currentUser: User;
        if (userDocSnap.exists()) {
            currentUser = userDocSnap.data() as User;
            // Sync Firebase Auth profile with Firestore on load, in case it was changed elsewhere
            if (currentUser.name !== firebaseUser.displayName || currentUser.avatar !== firebaseUser.photoURL) {
                currentUser.name = firebaseUser.displayName || currentUser.name;
                currentUser.avatar = firebaseUser.photoURL || currentUser.avatar;
            }
            setUser(currentUser);
        } else {
             // This case is mainly for Google Sign-in for a new user
             const usersSnapshot = await getDocs(collection(db, "users"));
             const isFirstUser = usersSnapshot.empty;
             const organizationId = isFirstUser ? doc(collection(db, 'organizations')).id : ''; // This needs a proper way to get orgId
             
             const newUser: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'Usuário Google',
                role: 'admin', 
                avatar: firebaseUser.photoURL || `/avatars/0${Math.ceil(Math.random() * 3)}.png`,
                organizationId: organizationId, // Will be empty if not first user, needs handling
            }
            await setDoc(userDocRef, newUser);
            // This case needs a flow to either create a new org or join an existing one.
            // For now, first Google user creates an org.
            if(isFirstUser) {
                 await setDoc(doc(db, "organizations", organizationId), { ownerId: newUser.id, name: `${newUser.name}'s Organization` });
            }
            currentUser = newUser;
            setUser(currentUser);
        }

        // Listen for branches associated with the user's organization
        if (currentUser.organizationId) {
            const q = query(collection(db, "branches"), where("organizationId", "==", currentUser.organizationId), where("userIds", "array-contains", currentUser.id));
            branchesUnsubscribe = onSnapshot(q, (snapshot) => {
                const userBranches = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Branch));
                setBranches(userBranches);

                // Set current branch logic
                const storedBranchId = localStorage.getItem('currentBranchId');
                const storedBranch = userBranches.find(b => b.id === storedBranchId);
                if (storedBranch) {
                    setCurrentBranchState(storedBranch);
                } else if (userBranches.length > 0) {
                    setCurrentBranchState(userBranches[0]);
                } else {
                    setCurrentBranchState(null);
                }
                setLoading(false);
            });
        } else {
            setBranches([]);
            setCurrentBranchState(null);
            setLoading(false);
        }
      } else {
        setUser(null);
        setBranches([]);
        setCurrentBranchState(null);
        setLoading(false);
      }
    });

    return () => {
      authUnsubscribe();
      if (branchesUnsubscribe) branchesUnsubscribe();
    };
  }, []);
  
  const signup = async (email: string, pass: string, name: string): Promise<{ success: boolean; error?: string, isFirstUser?: boolean }> => {
    setLoading(true);
    try {
      // Check if any user exists to determine if this is the first one
      const usersSnapshot = await getDocs(collection(db, "users"));
      const isFirstUser = usersSnapshot.empty;
      
      const organizationId = doc(collection(db, 'organizations')).id;

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      const avatar = `/avatars/0${Math.ceil(Math.random() * 3)}.png`;
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
      
      // Create user doc
      batch.set(doc(db, "users", firebaseUser.uid), newUser);
      
      // Create organization doc
      batch.set(doc(db, "organizations", organizationId), { ownerId: newUser.id, name: `${name}'s Company` });

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

  const createUser = async (email: string, pass: string, name: string, role: UserRole, organizationId: string): Promise<{ success: boolean; error?: string }> => {
    try {
        // This is a temporary auth instance trick to avoid logging out the admin.
        // NOT recommended for production. A backend function is the proper way.
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
            avatar: `/avatars/0${Math.ceil(Math.random() * 3)}.png`,
            organizationId: organizationId,
        };
        
        await setDoc(doc(db, "users", firebaseUser.uid), newUser);

        await signOut(tempAuthInstance);
        await deleteApp(tempApp);

        return { success: true };
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
        // The onAuthStateChanged listener will handle the redirect.
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
        // The onAuthStateChanged listener will handle the redirect.
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
        // Update Firebase Auth profile
        await updateProfile(auth.currentUser, {
            displayName: data.name,
            photoURL: data.avatar,
        });

        // Update Firestore user document
        const userRef = doc(db, 'users', user.id);
        await updateDoc(userRef, data);
        
        // Update local user state
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
        // Reauthenticate before changing password for security
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


  const isAuthenticated = !!user;
  
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (loading) return; 

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');
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
            // If a cashier tries to access any other dashboard page, redirect them to POS
            router.push('/dashboard/pos');
        }
    }
  }, [isAuthenticated, loading, pathname, router, user]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, loginWithGoogle, logout, loading, signup, createUser, cancelLogin, branches, currentBranch, setCurrentBranch, updateUserProfile, changeUserPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
