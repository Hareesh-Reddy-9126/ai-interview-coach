import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Upload, FileText, Sparkles, Code2, Briefcase, GraduationCap, Loader2, Trash2, ArrowRight, AlertTriangle, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ResumeData {
  id: string; file_url: string; extracted_text: string | null; skills: string[] | null; technologies: string[] | null;
  projects: string[] | null; experience: string[] | null; education: string[] | null; interview_questions: string[] | null;
  analysis_status: string; created_at: string;
}

export default function ResumeAnalyzer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchLatestResume = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error: fetchErr } = await supabase.from("user_resumes").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).maybeSingle();
      if (fetchErr) throw fetchErr;
      setResume(data);
      if (data?.analysis_status === "analyzing") { setAnalyzing(true); retryAnalysis(data.id, data.file_url); }
    } catch (e: any) { console.error("Failed to fetch resume:", e); } finally { setLoading(false); }
  }, [user]);

  useEffect(() => { fetchLatestResume(); }, [fetchLatestResume]);

  const retryAnalysis = async (resumeId: string, filePath: string) => {
    setError(null); setAnalyzing(true);
    try {
      const { data, error: err } = await supabase.functions.invoke("analyze-resume", { body: { resume_id: resumeId, file_path: filePath } });
      if (err) throw err; if (data?.error) throw new Error(data.error);
      await fetchLatestResume(); toast.success("Resume analyzed!");
    } catch (e: any) { setError(e.message || "Analysis failed."); toast.error(e.message || "Analysis failed."); } finally { setAnalyzing(false); }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return; setError(null);
    if (file.type !== "application/pdf") { toast.error("PDF only"); return; }
    if (file.size > 5 * 1024 * 1024) { toast.error("Max 5MB"); return; }
    setUploading(true);
    try {
      const filePath = `${user.id}/${Date.now()}_${file.name}`;
      const { error: uploadErr } = await supabase.storage.from("resumes").upload(filePath, file);
      if (uploadErr) throw uploadErr;
      const { data: rec, error: insertErr } = await supabase.from("user_resumes").insert({ user_id: user.id, file_url: filePath, analysis_status: "analyzing" }).select().single();
      if (insertErr) throw insertErr;
      setResume(rec); setUploading(false); setAnalyzing(true);
      const { data, error: err } = await supabase.functions.invoke("analyze-resume", { body: { resume_id: rec.id, file_path: filePath } });
      if (err) throw err; if (data?.error) throw new Error(data.error);
      await fetchLatestResume(); toast.success("Resume analyzed!");
    } catch (e: any) { setError(e.message || "Upload failed."); toast.error(e.message || "Upload failed."); } finally { setUploading(false); setAnalyzing(false); }
  };

  const deleteResume = async () => {
    if (!resume || !user) return;
    try { await supabase.storage.from("resumes").remove([resume.file_url]); await supabase.from("user_resumes").delete().eq("id", resume.id); setResume(null); setError(null); toast.success("Deleted"); } catch { toast.error("Failed"); }
  };

  const startResumeInterview = () => {
    if (!resume) return;
    sessionStorage.setItem("resume_context", JSON.stringify({ skills: resume.skills, technologies: resume.technologies, projects: resume.projects, experience: resume.experience }));
    navigate("/interview?mode=resume");
  };

  if (loading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const isAnalyzed = resume?.analysis_status === "completed";
  const isFailed = resume?.analysis_status === "failed";

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-foreground tracking-tight">Resume Analyzer</h1>
        <p className="text-sm text-muted-foreground mt-2">Upload your resume for AI-powered interview preparation</p>
      </div>

      {error && (
        <div className="card-base p-4 border-destructive/20 flex items-center gap-4">
          <AlertTriangle className="h-5 w-5 text-destructive shrink-0" /><p className="text-sm text-destructive flex-1">{error}</p>
          {resume && <button onClick={() => retryAnalysis(resume.id, resume.file_url)} className="text-sm text-destructive font-semibold hover:underline">Retry</button>}
        </div>
      )}

      {!resume ? (
        <label className="card-interactive p-14 text-center cursor-pointer block border-dashed border-2">
          <input type="file" accept=".pdf" onChange={handleUpload} className="hidden" disabled={uploading} />
          {uploading ? <Loader2 className="h-10 w-10 text-primary mx-auto mb-4 animate-spin" /> : <Upload className="h-10 w-10 text-muted-foreground/40 mx-auto mb-4" />}
          <p className="text-base font-semibold text-foreground">{uploading ? "Uploading..." : "Drop your resume here"}</p>
          <p className="text-sm text-muted-foreground mt-1">or click to browse · PDF only · Max 5MB</p>
        </label>
      ) : (
        <div className="space-y-5">
          <div className="card-base p-5 flex items-center gap-4">
            <div className="h-11 w-11 rounded-xl bg-primary/10 flex items-center justify-center">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground truncate">{resume.file_url.split("/").pop()}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {new Date(resume.created_at).toLocaleDateString()} ·
                <span className={isAnalyzed ? " text-primary font-medium" : isFailed ? " text-destructive font-medium" : " text-warning font-medium"}> {analyzing ? "Analyzing..." : resume.analysis_status}</span>
              </p>
            </div>
            <div className="flex gap-2">
              {isFailed && <button onClick={() => retryAnalysis(resume.id, resume.file_url)} className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2 font-semibold"><RefreshCw className="h-4 w-4" /> Retry</button>}
              {isAnalyzed && <button onClick={startResumeInterview} className="btn-primary px-4 py-2 text-sm inline-flex items-center gap-2 font-semibold">Interview <ArrowRight className="h-4 w-4" /></button>}
              <button onClick={deleteResume} className="p-2 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"><Trash2 className="h-4 w-4" /></button>
            </div>
          </div>

          {analyzing && (
            <div className="card-base p-8 text-center">
              <Loader2 className="h-8 w-8 text-primary mx-auto mb-4 animate-spin" />
              <p className="text-base font-semibold text-foreground">Analyzing with AI...</p>
              <p className="text-sm text-muted-foreground mt-1">This may take up to 30 seconds</p>
            </div>
          )}

          {isAnalyzed && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: Code2, label: "Skills", data: resume.skills, tagClass: "tag-primary" },
                  { icon: Code2, label: "Technologies", data: resume.technologies, tagClass: "tag-accent" },
                ].map(({ icon: Icon, label, data, tagClass }) => (
                  <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
                    <div className="flex items-center gap-2.5 mb-4"><Icon className="h-4 w-4 text-primary" /><h3 className="text-sm font-bold text-foreground">{label}</h3></div>
                    <div className="flex flex-wrap gap-2">{(data || []).map((s, i) => <span key={i} className={`${tagClass} text-[11px]`}>{s}</span>)}{(!data?.length) && <p className="text-sm text-muted-foreground">None detected</p>}</div>
                  </motion.div>
                ))}
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {[
                  { icon: Briefcase, label: "Experience", data: resume.experience, dot: "bg-info" },
                  { icon: GraduationCap, label: "Education", data: resume.education, dot: "bg-warning" },
                ].map(({ icon: Icon, label, data, dot }) => (
                  <motion.div key={label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="card-base p-5">
                    <div className="flex items-center gap-2.5 mb-4"><Icon className="h-4 w-4 text-muted-foreground" /><h3 className="text-sm font-bold text-foreground">{label}</h3></div>
                    <ul className="space-y-2">{(data || []).map((s, i) => <li key={i} className="text-sm text-muted-foreground flex items-start gap-2.5"><span className={`h-2 w-2 rounded-full ${dot} mt-1.5 shrink-0`} />{s}</li>)}{(!data?.length) && <p className="text-sm text-muted-foreground">None detected</p>}</ul>
                  </motion.div>
                ))}
              </div>
              {resume.interview_questions?.length ? (
                <div className="card-base p-5">
                  <div className="flex items-center gap-2.5 mb-4"><Sparkles className="h-4 w-4 text-primary" /><h3 className="text-sm font-bold text-foreground">AI Interview Questions</h3></div>
                  <div className="space-y-2">{resume.interview_questions.map((q, i) => <div key={i} className="p-4 rounded-xl bg-secondary/50 text-sm text-foreground"><span className="text-primary font-bold">Q{i + 1}:</span> {q}</div>)}</div>
                  <button onClick={startResumeInterview} className="mt-5 w-full btn-primary py-3 flex items-center justify-center gap-2 font-semibold">Practice with AI <ArrowRight className="h-4 w-4" /></button>
                </div>
              ) : null}
              <label className="card-interactive p-4 text-center cursor-pointer block border-dashed border-2">
                <input type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
                <p className="text-sm text-muted-foreground font-medium">Upload a different resume</p>
              </label>
            </>
          )}
        </div>
      )}
    </div>
  );
}
