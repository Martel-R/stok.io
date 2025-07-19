'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { getAuth, onAuthStateChanged, signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword, updateProfile, User as FirebaseAuthUser } from 'firebase/auth';
import type { User } from '@/lib/types';
import { MOCK_USERS } from '@/lib/mock-data';
import { auth } from '@/lib/firebase';


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
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser: FirebaseAuthUser | null) => {
      if (firebaseUser) {
        // User is signed in. Find the corresponding user profile from our mock data.
        // In a real app, you'd fetch this from Firestore.
        const profile = MOCK_USERS.find(u => u.email === firebaseUser.email);
        if (profile) {
            const { password, ...userToStore } = profile;
            setUser(userToStore);
        } else {
            // Handle case where user exists in Firebase Auth but not in our user list
            setUser({
                id: firebaseUser.uid,
                email: firebaseUser.email || '',
                name: firebaseUser.displayName || 'Usuário',
                role: 'cashier', // default role for new signups
                avatar: firebaseUser.photoURL || `/avatars/0${Math.ceil(Math.random() * 3)}.png`,
            })
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
      await updateProfile(userCredential.user, {
        displayName: name,
      });
      // onAuthStateChanged will handle setting the user.
      // We can manually set the user here as well to speed up UI update
      setUser({
        id: userCredential.user.uid,
        email: userCredential.user.email || '',
        name: name,
        role: 'cashier',
        avatar: `/avatars/0${Math.ceil(Math.random() * 3)}.png`,
      });
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
        // onAuthStateChanged will handle setting the user and redirecting
        router.push('/dashboard');
        return true;
    } catch (error) {
        console.error("Firebase Login Error:", error);
        setUser(null);
        return false;
    } finally {
        setLoading(false);
    }
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
    if (!loading && !isAuthenticated && !pathname.startsWith('/login') && !pathname.startsWith('/signup')) {
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
