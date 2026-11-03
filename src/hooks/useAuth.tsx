import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { User, Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface MfaEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

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
  enableMFA: () => Promise<{ enrollment: MfaEnrollment | null; error: Error | null }>;
  verifyMFASetup: (factorId: string, code: string) => Promise<{ error: Error | null }>;
  cancelMFAEnrollment: (factorId: string) => Promise<{ error: Error | null }>;
  disableMFA: () => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [mfaEnabled, setMfaEnabled] = useState(false);
  const [mfaRequired, setMfaRequired] = useState(false);

  const refreshMfaState = useCallback(async () => {
    const { data: factors, error } = await supabase.auth.mfa.listFactors();
    if (error) return;

    const verified = factors.totp.filter((factor) => factor.status === "verified");
    setMfaEnabled(verified.length > 0);

    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    setMfaRequired(
      Boolean(
        assurance &&
          assurance.nextLevel === "aal2" &&
          assurance.currentLevel !== "aal2",
      ),
    );
  }, []);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setUser(nextSession?.user ?? null);
      setLoading(false);
      if (nextSession?.user) {
        void refreshMfaState();
      } else {
        setMfaEnabled(false);
        setMfaRequired(false);
      }
    });

    supabase.auth.getSession().then(({ data: { session: initialSession } }) => {
      setSession(initialSession);
      setUser(initialSession?.user ?? null);
      setLoading(false);
      if (initialSession?.user) {
        void refreshMfaState();
      }
    });

    return () => subscription.unsubscribe();
  }, [refreshMfaState]);

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name }, emailRedirectTo: window.location.origin },
    });
    if (data.session) {
      await refreshMfaState();
    }
    return {
      error: error as Error | null,
      needsConfirmation: !error && !data.session,
    };
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error as Error | null };

    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    const needsSecondFactor = Boolean(
      assurance &&
        assurance.nextLevel === "aal2" &&
        assurance.currentLevel !== "aal2",
    );

    setMfaRequired(needsSecondFactor);
    await refreshMfaState();

    return { error: null, mfaRequired: needsSecondFactor };
  };

  const verifyMFA = async (token: string) => {
    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) {
      return { error: factorError as Error };
    }

    const factor = factors.totp.find((candidate) => candidate.status === "verified");
    if (!factor) {
      return { error: new Error("No authenticator is enrolled for this account.") as Error };
    }

    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId: factor.id,
    });
    if (challengeError) {
      return { error: challengeError as Error };
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId: factor.id,
      challengeId: challenge.id,
      code: token,
    });
    if (verifyError) {
      return { error: verifyError as Error };
    }

    setMfaRequired(false);
    await refreshMfaState();
    return { error: null };
  };

  const signOut = async () => {
    setMfaRequired(false);
    setMfaEnabled(false);
    await supabase.auth.signOut();
  };

  const enableMFA = async () => {
    if (!user) {
      return { enrollment: null, error: new Error("Not authenticated") as Error };
    }

    const { data, error } = await supabase.auth.mfa.enroll({
      factorType: "totp",
      friendlyName: `Interview Lab · ${new Date().toISOString().slice(0, 10)}`,
    });

    if (error) {
      return { enrollment: null, error: error as Error };
    }

    return {
      enrollment: {
        factorId: data.id,
        qrCode: data.totp.qr_code,
        secret: data.totp.secret,
        uri: data.totp.uri,
      },
      error: null,
    };
  };

  const verifyMFASetup = async (factorId: string, code: string) => {
    const { data: challenge, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });
    if (challengeError) {
      return { error: challengeError as Error };
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: challenge.id,
      code,
    });
    if (verifyError) {
      return { error: verifyError as Error };
    }

    await refreshMfaState();
    return { error: null };
  };

  const cancelMFAEnrollment = async (factorId: string) => {
    const { error } = await supabase.auth.mfa.unenroll({ factorId });
    await refreshMfaState();
    return { error: error as Error | null };
  };

  const disableMFA = async () => {
    if (!user) {
      return { error: new Error("Not authenticated") as Error };
    }

    const { data: factors, error: factorError } = await supabase.auth.mfa.listFactors();
    if (factorError) {
      return { error: factorError as Error };
    }

    for (const factor of factors.totp) {
      const { error } = await supabase.auth.mfa.unenroll({ factorId: factor.id });
      if (error) {
        return { error: error as Error };
      }
    }

    setMfaEnabled(false);
    setMfaRequired(false);
    await refreshMfaState();
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
        verifyMFASetup,
        cancelMFAEnrollment,
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
