import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../supabase';

const SupabaseAuthContext = createContext(null);

export function SupabaseAuthProvider({ children }) {
  const [authUser, setAuthUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!supabase) {
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (session?.user) {
          setAuthUser(session.user);
        } else {
          setAuthUser(null);
        }
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setAuthUser(session.user);
      }
      setLoading(false);
    });

    return () => subscription?.unsubscribe();
  }, []);

  const signUpWithEmail = useCallback(async (email, password, displayName) => {
    if (!supabase) return { error: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { display_name: displayName } }
      });
      if (error) return { error: error.message };
      return { success: true, user: data.user };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signInWithEmail = useCallback(async (email, password) => {
    if (!supabase) return { error: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) return { error: error.message };
      return { success: true, user: data.user };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signInWithGoogle = useCallback(async () => {
    if (!supabase) return { error: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/home',
        }
      });
      if (error) return { error: error.message };
      return { success: true, user: null };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signInWithGithub = useCallback(async () => {
    if (!supabase) return { error: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'github',
        options: {
          redirectTo: window.location.origin + '/home',
        }
      });
      if (error) return { error: error.message };
      return { success: true, user: null };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signInWithFacebook = useCallback(async () => {
    if (!supabase) return { error: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'facebook',
        options: {
          redirectTo: window.location.origin + '/home',
        }
      });
      if (error) return { error: error.message };
      return { success: true, user: null };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) {
      try { localStorage.removeItem('nocturne_token'); localStorage.removeItem('nocturne_user'); } catch {} // eslint-disable-line no-empty
      return { success: true };
    }
    try {
      const { error } = await supabase.auth.signOut();
      try { localStorage.removeItem('nocturne_token'); localStorage.removeItem('nocturne_user'); } catch {} // eslint-disable-line no-empty
      if (error) return { error: error.message };
      return { success: true };
    } catch (error) {
      try { localStorage.removeItem('nocturne_token'); localStorage.removeItem('nocturne_user'); } catch {} // eslint-disable-line no-empty
      return { error: error.message };
    }
  }, []);

  const resetPassword = useCallback(async (email) => {
    if (!supabase) return { error: 'Supabase not configured' };
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: window.location.origin + '/sign-in',
      });
      if (error) return { error: error.message };
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const updateUserProfile = useCallback(async (updates) => {
    if (!supabase) return { error: 'Supabase not configured' };
    try {
      const { error } = await supabase.auth.updateUser({
        data: updates
      });
      if (error) return { error: error.message };
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const changePassword = useCallback(async (currentPassword, newPassword) => {
    if (!supabase) return { error: 'Supabase not configured' };
    try {
      const { error } = await supabase.auth.updateUser({
        password: newPassword
      });
      if (error) return { error: error.message };
      return { success: true };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const getUserData = useCallback(async (uid) => {
    if (!supabase) return { success: false, error: 'Supabase not configured' };
    try {
      const { data, error } = await supabase.auth.getUser();
      if (error) return { success: false, error: error.message };
      return { success: true, data: data.user?.user_metadata || {} };
    } catch (error) {
      return { error: error.message };
    }
  }, []);

  const value = {
    user: authUser,
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
    <SupabaseAuthContext.Provider value={value}>
      {children}
    </SupabaseAuthContext.Provider>
  );
}

export const useSupabaseAuth = () => useContext(SupabaseAuthContext);
