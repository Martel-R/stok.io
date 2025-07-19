
'use client';

import { createContext, useContext, useState, useEffect, ReactNode, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, User as FirebaseAuthUser, GoogleAuthProvider, signInWithPopup } from 'firebase/auth';
import { doc, getDoc, setDoc } from "firebase/firestore";
import type { User } from '@/lib/types';
import { auth, db } from '@/lib/firebase';


interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  loginWithGoogle: () => Promise<boolean>;
  signup: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
  cancelLogin: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const loginCancelledRef = useRef(false);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            setUser(userDoc.data() as User);
        } else {
             const newUser: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'Usuário Google',
                role: 'admin', 
                avatar: firebaseUser.photoURL || `/avatars/0${Math.ceil(Math.random() * 3)}.png`,
            }
            await setDoc(userDocRef, newUser);
            setUser(newUser);
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);
  
  const signup = async (email: string, pass: string, name: string): Promise<{ success: boolean; error?: string }> => {
    setLoading(true);
    try {
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
      
      setUser(newUser);

      return { success: true };
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
      setLoading(false);
    }
  };

  const login = async (email: string, pass: string): Promise<boolean> => {
    setLoading(true);
    loginCancelledRef.current = false;
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        if (loginCancelledRef.current) {
            await signOut(auth); // Sign out if cancelled
            return false;
        }
        router.push('/dashboard');
        return true;
    } catch (error) {
        console.error("Firebase Login Error:", error);
        if (loginCancelledRef.current) {
            return false;
        }
        setUser(null);
        setLoading(false);
        return false;
    } finally {
        if (!loginCancelledRef.current) {
             // setLoading will be set to false by onAuthStateChanged if successful
        }
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
        setUser(null);
        setLoading(false);
        return false;
    }
  }

  const cancelLogin = () => {
      loginCancelledRef.current = true;
      setLoading(false);
  }

  const logout = async () => {
    try {
        await signOut(auth);
        setUser(null);
        router.push('/login');
    } catch (error) {
        console.error("Firebase Logout Error:", error);
    }
  };

  const isAuthenticated = !!user;
  
  useEffect(() => {
    if (loading) return; // Don't redirect while loading
    const isProtectedRoute = !pathname.startsWith('/login') && !pathname.startsWith('/signup');
    if (!isAuthenticated && isProtectedRoute) {
        router.push('/login');
    }
     if (isAuthenticated && (pathname.startsWith('/login') || pathname.startsWith('/signup'))) {
        router.push('/dashboard');
    }
  }, [isAuthenticated, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, loginWithGoogle, logout, loading, signup, cancelLogin }}>
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
