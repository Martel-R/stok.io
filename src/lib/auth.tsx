'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, User as FirebaseAuthUser } from 'firebase/auth';
import { doc, getDoc, setDoc, collection, query, where, getDocs } from "firebase/firestore";
import type { User } from '@/lib/types';
import { auth, db } from '@/lib/firebase';


interface AuthContextType {
  isAuthenticated: boolean;
  user: User | null;
  login: (email: string, pass: string) => Promise<boolean>;
  signup: (email: string, pass: string, name: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        // User is signed in. Fetch their profile from Firestore.
        const userDocRef = doc(db, "users", firebaseUser.uid);
        const userDoc = await getDoc(userDocRef);
        if (userDoc.exists()) {
            setUser(userDoc.data() as User);
        } else {
             // This might happen if the Firestore document wasn't created on signup
             // We can create a default one or just use basic auth info.
             const newUser: User = {
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'Usuário',
                role: 'admin', 
                avatar: firebaseUser.photoURL || `/avatars/0${Math.ceil(Math.random() * 3)}.png`,
            }
            // Save this new profile back to Firestore to prevent future issues
            await setDoc(userDocRef, newUser);
            setUser(newUser);
        }
      } else {
        // User is signed out
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

      // Create user profile in Firestore
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
    try {
        await signInWithEmailAndPassword(auth, email, pass);
        // onAuthStateChanged will handle setting the user.
        router.push('/dashboard');
        return true;
    } catch (error) {
        console.error("Firebase Login Error:", error);
        setUser(null);
        setLoading(false); // Make sure loading stops on error
        return false;
    } 
    // setLoading will be set to false by onAuthStateChanged
  };

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
  
  // This effect handles redirection for protected routes
  useEffect(() => {
    const isProtectedRoute = !pathname.startsWith('/login') && !pathname.startsWith('/signup');
    if (!loading && !isAuthenticated && isProtectedRoute) {
        router.push('/login');
    }
  }, [isAuthenticated, loading, pathname, router]);

  return (
    <AuthContext.Provider value={{ isAuthenticated, user, login, logout, loading, signup }}>
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
