
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, User as FirebaseAuthUser, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs, onSnapshot, Unsubscribe } from "firebase/firestore";
import type { User, Branch } from '@/lib/types';
import { auth, db } from '@/lib/firebase';


interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  branches: Branch[];
  currentBranch: Branch | null;
  setCurrentBranch: (branch: Branch) => void;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  signup: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string, isFirstUser?: boolean }>;
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
        const userDoc = await getDoc(userDocRef);
        
        let currentUser: User;
        if (userDoc.exists()) {
            currentUser = userDoc.data() as User;
            setUser(currentUser);
        } else {
             const newUser: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'Usuário Google',
                role: 'admin', 
                avatar: firebaseUser.photoURL || `/avatars/0${Math.ceil(Math.random() * 3)}.png`,
            }
            await setDoc(userDocRef, newUser);
            currentUser = newUser;
            setUser(currentUser);
        }

        // Listen for branches associated with the user
        const q = query(collection(db, "branches"), where("userIds", "array-contains", currentUser.id));
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

      const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
      const firebaseUser = userCredential.user;
      
      await updateProfile(firebaseUser, {
        displayName: name,
      });

      const newUser: User = {
        id: firebaseUser.uid,
        name,
        email,
        role: 'admin',
        avatar: `/avatars/0${Math.ceil(Math.random() * 3)}.png`,
      };

      await setDoc(doc(db, "users", firebaseUser.uid), newUser);
      
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

  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoading(true);
    loginCancelledRef.current = false;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        if (loginCancelledRef.current) {
            await signOut(auth);
            return false;
        }
        router.push('/dashboard');
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
        if (loginCancelledRef.current) {
            await signOut(auth);
            return false;
        }
        router.push('/dashboard');
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

  const isAuthenticated = !!user;
  
  useEffect(() => {
    if (typeof window === 'undefined') return;

    if (loading) return; 

    const isAuthPage = pathname.startsWith('/login') || pathname.startsWith('/signup');

    if (!isAuthenticated && !isAuthPage) {
        router.push('/login');
    }
     if (isAuthenticated && isAuthPage) {
        router.push('/dashboard');
    }
  }, [isAuthenticated, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, loginWithGoogle, logout, loading, signup, cancelLogin, branches, currentBranch, setCurrentBranch }}>
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
