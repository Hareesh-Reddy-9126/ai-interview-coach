/**
 * Typed access to the organization RPCs and the few direct table operations
 * that RLS allows. Keeping the casts here means screens never reach for `any`.
 */

import { supabase } from "@/integrations/supabase/client";
import { type Organization } from "@/domain/types";

export interface OrgMembershipRow {
  role: string;
  status: string;
  organization_id: string;
  user_id: string;
  organization: Organization | null;
}

export interface OrgMemberRow {
  id: string;
  user_id: string | null;
  role: string;
  status: string;
  invited_email: string | null;
  name: string;
  email: string;
  mfa_enabled: boolean;
  created_at: string;
  joined_at: string | null;
}

export interface OrgOverview {
  members: number;
  active_members: number;
  pending_invites: number;
  interviews_completed: number;
  avg_score: number;
  sessions_last_30d: number;
}

interface RpcResponse<T> {
  data: T | null;
  error: Error | null;
}

interface QueryResponse {
  error: Error | null;
}

type OrgClient = {
  rpc: <T>(fn: string, args?: Record<string, unknown>) => Promise<RpcResponse<T>>;
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        eq: (
          column: string,
          value: string,
        ) => {
          order: (
            column: string,
            options: { ascending: boolean },
          ) => Promise<RpcResponse<OrgMembershipRow[]>>;
        };
      };
    };
    update: (values: Record<string, unknown>) => {
      eq: (column: string, value: string) => Promise<QueryResponse>;
    };
    delete: () => {
      eq: (column: string, value: string) => Promise<QueryResponse>;
    };
  };
};

const client = supabase as unknown as OrgClient;

export const orgApi = {
  myMemberships(userId: string) {
    return client
      .from("organization_members")
      .select(
        `
          role,
          status,
          organization_id,
          user_id,
          organization: organizations(*)
        `,
      )
      .eq("user_id", userId)
      .eq("status", "active")
      .order("created_at", { ascending: false });
  },

  claimInvitations() {
    return client.rpc<number>("claim_org_invitations");
  },

  createOrganization(name: string) {
    return client.rpc<Organization>("create_organization", { p_name: name });
  },

  listMembers(organizationId: string) {
    return client.rpc<OrgMemberRow[]>("list_org_members", {
      p_org_id: organizationId,
    });
  },

  getOverview(organizationId: string) {
    return client.rpc<OrgOverview>("get_org_overview", {
      p_org_id: organizationId,
    });
  },

  inviteMember(organizationId: string, email: string, role: string) {
    return client.rpc<OrgMemberRow>("invite_org_member", {
      p_org_id: organizationId,
      p_email: email,
      p_role: role,
    });
  },

  updateMemberRole(memberId: string, role: string) {
    return client.from("organization_members").update({ role }).eq("id", memberId);
  },

  removeMember(memberId: string) {
    return client.from("organization_members").delete().eq("id", memberId);
  },

  updateOrganization(
    organizationId: string,
    values: { name?: string; primary_color?: string; logo_url?: string | null },
  ) {
    return client.from("organizations").update(values).eq("id", organizationId);
  },
};
