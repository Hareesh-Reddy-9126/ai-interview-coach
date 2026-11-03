import { useCallback, useEffect, useState } from "react";
import { Loader2, Shield, UserPlus, Users } from "lucide-react";
import { useOrg } from "@/hooks/useOrg";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  orgApi,
  type OrgMemberRow,
  type OrgOverview,
} from "@/lib/org-api";

function initials(value: string) {
  const cleaned = value.trim();
  if (!cleaned) return "?";
  return cleaned.slice(0, 1).toUpperCase();
}

function roleLabel(role: string) {
  if (role === "admin") return "Admin";
  if (role === "interviewer") return "Interviewer";
  return "Member";
}

const EMPTY_OVERVIEW: OrgOverview = {
  members: 0,
  active_members: 0,
  pending_invites: 0,
  interviews_completed: 0,
  avg_score: 0,
  sessions_last_30d: 0,
};

export default function OrgPage() {
  const {
    isAdmin,
    isMember,
    loading,
    organization,
    refreshMembership,
    createOrganization,
  } = useOrg();
  const { user } = useAuth();

  const [members, setMembers] = useState<OrgMemberRow[]>([]);
  const [overview, setOverview] = useState<OrgOverview>(EMPTY_OVERVIEW);
  const [memberLoading, setMemberLoading] = useState(false);
  const [orgLoading, setOrgLoading] = useState(false);
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [newMemberEmail, setNewMemberEmail] = useState("");
  const [newMemberRole, setNewMemberRole] = useState("member");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [newOrgName, setNewOrgName] = useState("");
  const [creatingOrg, setCreatingOrg] = useState(false);

  const loadMembers = useCallback(async () => {
    if (!organization?.id) return;
    setMemberLoading(true);
    try {
      const { data, error } = await orgApi.listMembers(organization.id);
      if (error) throw error;
      setMembers(data ?? []);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to load members.");
      setMembers([]);
    } finally {
      setMemberLoading(false);
    }
  }, [organization?.id]);

  const loadOverview = useCallback(async () => {
    if (!organization?.id) return;
    try {
      const { data, error } = await orgApi.getOverview(organization.id);
      if (error) throw error;
      if (data) setOverview(data);
    } catch {
      setOverview(EMPTY_OVERVIEW);
    }
  }, [organization?.id]);

  useEffect(() => {
    if (!organization?.id) {
      setMembers([]);
      setOverview(EMPTY_OVERVIEW);
      return;
    }
    void loadMembers();
    void loadOverview();
  }, [organization?.id, loadMembers, loadOverview]);

  const handleCreateOrganization = async (event: React.FormEvent) => {
    event.preventDefault();
    if (newOrgName.trim().length < 2) return;
    setCreatingOrg(true);
    try {
      const { error } = await createOrganization(newOrgName.trim());
      if (error) throw error;
      toast.success("Workspace created. You are the first admin.");
      setNewOrgName("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create workspace.");
    } finally {
      setCreatingOrg(false);
    }
  };

  const updateMemberRole = async (memberId: string, newRole: string) => {
    setEditingRole(memberId);
    try {
      const { error } = await orgApi.updateMemberRole(memberId, newRole);
      if (error) throw error;
      toast.success("Role updated.");
      await Promise.all([loadMembers(), loadOverview()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update role.");
    } finally {
      setEditingRole(null);
    }
  };

  const removeMember = async (member: OrgMemberRow) => {
    const label = member.name || member.email || "this member";
    if (!confirm(`Remove ${label} from the organization?`)) return;
    try {
      const { error } = await orgApi.removeMember(member.id);
      if (error) throw error;
      toast.success(member.status === "invited" ? "Invitation revoked." : "Member removed.");
      await Promise.all([loadMembers(), loadOverview()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to remove member.");
    }
  };

  const inviteMember = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!organization?.id || !newMemberEmail.trim()) return;
    setInviteLoading(true);
    try {
      const { error } = await orgApi.inviteMember(
        organization.id,
        newMemberEmail.trim(),
        newMemberRole,
      );
      if (error) throw error;
      toast.success("Invitation recorded. It activates when they sign in with that email.");
      setNewMemberEmail("");
      await Promise.all([loadMembers(), loadOverview()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to send invitation.");
    } finally {
      setInviteLoading(false);
    }
  };

  const updateOrgSettings = async (field: "name" | "primary_color", value: string) => {
    if (!organization?.id) return;
    setOrgLoading(true);
    try {
      const { error } = await orgApi.updateOrganization(organization.id, { [field]: value });
      if (error) throw error;
      toast.success("Organization settings updated.");
      await refreshMembership();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update settings.");
    } finally {
      setOrgLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isMember) {
    return (
      <div className="mx-auto max-w-[760px]">
        <div className="mb-9 border-b border-border pb-7">
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <span className="section-label">Organization · New workspace</span>
          </div>
          <h1 className="text-display-lg text-foreground">Create the room.</h1>
          <p className="mt-4 max-w-xl text-[13.5px] leading-[1.75] text-muted-foreground">
            Set up a shared workspace for a cohort, a team or a hiring loop. You become the
            first admin; invitations are addressed to an email and activate when that person
            signs in.
          </p>
        </div>

        <div className="grid border border-border-strong bg-card lg:grid-cols-[1.1fr_0.9fr]">
          <form onSubmit={handleCreateOrganization} className="p-7 md:p-10">
            <label htmlFor="org-name" className="label-base">
              Organization name
            </label>
            <input
              id="org-name"
              value={newOrgName}
              onChange={(event) => setNewOrgName(event.target.value)}
              placeholder="Northwind Engineering"
              minLength={2}
              maxLength={80}
              required
              className="input-base"
              autoComplete="organization"
            />
            <p className="helper-text">
              A URL slug is generated automatically. It can be changed later.
            </p>

            <button
              type="submit"
              disabled={creatingOrg || newOrgName.trim().length < 2}
              className="btn-primary btn-lg mt-7 w-full gap-2"
            >
              {creatingOrg ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Creating workspace…
                </>
              ) : (
                <>
                  Create workspace
                  <UserPlus className="h-4 w-4" strokeWidth={1.6} />
                </>
              )}
            </button>
          </form>

          <div className="border-t border-border bg-sidebar p-7 text-sidebar-accent-foreground lg:border-l lg:border-t-0 md:p-10">
            <span className="font-mono text-[7.5px] uppercase tracking-[0.18em] text-sidebar-primary">
              What you get
            </span>
            <ul className="mt-6 space-y-4">
              {[
                ["Owner role", "You are the first admin and cannot be locked out."],
                ["Email invitations", "Invite by address; the seat activates on sign-in."],
                ["Aggregate readiness", "Completed sessions roll up without exposing answers."],
                ["Per-workspace brand", "Name and accent are stored with the organization."],
              ].map(([title, body]) => (
                <li key={title} className="border-t border-sidebar-border pt-4 first:border-t-0 first:pt-0">
                  <p className="font-display text-[16px] leading-none text-[hsl(var(--sidebar-accent-foreground))]">
                    {title}
                  </p>
                  <p className="mt-2 text-[11.5px] leading-[1.7] text-sidebar-foreground/60">
                    {body}
                  </p>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1280px]">
      <div className="mb-9 flex flex-col gap-4 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <span className="section-label">Organization · {organization?.plan}</span>
          </div>
          <h1 className="text-display-lg text-foreground">{organization?.name}</h1>
          <p className="mt-2 max-w-xl text-[13.5px] leading-[1.7] text-muted-foreground">
            Team workspace for shared interviews, aggregate readiness and access control.
            {organization?.slug && (
              <span className="ml-2 font-mono text-[10px] text-muted-foreground/40">
                /org/{organization.slug}
              </span>
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 pt-4 sm:pt-0">
          <button
            type="button"
            onClick={() => {
              void Promise.all([refreshMembership(), loadMembers(), loadOverview()]);
            }}
            disabled={orgLoading || memberLoading}
            className="btn-secondary btn-sm gap-1.5"
          >
            {orgLoading || memberLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Users className="h-3.5 w-3.5" strokeWidth={1.6} />
            )}
            Refresh
          </button>
        </div>
      </div>

      <div className="grid gap-8 lg:grid-cols-4">
        <div className="space-y-6 lg:col-span-1">
          {[
            ["Active seats", overview.active_members, "Members with access"],
            ["Pending invites", overview.pending_invites, "Activate on sign-in"],
            ["Interviews", overview.interviews_completed, "Completed sessions"],
            ["Team average", `${overview.avg_score}%`, "Across completed sessions"],
          ].map(([label, value, note]) => (
            <div key={label} className="border border-border p-5">
              <p className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/45">
                {label}
              </p>
              <p className="mt-1 font-display text-[32px] font-light leading-none tracking-[-0.03em] text-foreground">
                {value}
              </p>
              <p className="mt-2 text-[11px] text-muted-foreground/60">{note}</p>
            </div>
          ))}
        </div>

        <div className="lg:col-span-3">
          <section className="space-y-5">
            <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-end">
              <div>
                <h2 className="font-display text-[18px] font-light leading-none tracking-[-0.02em] text-foreground">
                  Team members
                </h2>
                <p className="mt-1 text-[10px] text-muted-foreground/50">
                  {overview.active_members} active · {overview.pending_invites} pending
                </p>
              </div>

              {isAdmin && (
                <form onSubmit={inviteMember} className="flex flex-wrap items-end gap-2">
                  <div>
                    <label htmlFor="invite-email" className="sr-only">
                      Teammate email
                    </label>
                    <input
                      id="invite-email"
                      type="email"
                      value={newMemberEmail}
                      onChange={(event) => setNewMemberEmail(event.target.value)}
                      placeholder="email@company.com"
                      className="input-base h-9 w-[210px]"
                      autoComplete="email"
                    />
                  </div>
                  <div>
                    <label htmlFor="invite-role" className="sr-only">
                      Role
                    </label>
                    <select
                      id="invite-role"
                      value={newMemberRole}
                      onChange={(event) => setNewMemberRole(event.target.value)}
                      className="input-base h-9 w-[125px]"
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="interviewer">Interviewer</option>
                    </select>
                  </div>
                  <button
                    type="submit"
                    disabled={inviteLoading || !newMemberEmail.trim()}
                    className="btn-secondary btn-sm gap-1.5"
                  >
                    {inviteLoading ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <UserPlus className="h-3 w-3" strokeWidth={1.7} />
                    )}
                    Invite
                  </button>
                </form>
              )}
            </div>

            <div className="overflow-hidden border border-border">
              <table className="w-full border-collapse text-left">
                <thead>
                  <tr className="border-b border-border">
                    {["Member", "Role", "MFA", "Actions"].map((label) => (
                      <th
                        key={label}
                        className={cn(
                          "px-5 py-3.5 font-mono text-[8px] uppercase tracking-[0.14em] text-muted-foreground/45",
                          label === "Actions" && "text-right",
                        )}
                      >
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {members.map((member) => {
                    const displayName = member.name || member.email || "Invited member";
                    return (
                      <tr key={member.id} className="transition-colors hover:bg-surface-2/40">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-3">
                            <div className="flex h-8 w-8 shrink-0 items-center justify-center border border-border bg-card font-mono text-[10px] font-medium text-foreground">
                              {initials(displayName)}
                            </div>
                            <div className="min-w-0">
                              <p className="truncate text-[11px] font-medium text-foreground">
                                {displayName}
                              </p>
                              <p className="w-[180px] truncate text-[9.5px] text-muted-foreground/50">
                                {member.email || member.invited_email || "—"}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-4">
                          {editingRole === member.id ? (
                            <select
                              value={member.role}
                              onChange={(event) => updateMemberRole(member.id, event.target.value)}
                              className="bg-transparent font-mono text-[9px] text-foreground"
                              autoFocus
                            >
                              <option value="admin">Admin</option>
                              <option value="member">Member</option>
                              <option value="interviewer">Interviewer</option>
                            </select>
                          ) : (
                            <span
                              className={cn(
                                "inline-flex items-center gap-1.5 border px-2 py-0.5 font-mono text-[7px] uppercase tracking-[0.12em]",
                                member.status === "invited"
                                  ? "border-border text-muted-foreground/50"
                                  : member.role === "admin"
                                    ? "border-success/40 bg-success/[0.05] text-success"
                                    : member.role === "interviewer"
                                      ? "border-accent/40 bg-accent/[0.05] text-accent"
                                      : "border-border text-muted-foreground/50",
                              )}
                            >
                              {member.status === "invited" ? "Invited" : roleLabel(member.role)}
                            </span>
                          )}
                        </td>
                        <td className="px-5 py-4">
                          <span
                            className={cn(
                              "inline-block h-1.5 w-1.5",
                              member.mfa_enabled ? "bg-success" : "bg-border",
                            )}
                            aria-label={member.mfa_enabled ? "MFA enabled" : "MFA disabled"}
                          />
                        </td>
                        <td className="px-5 py-4 text-right">
                          {member.user_id === user?.id ? (
                            <span className="text-[9.5px] text-muted-foreground/40">You</span>
                          ) : isAdmin ? (
                            <div className="flex items-center justify-end gap-3">
                              {editingRole === member.id ? (
                                <button
                                  type="button"
                                  onClick={() => setEditingRole(null)}
                                  className="text-[9px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                >
                                  Cancel
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => setEditingRole(member.id)}
                                  className="text-[9px] text-muted-foreground underline underline-offset-2 hover:text-foreground"
                                >
                                  Change role
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => removeMember(member)}
                                className="text-[9px] text-destructive underline-offset-2 hover:underline"
                              >
                                {member.status === "invited" ? "Revoke" : "Remove"}
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                  {members.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-5 py-10 text-center text-muted-foreground/40">
                        {memberLoading ? "Loading members…" : "No members yet."}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <p className="font-mono text-[7.5px] uppercase leading-[1.8] tracking-[0.12em] text-muted-foreground/40">
              Invitations activate when the address signs in · Answers and resumes are never
              visible to other members
            </p>
          </section>

          {isAdmin && (
            <section className="mt-10 border-t border-border pt-8">
              <div className="mb-5 flex items-center gap-3">
                <Shield className="h-3.5 w-3.5 text-accent" strokeWidth={1.6} />
                <span className="section-label">Workspace settings</span>
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="border border-border p-5">
                  <label htmlFor="org-display-name" className="label-base">
                    Organization name
                  </label>
                  <input
                    id="org-display-name"
                    type="text"
                    defaultValue={organization?.name}
                    onBlur={(event) => {
                      const value = event.target.value.trim();
                      if (value && value !== organization?.name) {
                        void updateOrgSettings("name", value);
                      }
                    }}
                    className="input-base"
                  />
                  <p className="helper-text">Visible to every member of this workspace.</p>
                </div>

                <div className="border border-border p-5">
                  <label htmlFor="org-color" className="label-base">
                    Workspace accent
                  </label>
                  <div className="flex items-center gap-3">
                    <input
                      id="org-color"
                      type="color"
                      defaultValue={organization?.primary_color || "#154630"}
                      onChange={(event) => {
                        void updateOrgSettings("primary_color", event.target.value);
                      }}
                      className="h-9 w-14 cursor-pointer border border-border bg-transparent p-0.5"
                    />
                    <span className="font-mono text-[10px] text-muted-foreground/60">
                      {organization?.primary_color || "#154630"}
                    </span>
                  </div>
                  <p className="helper-text">Stored per workspace for future white-labelling.</p>
                </div>
              </div>

              <p className="mt-4 font-mono text-[7.5px] uppercase tracking-[0.13em] text-muted-foreground/40">
                Plan: {organization?.plan} · SSO configuration schema is present; callback
                testing requires an external identity provider
              </p>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
