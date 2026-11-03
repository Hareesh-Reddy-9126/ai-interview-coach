/**
 * Organization context — tracks the user's current organization membership
 * and provides RBAC helpers.
 *
 * A user can belong to multiple organizations but has one "active" org at a
 * time. Interview sessions, analytics, and billing all scope to the active org.
 */

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { type Organization } from "@/domain/types";

interface OrgContextType {
  organization: Organization | null;
  membership: { role: string; status: string; organization_id: string; user_id: string } | null;
  loading: boolean;
  role: string | null;
  isAdmin: boolean;
  isMember: boolean;
  setOrganization: (org: Organization | null) => void;
  refreshMembership: () => Promise<void>;
}

const OrgContext = createContext<OrgContextType | undefined>(undefined);

export function OrgProvider({ children }: { children: ReactNode }) {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [membership, setMembership] = useState<{ role: string; status: string; organization_id: string; user_id: string } | null>(null);
  const [loading, setLoading] = useState(true);

  const role = membership?.role ?? null;
  const isAdmin = role === "admin";
  const isMember = membership != null && membership.status === "active";

  useEffect(() => {
    let cancelled = false;

    const loadMembership = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user || cancelled) return;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data: members, error } = await (supabase as any)
          .from("organization_members")
          .select(`
            *,
            organization: organizations(*)
          `)
          .eq("user_id", user.id)
          .eq("status", "active")
          .order("created_at", { ascending: false });

        if (error || cancelled) return;

        if (members && members.length > 0) {
          const member = members[0];
          setMembership({
            role: member.role,
            status: member.status,
            organization_id: member.organization_id,
            user_id: member.user_id,
          });
          setOrganization(member.organization as Organization);
        } else {
          setMembership(null);
          setOrganization(null);
        }
      } catch {
        setMembership(null);
        setOrganization(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadMembership();
    return () => { cancelled = true; };
  }, []);

  const setOrganizationCtx = (org: Organization | null) => {
    setOrganization(org);
  };

  const refreshMembership = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: members } = await (supabase as any)
        .from("organization_members")
        .select(`
          *,
          organization: organizations(*)
        `)
        .eq("user_id", user.id)
        .eq("status", "active")
        .order("created_at", { ascending: false });

      if (members && members.length > 0) {
        const member = members[0];
        setMembership({
          role: member.role,
          status: member.status,
          organization_id: member.organization_id,
          user_id: member.user_id,
        });
        setOrganization(member.organization as Organization);
      }
    } finally {
      setLoading(false);
    }
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
