// DEPRECATED: This file is no longer imported. Safe to remove after verification.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { 
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  sendPasswordResetEmail,
  updateProfile,
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, googleProvider, githubProvider, facebookProvider } from '../firebase';

const FirebaseAuthContext = createContext(null);

export function FirebaseAuthProvider({ children }) {
  const [firebaseUser, setFirebaseUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signUpWithEmail = useCallback(async (email, password, displayName) => {
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      await updateProfile(userCredential.user, { displayName });
      
      await setDoc(doc(db, 'users', userCredential.user.uid), {
        uid: userCredential.user.uid,
        email,
        displayName,
        role: 'user',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });

      return { success: true, user: userCredential.user };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    try {
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      return { success: true, user: userCredential.user };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, googleProvider);
      const user = result.user;

      // Fire-and-forget Firestore sync — don't block auth on it
      getDoc(doc(db, 'users', user.uid)).then(userDoc => {
        if (!userDoc.exists()) {
          setDoc(doc(db, 'users', user.uid), {
            uid: user.uid,
            email: user.email,
            displayName: user.displayName,
            photoURL: user.photoURL,
            role: 'user',
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
          }).catch(() => {});
        }
      }).catch(() => {});

      return { success: true, isNew: false, user };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signInWithGithub = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, githubProvider);
      const user = result.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const isNew = !userDoc.exists();

      if (isNew) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: 'user',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      return { success: true, isNew, user };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signInWithFacebook = useCallback(async () => {
    try {
      const result = await signInWithPopup(auth, facebookProvider);
      const user = result.user;
      
      const userDoc = await getDoc(doc(db, 'users', user.uid));
      const isNew = !userDoc.exists();

      if (isNew) {
        await setDoc(doc(db, 'users', user.uid), {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName,
          photoURL: user.photoURL,
          role: 'user',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      }

      return { success: true, isNew, user };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signOut = useCallback(async () => {
    try {
      await firebaseSignOut(auth);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const resetPassword = useCallback(async (email) => {
    try {
      await sendPasswordResetEmail(auth, email);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const updateUserProfile = useCallback(async (updates) => {
    try {
      await updateProfile(auth.currentUser, updates);
      await setDoc(doc(db, 'users', auth.currentUser.uid), {
        ...updates,
        updatedAt: serverTimestamp()
      }, { merge: true });
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    try {
      const credential = EmailAuthProvider.credential(
        auth.currentUser.email,
        currentPassword
      );
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const getUserData = useCallback(async (uid) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        return { success: true, data: userDoc.data() };
      }
      return { success: false, error: 'User not found' };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const value = {
    firebaseUser,
    loading,
    signUpWithEmail,
    signInWithEmail,
    signInWithGoogle,
    signInWithGithub,
    signInWithFacebook,
    signOut,
    resetPassword,
    updateUserProfile,
    changePassword,
    getUserData
  };

  return (
    <FirebaseAuthContext.Provider value={value}>
      {children}
    </FirebaseAuthContext.Provider>
  );
}

export const useFirebaseAuth = () => useContext(FirebaseAuthContext);