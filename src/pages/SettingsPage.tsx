import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { User, Mail, Briefcase, Building2, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export default function SettingsPage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState({ name: "", experience: "", target_role: "", target_company: "" });
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("*").eq("user_id", user.id).single()
      .then(({ data }) => {
        if (data) setProfile({ name: data.name || "", experience: data.experience || "", target_role: data.target_role || "", target_company: data.target_company || "" });
        setLoading(false);
      });
  }, [user]);

  const save = async () => {
    if (!user) return;
    setSaving(true);
    const { error } = await supabase.from("profiles").update(profile).eq("user_id", user.id);
    if (error) toast.error(error.message); else toast.success("Profile saved!");
    setSaving(false);
  };

  if (loading) return (
    <div className="max-w-lg mx-auto space-y-6">
      <div><div className="skeleton h-7 w-24 mb-2" /><div className="skeleton h-4 w-36" /></div>
      <div className="card-base p-6 space-y-5">{Array.from({ length: 4 }).map((_, i) => <div key={i}><div className="skeleton h-3 w-16 mb-2" /><div className="skeleton h-10 w-full rounded-lg" /></div>)}</div>
    </div>
  );

  return (
    <div className="max-w-lg mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Settings</h1>
        <p className="text-sm text-muted-foreground mt-2">Manage your profile and preferences</p>
      </div>

      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-base p-6 space-y-5">
        <h3 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.12em]">Profile Information</h3>

        {[
          { icon: User, label: "Full Name", key: "name" as const, placeholder: "Your name" },
          { icon: Briefcase, label: "Target Role", key: "target_role" as const, placeholder: "e.g. Senior Frontend Engineer" },
          { icon: Building2, label: "Target Company", key: "target_company" as const, placeholder: "e.g. Google" },
        ].map(({ icon: Icon, label, key, placeholder }) => (
          <div key={key}>
            <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</label>
            <input value={profile[key]} onChange={e => setProfile(p => ({ ...p, [key]: e.target.value }))} placeholder={placeholder} className="input-base" />
          </div>
        ))}

        <div>
          <label className="text-xs font-semibold text-muted-foreground mb-1.5 flex items-center gap-2"><Mail className="h-3.5 w-3.5" /> Email</label>
          <input value={user?.email || ""} disabled className="input-base opacity-40 cursor-not-allowed" />
        </div>

        <button onClick={save} disabled={saving} className="btn-primary px-5 py-2.5 inline-flex items-center gap-2 disabled:opacity-50 font-semibold">
          {saving ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <><Save className="h-4 w-4" /> Save Changes</>}
        </button>
      </motion.div>
    </div>
  );
}
