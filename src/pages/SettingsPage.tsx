import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  ArrowRight,
  Briefcase,
  Building2,
  CalendarDays,
  Gauge,
  Loader2,
  LogOut,
  Mail,
  Save,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

const EMPTY_PROFILE = { name: "", experience: "", target_role: "", target_company: "" };

export default function SettingsPage() {
  const { user, signOut } = useAuth();
  const [profile, setProfile] = useState(EMPTY_PROFILE);
  const [initial, setInitial] = useState(EMPTY_PROFILE);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;
    supabase
      .from("profiles")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        if (data) {
          const next = {
            name: data.name || "",
            experience: data.experience || "",
            target_role: data.target_role || "",
            target_company: data.target_company || "",
          };
          setProfile(next);
          setInitial(next);
        }
        setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [user]);

  const dirty = useMemo(() => JSON.stringify(profile) !== JSON.stringify(initial), [profile, initial]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(profile).eq("user_id", user.id);
    if (error) {
      toast.error(error.message);
    } else {
      setInitial(profile);
      toast.success("Profile saved.");
    }
    setSaving(false);
  };

  const rawName = profile.name?.trim();
  const emailLocal = user?.email?.split("@")[0];
  const userName = rawName && !rawName.includes("@") ? rawName : emailLocal || "Member";
  const initialLetter = (userName[0] || "U").toUpperCase();

  if (loading) {
    return (
      <div className="mx-auto max-w-[980px]">
        <div className="mb-9 border-b border-border pb-7">
          <div className="skeleton mb-4 h-2.5 w-16" />
          <div className="skeleton mb-3 h-9 w-40" />
          <div className="skeleton h-3 w-64" />
        </div>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
          <div className="space-y-6">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index}>
                <div className="skeleton mb-2.5 h-2.5 w-20" />
                <div className="skeleton h-10 w-full" />
              </div>
            ))}
          </div>
          <div className="skeleton h-64" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[980px]">
      <div className="mb-9 flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <span className="section-label">Account · Calibration</span>
          </div>
          <h1 className="text-display-lg text-foreground">Settings</h1>
          <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-muted-foreground">
            Your profile is used to calibrate interview questions and keep analytics relevant to
            the role you&apos;re actually targeting.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-4 pb-1">
          <span className="mono-label">{dirty ? "Unsaved changes" : "Up to date"}</span>
          <span className="h-3 w-px bg-border-strong" aria-hidden="true" />
          <span className="mono-label">Private</span>
        </div>
      </div>

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-14">
        <motion.section
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
          aria-label="Profile information"
        >
          <div className="flex items-baseline justify-between border-b border-border pb-3">
            <h2 className="text-headline text-foreground">Profile</h2>
            <span className="mono-label">Used only inside your account</span>
          </div>

          <div className="divide-y divide-border border-b border-border">
            <div className="py-5">
              <label htmlFor="settings-name" className="label-base">
                Full name
              </label>
              <input
                id="settings-name"
                value={profile.name}
                onChange={(e) => setProfile((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="Your name"
                autoComplete="name"
                className="input-base"
              />
            </div>

            <div className="grid gap-x-8 sm:grid-cols-2">
              <div className="py-5">
                <label htmlFor="settings-role" className="label-base">
                  <Briefcase className="h-3 w-3" /> Target role
                </label>
                <input
                  id="settings-role"
                  value={profile.target_role}
                  onChange={(e) => setProfile((prev) => ({ ...prev, target_role: e.target.value }))}
                  placeholder="Senior Frontend Engineer"
                  className="input-base"
                />
              </div>
              <div className="py-5">
                <label htmlFor="settings-company" className="label-base">
                  <Building2 className="h-3 w-3" /> Target company
                </label>
                <input
                  id="settings-company"
                  value={profile.target_company}
                  onChange={(e) =>
                    setProfile((prev) => ({ ...prev, target_company: e.target.value }))
                  }
                  placeholder="Google"
                  className="input-base"
                />
              </div>
            </div>

            <div className="py-5">
              <label htmlFor="settings-experience" className="label-base">
                Experience
              </label>
              <input
                id="settings-experience"
                value={profile.experience}
                onChange={(e) => setProfile((prev) => ({ ...prev, experience: e.target.value }))}
                placeholder="e.g. 4 years, backend platform teams"
                className="input-base"
              />
              <p className="helper-text">
                A sentence is enough — it&apos;s passed to the interviewer as context.
              </p>
            </div>

            <div className="py-5">
              <label htmlFor="settings-email" className="label-base">
                <Mail className="h-3 w-3" /> Email
              </label>
              <input
                id="settings-email"
                value={user?.email || ""}
                disabled
                className="input-base cursor-not-allowed opacity-50"
              />
              <p className="helper-text">Email changes are managed through your sign-in provider.</p>
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-3">
            <p className="font-mono text-[7.5px] uppercase tracking-[0.13em] text-muted-foreground/40">
              {dirty ? "Review before saving" : "All fields synced"}
            </p>
            <button
              type="button"
              onClick={save}
              disabled={saving || !dirty}
              className="btn-primary btn-sm gap-1.5"
            >
              {saving ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              {saving ? "Saving…" : "Save changes"}
            </button>
          </div>
        </motion.section>

        <aside>
          <section aria-label="Account summary">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-headline text-foreground">Account</h2>
              <span className="mono-label">Member</span>
            </div>

            <div className="flex items-center gap-4 border-b border-border py-5">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center border border-border-strong bg-card font-display text-[20px] leading-none text-foreground">
                {initialLetter}
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-[19px] leading-none tracking-[-0.02em] text-foreground">
                  {userName}
                </p>
                <p className="mt-1.5 truncate font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/45">
                  {user?.email}
                </p>
              </div>
            </div>

            <dl className="divide-y divide-border border-b border-border">
              <div className="flex items-baseline justify-between gap-3 py-3">
                <dt className="mono-label">Plan</dt>
                <dd className="flex items-center gap-2 font-mono text-[8px] uppercase tracking-[0.12em] text-primary">
                  <span className="h-1 w-1 bg-primary" aria-hidden="true" />
                  Full access
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-3 py-3">
                <dt className="mono-label">Member since</dt>
                <dd className="inline-flex items-center gap-1.5 text-[11px] text-secondary-foreground">
                  <CalendarDays className="h-3 w-3 text-muted-foreground/40" />
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString(undefined, {
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
            </dl>

            <button
              type="button"
              onClick={signOut}
              className="btn-secondary btn-sm mt-4 w-full justify-start gap-2 text-muted-foreground hover:text-destructive"
            >
              <LogOut className="h-3.5 w-3.5" />
              Sign out
            </button>
          </section>

          <section className="mt-9">
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-headline text-foreground">Quick links</h2>
              <span className="mono-label">Index</span>
            </div>
            <div className="divide-y divide-border border-b border-border">
              {[
                { to: "/usage", icon: Gauge, label: "Plan & usage", hint: "Fair-use limits" },
                {
                  to: "/history",
                  icon: CalendarDays,
                  label: "Session history",
                  hint: "Past interviews",
                },
              ].map((link, index) => (
                <Link
                  key={link.to}
                  to={link.to}
                  className="group flex items-center gap-4 py-4 transition-colors hover:bg-surface-2/25"
                >
                  <span className="font-mono text-[8px] tracking-[0.1em] text-accent/60">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="flex-1">
                    <span className="block font-display text-[17px] leading-none tracking-[-0.02em] text-foreground">
                      {link.label}
                    </span>
                    <span className="mt-1.5 block font-mono text-[7px] uppercase tracking-[0.12em] text-muted-foreground/45">
                      {link.hint}
                    </span>
                  </span>
                  <ArrowRight className="h-3 w-3 text-muted-foreground/25 transition-all group-hover:translate-x-0.5 group-hover:text-foreground" />
                </Link>
              ))}
            </div>
            <p className="mt-4 font-mono text-[7.5px] uppercase leading-[1.9] tracking-[0.12em] text-muted-foreground/40">
              Profile context shapes every generated question
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}
