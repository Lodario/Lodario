'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { AppRole, isAppRole } from './routeRoles';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  userRole: AppRole | null;
  isLoading: boolean;
  signUp: (email: string, password: string, role?: AppRole) => Promise<{ error: string | null }>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  setUserRole: (role: AppRole) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: string | null }>;
  updatePassword: (password: string) => Promise<{ error: string | null }>;
  updateDisplayName: (fullName: string) => Promise<{ error: string | null }>;
  updateEmail: (email: string) => Promise<{ error: string | null }>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  userRole: null,
  isLoading: true,
  signUp: async () => ({ error: null }),
  signIn: async () => ({ error: null }),
  setUserRole: async () => ({ error: null }),
  signOut: async () => {},
  resetPassword: async () => ({ error: null }),
  updatePassword: async () => ({ error: null }),
  updateDisplayName: async () => ({ error: null }),
  updateEmail: async () => ({ error: null }),
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [userRole, setUserRoleState] = useState<AppRole | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const resolveUserRole = async (activeUser: User): Promise<AppRole | null> => {
    const metadataRole = isAppRole(activeUser.user_metadata?.role) ? activeUser.user_metadata.role : null;
    const needsRoleSelection = activeUser.user_metadata?.needs_role_selection === true;

    const { data: profile, error } = await supabase
      .from('profiles')
      .select('id, role')
      .eq('id', activeUser.id)
      .maybeSingle();

    if (error) {
      console.error('Error resolving user role from profile:', error);
      return metadataRole ?? 'player';
    }

    if (!profile) {
      if (metadataRole) return metadataRole;
      return needsRoleSelection ? null : 'player';
    }

    if (isAppRole(profile.role)) {
      return profile.role;
    }

    if (metadataRole) {
      return metadataRole;
    }

    // Existing users with profile rows but no explicit role should keep
    // current athlete-side access.
    return 'player';
  };

  useEffect(() => {
    let isMounted = true;

    const syncSession = async (nextSession: Session | null) => {
      if (!isMounted) return;

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (!nextSession?.user) {
        setUserRoleState(null);
        setIsLoading(false);
        return;
      }

      const resolvedRole = await resolveUserRole(nextSession.user);
      if (!isMounted) return;
      setUserRoleState(resolvedRole);
      setIsLoading(false);
    };

    const getInitialSession = async () => {
      setIsLoading(true);
      const { data: { session: currentSession } } = await supabase.auth.getSession();
      await syncSession(currentSession);
    };

    void getInitialSession();

    // Listen for auth state changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        setIsLoading(true);
        void syncSession(newSession);
      }
    );

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signUp = async (email: string, password: string, role?: AppRole): Promise<{ error: string | null }> => {
    const metadata: Record<string, unknown> = role
      ? { role, needs_role_selection: false }
      : { needs_role_selection: true };

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: metadata },
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const signIn = async (email: string, password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const setUserRole = async (role: AppRole): Promise<{ error: string | null }> => {
    if (!user) return { error: 'You must be signed in to choose a role.' };

    const { error: profileError } = await supabase
      .from('profiles')
      .upsert(
        {
          id: user.id,
          role,
        },
        { onConflict: 'id' }
      );

    if (profileError) {
      return { error: profileError.message };
    }

    const { data, error: metadataError } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        role,
        needs_role_selection: null,
      },
    });

    if (metadataError) {
      console.error('Error saving user role in auth metadata:', metadataError);
    }

    if (data.user) {
      setUser(data.user);
    }

    setUserRoleState(role);
    return { error: null };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setUserRoleState(null);
  };

  const resetPassword = async (email: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) return { error: error.message };
    return { error: null };
  };

  const updatePassword = async (password: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { error: error.message };
    return { error: null };
  };

  const updateDisplayName = async (fullName: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'You must be signed in to update your name.' };

    const trimmedName = fullName.trim();
    if (!trimmedName) return { error: 'Name cannot be empty.' };

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...(user.user_metadata ?? {}),
        full_name: trimmedName,
      },
    });

    if (error) return { error: error.message };
    if (data.user) setUser(data.user);
    return { error: null };
  };

  const updateEmail = async (email: string): Promise<{ error: string | null }> => {
    if (!user) return { error: 'You must be signed in to update your email.' };

    const trimmedEmail = email.trim();
    if (!trimmedEmail) return { error: 'Email cannot be empty.' };

    const { data, error } = await supabase.auth.updateUser({ email: trimmedEmail });
    if (error) return { error: error.message };
    if (data.user) setUser(data.user);
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        userRole,
        isLoading,
        signUp,
        signIn,
        setUserRole,
        signOut,
        resetPassword,
        updatePassword,
        updateDisplayName,
        updateEmail,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};
