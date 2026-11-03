/**
 * Organization context — tracks the user's current organization membership
 * and provides RBAC helpers.
 *
 * A user can belong to multiple organizations but has one "active" org at a
 * time. Interview sessions, analytics, and billing all scope to the active org.
 */

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { useAuth } from "@/hooks/useAuth";
import { orgApi } from "@/lib/org-api";
import { type Organization } from "@/domain/types";

interface Membership {
  role: string;
  status: string;
  organization_id: string;
  user_id: string;
}

interface OrgContextType {
  organization: Organization | null;
  membership: Membership | null;
  loading: boolean;
  role: string | null;
  isAdmin: boolean;
  isMember: boolean;
  setOrganization: (org: Organization | null) => void;
  refreshMembership: () => Promise<void>;
  createOrganization: (
    name: string,
  ) => Promise<{ error: Error | null; organization?: Organization }>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);

  const role = membership?.role ?? null;
  const isAdmin = role === "admin";
  const isMember = membership != null && membership.status === "active";

  const loadMembership = useCallback(async () => {
    if (!user) {
      setMembership(null);
      setOrganization(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      // Pending invitations are addressed to an email. Claim them before
      // reading membership so an invited teammate lands in the right workspace.
      await orgApi.claimInvitations();

      const { data, error } = await orgApi.myMemberships(user.id);
      if (error) throw error;

      const member = data?.[0];
      if (member?.organization) {
        setMembership({
          role: member.role,
          status: member.status,
          organization_id: member.organization_id,
          user_id: member.user_id,
        });
        setOrganization(member.organization);
      } else {
        setMembership(null);
        setOrganization(null);
      }
    } catch {
      setMembership(null);
      setOrganization(null);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void loadMembership();
  }, [loadMembership]);

  const setOrganizationCtx = (org: Organization | null) => {
    setOrganization(org);
  };

  const refreshMembership = async () => {
    await loadMembership();
  };

  const createOrganization = async (name: string) => {
    if (!user) {
      return { error: new Error("Not authenticated") as Error };
    }

    const { data, error } = await orgApi.createOrganization(name);
    if (error) return { error: error as Error };
    if (!data) return { error: new Error("Organization was not created") as Error };

    setOrganization(data);
    setMembership({
      role: "admin",
      status: "active",
      organization_id: data.id,
      user_id: user.id,
    });
    return { error: null, organization: data };
  };

  return (
    <OrgContext.Provider
      value={{
        organization,
        membership,
        loading,
        role,
        isAdmin,
        isMember,
        setOrganization: setOrganizationCtx,
        refreshMembership,
        createOrganization,
      }}
    >
      {children}
    </OrgContext.Provider>
  );
}

export function useOrg() {
  const context = useContext(OrgContext);
  if (!context) throw new Error("useOrg must be used within OrgProvider");
  return context;
}
