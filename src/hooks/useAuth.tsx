import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { verifyTokenAsync, generateSecret, generateRecoveryCodes } from "@/lib/mfa";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  mfaEnabled: boolean;
  mfaRequired: boolean;
  signUp: (email: string, password: string, name: string) => Promise<{ error: Error | null; needsConfirmation: boolean }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null; mfaRequired?: boolean }>;
  verifyMFA: (token: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  enableMFA: () => Promise<{ secret: string; recoveryCodes: string[]; error: Error | null }>;
  disableMFA: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        const mfaReq = (session.user.app_metadata as Record<string, unknown> | undefined)?.mfa_required === true;
        setMfaRequired(mfaReq);
      }
    });

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
      if (session?.user) {
        const mfaReq = (session.user.app_metadata as Record<string, unknown> | undefined)?.mfa_required === true;
        setMfaRequired(mfaReq);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    return {
      error: error as Error | null,
      needsConfirmation: !error && !data.session,
    };
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };

    const mfaReq = (data.user?.app_metadata as Record<string, unknown> | undefined)?.mfa_required === true;
    setMfaRequired(mfaReq);
    return { error: null, mfaRequired: mfaReq };
  };

  const verifyMFA = async (token: string) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: profile } = await (supabase as any)
      .from("profiles")
      .select("mfa_secret")
      .eq("user_id", user?.id)
      .single();

    const secret = profile?.mfa_secret;
    if (!secret) {
      return { error: new Error("MFA not configured") as Error };
    }

    const valid = await verifyTokenAsync(secret, token);
    if (!valid) {
      return { error: new Error("Invalid verification code") as Error };
    }

    await supabase.auth.getSession();
    setMfaRequired(false);
    return { error: null };
  };

  const signOut = async () => {
    setMfaRequired(false);
    setMfaEnabled(false);
    await supabase.auth.signOut();
  };

  const enableMFA = async () => {
    if (!user) return { secret: "", recoveryCodes: [], error: new Error("Not authenticated") as Error };

    const secret = generateSecret();
    const recoveryCodes = generateRecoveryCodes();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ mfa_secret: secret, mfa_recovery_codes: recoveryCodes, mfa_enabled: true })
      .eq("user_id", user.id);
    if (error) {
      return { secret: "", recoveryCodes: [], error: error as Error };
    }

    setMfaEnabled(true);

    return { secret, recoveryCodes, error: null };
  };

  const disableMFA = async () => {
    if (!user) return { error: new Error("Not authenticated") as Error };

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ mfa_secret: null, mfa_recovery_codes: [], mfa_enabled: false })
      .eq("user_id", user.id);

    if (error) return { error: error as Error };

    setMfaEnabled(false);
    setMfaRequired(false);
    return { error: null };
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        loading,
        mfaEnabled,
        mfaRequired,
        signUp,
        signIn,
        verifyMFA,
        signOut,
        enableMFA,
        disableMFA,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
