import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import type { User, Session, SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseBrowserClient } from '../supabase/client';
import { getAuthErrorMessage } from './authErrors';
import type { UserProfile } from '../profiles/types';
import {
  fetchUserProfile,
  updateUserFullName,
  repairOrEnsureProfile,
} from '../profiles/profileClient';

export type AuthStatus =
  | 'checking_session'
  | 'loading_account'
  | 'loading_profile'
  | 'loading_permissions'
  | 'signing_in'
  | 'signing_out'
  | 'creating_account'
  | 'idle';

interface AuthResponse {
  user: User | null;
  session: Session | null;
  needsConfirmation?: boolean;
  error: Error | null;
}

interface AuthContextType {
  supabase: SupabaseClient;
  user: User | null;
  session: Session | null;
  profile: UserProfile | null;
  loading: boolean;
  profileLoading: boolean;
  authStatus: AuthStatus;
  authError: string | null;
  clearAuthError: () => void;
  retryAuth: () => Promise<void>;
  signUp: (email: string, password: string, fullName?: string) => Promise<AuthResponse>;
  signIn: (email: string, password: string) => Promise<AuthResponse>;
  signOut: () => Promise<{ error: Error | null }>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
  updatePassword: (password: string) => Promise<{ error: Error | null }>;
  refreshProfile: () => Promise<void>;
  updateFullName: (fullName: string) => Promise<{ profile: UserProfile | null; error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profileLoading, setProfileLoading] = useState<boolean>(false);
  const [authStatus, setAuthStatus] = useState<AuthStatus>('checking_session');
  const [authError, setAuthError] = useState<string | null>(null);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const loadProfile = useCallback(async (targetUser: User | null) => {
    if (!targetUser) {
      setProfile(null);
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    setAuthStatus('loading_profile');
    try {
      const res = await fetchUserProfile(targetUser.id);
      if (res.profile) {
        setProfile(res.profile);
      } else {
        // Auto-repair profile if row doesn't exist yet
        const repairRes = await repairOrEnsureProfile({
          id: targetUser.id,
          email: targetUser.email || '',
          fullName: targetUser.user_metadata?.full_name,
        });
        if (repairRes.profile) {
          setProfile(repairRes.profile);
        }
      }
    } catch (err) {
      console.error('Error loading user profile:', err);
      setAuthError('Failed to load profile. Please refresh the page to retry.');
    } finally {
      setProfileLoading(false);
      setAuthStatus('idle');
    }
  }, []);

  const initSession = useCallback(async () => {
    setLoading(true);
    setAuthStatus('checking_session');
    setAuthError(null);

    try {
      const { data: { session: initialSession }, error } = await supabase.auth.getSession();
      if (error) {
        console.error('Error retrieving session:', error);
        setAuthError(getAuthErrorMessage(error));
      }
      setSession(initialSession);
      const currentUser = initialSession?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser);
      }
    } catch (err) {
      console.error('Failed to get session:', err);
      setAuthError(getAuthErrorMessage(err));
    } finally {
      setLoading(false);
      setAuthStatus('idle');
    }
  }, [supabase, loadProfile]);

  useEffect(() => {
    let isMounted = true;

    initSession();

    // Listen for authentication changes (SIGN_IN, SIGN_OUT, TOKEN_REFRESHED, USER_UPDATED, PASSWORD_RECOVERY)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, currentSession) => {
      if (!isMounted) return;
      setSession(currentSession);
      const currentUser = currentSession?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await loadProfile(currentUser);
      } else {
        setProfile(null);
      }
      setLoading(false);
      setAuthStatus('idle');
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [supabase, loadProfile, initSession]);

  const refreshProfile = useCallback(async () => {
    if (user) {
      await loadProfile(user);
    }
  }, [user, loadProfile]);

  const updateFullName = useCallback(
    async (fullName: string): Promise<{ profile: UserProfile | null; error: Error | null }> => {
      if (!user) {
        return { profile: null, error: new Error('User is not authenticated.') };
      }
      const res = await updateUserFullName(user.id, fullName);
      if (res.profile) {
        setProfile(res.profile);
      }
      return res;
    },
    [user]
  );

  const signUp = async (
    email: string,
    password: string,
    fullName?: string
  ): Promise<AuthResponse> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return { user: null, session: null, error: new Error('Please enter your email address.') };
    }
    if (!password) {
      return { user: null, session: null, error: new Error('Please enter your password.') };
    }
    if (password.length < 8) {
      return {
        user: null,
        session: null,
        error: new Error('Password is too weak. Please choose a password with at least 8 characters.'),
      };
    }

    setAuthStatus('creating_account');
    try {
      const redirectTo = `${window.location.origin}/dashboard`;
      const metadata: Record<string, any> = {};
      if (fullName && fullName.trim()) {
        metadata.full_name = fullName.trim();
      }

      const { data, error } = await supabase.auth.signUp({
        email: trimmedEmail,
        password,
        options: {
          emailRedirectTo: redirectTo,
          data: metadata,
        },
      });

      if (error) {
        setAuthStatus('idle');
        return {
          user: null,
          session: null,
          needsConfirmation: false,
          error: new Error(getAuthErrorMessage(error)),
        };
      }

      // Check if user already exists
      if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
        setAuthStatus('idle');
        return {
          user: null,
          session: null,
          needsConfirmation: false,
          error: new Error('An account with this email address already exists. Please log in or reset your password.'),
        };
      }

      const needsConfirmation = !data.session;
      if (data.session) {
        setSession(data.session);
        setUser(data.user);
        if (data.user) {
          await loadProfile(data.user);
        }
      }

      setAuthStatus('idle');
      return {
        user: data.user,
        session: data.session,
        needsConfirmation,
        error: null,
      };
    } catch (err) {
      setAuthStatus('idle');
      return {
        user: null,
        session: null,
        needsConfirmation: false,
        error: new Error(getAuthErrorMessage(err)),
      };
    }
  };

  const signIn = async (email: string, password: string): Promise<AuthResponse> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return { user: null, session: null, error: new Error('Please enter your email address.') };
    }
    if (!password) {
      return { user: null, session: null, error: new Error('Please enter your password.') };
    }

    setAuthStatus('signing_in');
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: trimmedEmail,
        password,
      });

      if (error) {
        setAuthStatus('idle');
        return {
          user: null,
          session: null,
          error: new Error(getAuthErrorMessage(error)),
        };
      }

      setSession(data.session);
      setUser(data.user);
      if (data.user) {
        await loadProfile(data.user);
      }

      setAuthStatus('idle');
      return {
        user: data.user,
        session: data.session,
        error: null,
      };
    } catch (err) {
      setAuthStatus('idle');
      return {
        user: null,
        session: null,
        error: new Error(getAuthErrorMessage(err)),
      };
    }
  };

  const signOut = async (): Promise<{ error: Error | null }> => {
    setAuthStatus('signing_out');
    try {
      const { error } = await supabase.auth.signOut();
      setSession(null);
      setUser(null);
      setProfile(null);
      setAuthStatus('idle');

      if (error) {
        return { error: new Error(getAuthErrorMessage(error)) };
      }
      return { error: null };
    } catch (err) {
      setSession(null);
      setUser(null);
      setProfile(null);
      setAuthStatus('idle');
      return { error: new Error(getAuthErrorMessage(err)) };
    }
  };

  const resetPassword = async (email: string): Promise<{ error: Error | null }> => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      return { error: new Error('Please enter your email address.') };
    }

    try {
      const redirectTo = `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(trimmedEmail, {
        redirectTo,
      });

      if (error) {
        return { error: new Error(getAuthErrorMessage(error)) };
      }

      return { error: null };
    } catch (err) {
      return { error: new Error(getAuthErrorMessage(err)) };
    }
  };

  const updatePassword = async (password: string): Promise<{ error: Error | null }> => {
    if (!password) {
      return { error: new Error('Please enter your new password.') };
    }
    if (password.length < 8) {
      return {
        error: new Error('Password is too weak. Please choose a password with at least 8 characters.'),
      };
    }

    try {
      const { error } = await supabase.auth.updateUser({ password });

      if (error) {
        return { error: new Error(getAuthErrorMessage(error)) };
      }

      return { error: null };
    } catch (err) {
      return { error: new Error(getAuthErrorMessage(err)) };
    }
  };

  return (
    <AuthContext.Provider
      value={{
        supabase,
        user,
        session,
        profile,
        loading,
        profileLoading,
        authStatus,
        authError,
        clearAuthError,
        retryAuth: initSession,
        signUp,
        signIn,
        signOut,
        resetPassword,
        updatePassword,
        refreshProfile,
        updateFullName,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
