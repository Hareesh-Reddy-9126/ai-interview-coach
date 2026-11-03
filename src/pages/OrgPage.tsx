import { useEffect, useState } from "react";
import { Shield } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";

export default function OrgPage() {
  const {
    isAdmin,
    isMember,
    organization,
    refreshMembership,
  } = useOrg();
  const { user } = useAuth();
  const [members, setMembers] = useState<any[]>([]); // eslint-disable-line @typescript-eslint/no-explicit-any
  const [orgLoading, setOrgLoading] = useState(false);
  const [memberLoading, setMemberLoading] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");

  const loadMembers = async () => {
    if (!organization?.id) return;
    setMemberLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("organization_members")
        .select(`
          *,
          profiles: profiles (email, name, mfa_enabled)
        `)
        .eq("organization_id", organization.id)
        .order("created_at", { ascending: true });
      setMembers(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (data || []).map((m: any) => ({ // eslint-disable-line @typescript-eslint/no-explicit-any
          ...m,
          email: m.profiles?.email || "—",
          name: m.profiles?.name || "—",
          mfaEnabled: m.profiles?.mfa_enabled || false,
        })),
      );
    } catch {
      setMembers([]);
    } finally {
      setMemberLoading(false);
    }
  };

  useEffect(() => {
    if (organization?.id) loadMembers();
  }, [organization?.id]);

  const updateMemberRole = async (memberId: string, newRole: string) => {
    setEditingRole(memberId);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("organization_members")
        .update({ role: newRole })
        .eq("id", memberId);
      if (error) throw error;
      toast.success("Role updated.");
      await loadMembers();
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      toast.error(e.message || "Failed to update role.");
    } finally {
      setEditingRole(null);
    }
  };

  const removeMember = async (memberId: string) => {
    if (!confirm("Remove this member from the organization?")) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("organization_members")
        .delete()
        .eq("id", memberId);
      if (error) throw error;
      toast.success("Member removed.");
      await loadMembers();
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      toast.error(e.message || "Failed to remove member.");
    }
  };

  const inviteMember = async () => {
    if (!organization?.id || !newMemberEmail) return;
    setMemberLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("organization_members")
        .insert({
          organization_id: organization.id,
          role: newMemberRole,
          status: "invited",
          invited_at: new Date().toISOString(),
        });
      if (error) throw error;
      toast.success("Invitation sent.");
      setNewMemberEmail("");
      await loadMembers();
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      toast.error(e.message || "Failed to send invitation.");
    } finally {
      setMemberLoading(false);
    }
  };

  const updateOrgSettings = async (field: string, value: string) => {
    if (!organization?.id) return;
    setOrgLoading(true);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { error } = await (supabase as any) // eslint-disable-line @typescript-eslint/no-explicit-any
        .from("organizations")
        .update({ [field]: value })
        .eq("id", organization.id);
      if (error) throw error;
      toast.success("Organization settings updated.");
      await refreshMembership();
    } catch (e: any) { // eslint-disable-line @typescript-eslint/no-explicit-any
      toast.error(e.message || "Failed to update settings.");
    } finally {
      setOrgLoading(false);
    }
  };

  const orgAnalytics = {
    interviews: members.reduce(
      (sum, m) => sum + (m.interviews_completed || 0),
      0,
    ),
    avgScore: members.length
      ? Math.round(
          members.reduce((sum, m) => sum + (m.avg_score || 0), 0) /
            members.length,
        )
      : 0,
  };

  if (!isMember) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-background">
        <Shield className="mb-4 h-8 w-8 text-muted-foreground/30" />
        <h1 className="font-display text-[24px] font-light leading-none tracking-[-0.02em] text-foreground">
          No organization
        </h1>
        <p className="mt-2 text-[12px] leading-5 text-muted-foreground">
          You&apos;re not a member of any organization. Contact an admin to be invited,
          or create one to get started.
        </p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-9 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <span className="section-label">
              Organization · {organization?.plan}
            </span>
          </div>
          <h1 className="text-display-lg text-foreground">
            {organization?.name}
          </h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-[1.7] text-muted-foreground">
            Team workspace for shared interviews, billing, and analytics.
            {organization?.slug && (
              <span className="ml-2 font-mono text-[10px] text-muted-foreground/40">
                • {window.location.origin}/org/{organization.slug}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            type="button"
            onClick={refreshMembership}
            disabled={orgLoading}
            className="btn-secondary btn-sm gap-1.5"
          >
            <span className="h-3.5 w-3.5 animate-spin" /> Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-4 lg:gap-8">
        {/* ── Org stats ─────────────────────────────────── */}
        <div className="lg:col-span-1">
          <section className="space-y-6">
            <div className="border border-border rounded p-5">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
                Members
              </p>
              <p className="mt-1 font-display text-[32px] font-light leading-none tracking-[-0.03em] text-foreground">
                {members.length}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground/60">
                Active seats in workspace
              </p>
            </div>

            <div className="border border-border rounded p-5">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
                Interviews this month
              </p>
              <p className="mt-1 font-display text-[32px] font-light leading-none tracking-[-0.03em] text-foreground">
                {orgAnalytics.interviews}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground/60">
                Team interview volume
              </p>
            </div>

            <div className="border border-border rounded p-5">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
                Team avg score
              </p>
              <p className="mt-1 font-display text-[32px] font-light leading-none tracking-[-0.03em] text-foreground">
                {orgAnalytics.avgScore}%
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground/60">
                Across all team sessions
              </p>
            </div>
          </section>
        </div>

        {/* ── Members ─────────────────────────────────── */}
        <div className="lg:col-span-3">
          <section className="space-y-5">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div>
                <h2 className="font-display text-[18px] font-light leading-none tracking-[-0.02em] text-foreground">
                  Team members
                </h2>
                <p className="mt-1 text-[10px] text-muted-foreground/50">
                  Manage access and roles
                </p>
              </div>
              {isAdmin && (
                <div className="flex items-center gap-2">
                  <input
                    id="invite-email"
                    value={newMemberEmail}
                    onChange={(e) => setNewMemberEmail(e.target.value)}
                    placeholder="email@company.com"
                    className="input-base w-[200px]"
                  />
                  <select
                    value={newMemberRole}
                    onChange={(e) => setNewMemberRole(e.target.value)}
                    className="input-base w-[140px]"
                  >
                    <option value="member">Member</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button
                    type="button"
                    onClick={inviteMember}
                    disabled={memberLoading || !newMemberEmail}
                    className="btn-secondary btn-sm gap-1.5"
                  >
                    Invite
                  </button>
                </div>
              )}
            </div>

            <div className="border border-border rounded overflow-hidden">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-border">
                    <th className="px-5 py-3.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground/45">
                      Member
                    </th>
                    <th className="px-5 py-3.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground/45">
                      Role
                    </th>
                    <th className="px-5 py-3.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground/45">
                      MFA
                    </th>
                    <th className="px-5 py-3.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground/45 text-right">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member) => (
                    <tr
                      key={member.id}
                      className="hover:bg-surface-2/25 transition-colors"
                    >
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded border border-border bg-card font-mono text-[10px] font-medium text-foreground">
                            {member.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="text-[11px] font-medium text-foreground">
                              {member.name}
                            </p>
                            <p className="text-[9.5px] text-muted-foreground/50 truncate w-[150px]">
                              {member.email}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        {editingRole === member.id ? (
                          <select
                            value={member.role}
                            onChange={(e) =>
                              updateMemberRole(member.id, e.target.value)
                            }
                            className="font-mono text-[9px] text-foreground bg-transparent"
                          >
                            <option value="admin">Admin</option>
                            <option value="member">Member</option>
                            <option value="interviewer">Interviewer</option>
                          </select>
                        ) : (
                          <span
                            className={cn(
                              "inline-flex items-center gap-1.5 px-2 py-0.5 rounded border font-mono text-[7px] uppercase tracking-[0.12em]",
                              member.role === "admin"
                                ? "border-success/40 bg-success/[0.05] text-success"
                                : member.role === "interviewer"
                                  ? "border-accent/40 bg-accent/[0.05] text-accent"
                                  : "border-border text-muted-foreground/50",
                            )}
                          >
                            {member.role}
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-4">
                        <span
                          className={cn(
                            "h-1.5 w-1.5 rounded-full",
                            member.mfaEnabled ? "bg-success" : "bg-border",
                          )}
                          aria-label={
                            member.mfaEnabled ? "MFA enabled" : "MFA disabled"
                          }
                        />
                      </td>
                      <td className="px-5 py-4 text-right">
                        {member.user_id === user?.id ? (
                          <span className="text-[9.5px] text-muted-foreground/40">
                            You
                          </span>
                        ) : isAdmin ? (
                          <div className="flex items-center gap-1.5">
                            {!editingRole || editingRole !== member.id ? (
                              <button
                                type="button"
                                onClick={() => setEditingRole(member.id)}
                                className="text-[9px] text-muted-foreground hover:text-foreground underline underline-offset-2"
                              >
                                Change role
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setEditingRole(null)}
                                className="text-[9px] text-destructive hover:text-destructive underline underline-offset-2"
                              >
                                Cancel
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => removeMember(member.id)}
                              className="text-[9px] text-destructive hover:text-destructive"
                            >
                              Remove
                            </button>
                          </div>
                        ) : null}
                      </td>
                    </tr>
                  ))}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground/40">
                        No members yet. Invite your first teammate.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>

        {/* ── Org settings (admin only) ─────────────────── */}
        {isAdmin && (
          <div className="lg:col-span-1">
            <section className="space-y-6">
              <div className="border border-border rounded p-5">
                <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
                  Organization name
                </p>
                <input
                  type="text"
                  defaultValue={organization?.name}
                  onBlur={(e) => updateOrgSettings("name", e.target.value)}
                  className="mt-1 input-base w-full"
                />
              </div>

              <div className="border border-border rounded p-5">
                <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
                  Primary color
                </p>
                <input
                  type="color"
                  defaultValue={
                    organization?.primary_color || "#154630"
                  }
                  onChange={(e) =>
                    updateOrgSettings("primary_color", e.target.value)
                  }
                  className="mt-1 h-8 w-full cursor-pointer"
                />
              </div>

              <div className="border border-border rounded p-5">
                <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
                  Plan
                </p>
                <p className="mt-1 font-mono text-[10px] text-muted-foreground/60">
                  {organization?.plan}
                </p>
                <p className="mt-1 text-[9px] text-muted-foreground/50">
                  Contact sales to upgrade
                </p>
              </div>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
