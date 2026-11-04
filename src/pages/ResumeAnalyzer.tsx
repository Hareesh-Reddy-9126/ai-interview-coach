import { useState, useEffect, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle,
  ArrowRight,
  Briefcase,
  Code2,
  FileText,
  GraduationCap,
  Layers,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Trash2,
  Upload,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { invokeFunction } from "@/lib/edge-functions";
import { cn, getErrorMessage } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useNavigate } from "react-router-dom";

interface ResumeData {
  id: string;
  file_url: string;
  extracted_text: string | null;
  skills: string[] | null;
  technologies: string[] | null;
  projects: string[] | null;
  experience: string[] | null;
  education: string[] | null;
  interview_questions: string[] | null;
  analysis_status: string;
  created_at: string;
}

function StatusTag({ status, analyzing }: { status: string; analyzing: boolean }) {
  if (analyzing || status === "analyzing") return <span className="tag-warning">Analyzing</span>;
  if (status === "failed") return <span className="tag-destructive">Failed</span>;
  if (status === "completed") return <span className="tag-success">Analyzed</span>;
  return <span className="tag-muted capitalize">{status}</span>;
}

function DetailCard({
  icon: Icon,
  title,
  count,
  children,
}: {
  icon: typeof Code2;
  title: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col border-t border-border pt-4">
      <div className="flex items-baseline justify-between pb-3">
        <div className="flex items-center gap-2.5">
          <Icon className="h-3.5 w-3.5 text-accent/80" strokeWidth={1.7} />
          <h2 className="font-display text-[21px] font-normal leading-none tracking-[-0.02em] text-foreground">
            {title}
          </h2>
        </div>
        {typeof count === "number" && (
          <span className="font-mono text-[8.5px] tabular text-muted-foreground/40">{count}</span>
        )}
      </div>
      <div className="flex-1 border-t border-border pt-3">{children}</div>
    </section>
  );
}

function EmptyLine({ label }: { label: string }) {
  return <p className="text-[11.5px] text-muted-foreground/50">No {label} detected.</p>;
}

export default function ResumeAnalyzer() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [resume, setResume] = useState<ResumeData | null>(null);
  const [uploading, setUploading] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const loadResume = useCallback(async (): Promise<ResumeData | null> => {
    if (!user) return null;
    const { data, error: fetchErr } = await supabase
      .from("user_resumes")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (fetchErr) throw fetchErr;
    return data;
  }, [user]);

  const refreshResume = useCallback(async () => {
    try {
      setResume(await loadResume());
    } catch (e) {
      console.error("Failed to fetch resume:", e);
    } finally {
      setLoading(false);
    }
  }, [loadResume]);

  const retryAnalysis = useCallback(
    async (resumeId: string, filePath: string) => {
      setError(null);
      setAnalyzing(true);
      try {
        await invokeFunction("analyze-resume", {
          body: { resume_id: resumeId, file_path: filePath },
          fallbackMessage: "Analysis failed.",
        });
        await refreshResume();
        toast.success("Resume analyzed.");
      } catch (e) {
        const message = getErrorMessage(e, "Analysis failed.");
        setError(message);
        toast.error(message);
      } finally {
        setAnalyzing(false);
      }
    },
    [refreshResume],
  );

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const data = await loadResume();
        if (cancelled) return;
        setResume(data);
        // Resume analysis was interrupted (tab closed / request lost) — retry once.
        if (data?.analysis_status === "analyzing") {
          setAnalyzing(true);
          void retryAnalysis(data.id, data.file_url);
        }
      } catch (e) {
        console.error("Failed to fetch resume:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [loadResume, retryAnalysis]);

  const processFile = useCallback(
    async (file: File) => {
      if (!user) return;
      setError(null);
      if (file.type !== "application/pdf") {
        toast.error("PDF files only.");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error("Maximum file size is 5MB.");
        return;
      }
      setUploading(true);
      try {
        const filePath = `${user.id}/${Date.now()}_${file.name}`;
        const { error: uploadErr } = await supabase.storage.from("resumes").upload(filePath, file);
        if (uploadErr) throw uploadErr;
        const { data: rec, error: insertErr } = await supabase
          .from("user_resumes")
          .insert({ user_id: user.id, file_url: filePath, analysis_status: "analyzing" })
          .select()
          .single();
        if (insertErr) throw insertErr;
        setResume(rec);
        setUploading(false);
        setAnalyzing(true);
        await invokeFunction("analyze-resume", {
          body: { resume_id: rec.id, file_path: filePath },
          fallbackMessage: "Upload failed.",
        });
        await refreshResume();
        toast.success("Resume analyzed.");
      } catch (e) {
        const message = getErrorMessage(e, "Upload failed.");
        setError(message);
        toast.error(message);
      } finally {
        setUploading(false);
        setAnalyzing(false);
      }
    },
    [user, refreshResume],
  );

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void processFile(file);
    e.target.value = "";
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    if (file) void processFile(file);
  };

  const deleteResume = async () => {
    if (!resume || !user) return;
    try {
      await supabase.storage.from("resumes").remove([resume.file_url]);
      await supabase.from("user_resumes").delete().eq("id", resume.id);
      setResume(null);
      setError(null);
      toast.success("Resume deleted.");
    } catch {
      toast.error("Could not delete the resume.");
    }
  };

  const startResumeInterview = () => {
    if (!resume) return;
    sessionStorage.setItem(
      "resume_context",
      JSON.stringify({
        skills: resume.skills,
        technologies: resume.technologies,
        projects: resume.projects,
        experience: resume.experience,
      }),
    );
    navigate("/interview?mode=resume");
  };

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground/40" />
      </div>
    );
  }

  const isAnalyzed = resume?.analysis_status === "completed";
  const isFailed = resume?.analysis_status === "failed";
  const fileName = resume?.file_url.split("/").pop() ?? "";

  return (
    <div className="mx-auto max-w-[1040px]">
      <div className="mb-8 flex flex-col gap-6 border-b border-border pb-7 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="mb-4 flex items-center gap-3">
            <span className="h-px w-7 bg-accent" aria-hidden="true" />
            <span className="section-label">Resume intelligence · PDF dossier</span>
          </div>
          <h1 className="text-display-lg text-foreground">Your resume, decoded.</h1>
          <p className="mt-4 max-w-xl text-[14px] leading-[1.7] text-muted-foreground">
            Extract skills, technologies and experience, then generate interview questions
            grounded in what you have actually shipped.
          </p>
        </div>
        {resume && (
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn-secondary btn-sm w-fit gap-1.5"
            disabled={uploading || analyzing}
          >
            <Upload className="h-3.5 w-3.5" />
            Replace resume
          </button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept=".pdf,application/pdf"
        onChange={handleUpload}
        className="hidden"
        disabled={uploading}
      />

      {error && (
        <div className="mb-4 flex items-start gap-3 border border-destructive/30 bg-destructive/[0.05] px-4 py-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
          <p className="flex-1 text-[12.5px] leading-5 text-destructive">{error}</p>
          {resume && (
            <button
              type="button"
              onClick={() => retryAnalysis(resume.id, resume.file_url)}
              className="shrink-0 font-mono text-[9px] uppercase tracking-[0.12em] text-destructive underline underline-offset-4 hover:no-underline"
            >
              Retry
            </button>
          )}
        </div>
      )}

      {!resume ? (
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] lg:gap-14">
          <section
            onDragOver={(e) => {
              e.preventDefault();
              setDragActive(true);
            }}
            onDragLeave={() => setDragActive(false)}
            onDrop={handleDrop}
            className={cn(
              "relative flex min-h-[360px] flex-col justify-between border border-dashed border-border-strong bg-card/40 p-8 transition-colors sm:p-10",
              dragActive && "border-solid border-accent bg-accent/[0.045]",
            )}
          >
            <span
              className="pointer-events-none absolute inset-4 border border-border/40"
              aria-hidden="true"
            />

            <div className="relative flex items-start justify-between">
              <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">
                Document intake
              </span>
              <span className="font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/40">
                PDF · 5MB max
              </span>
            </div>

            <div className="relative py-12 text-center">
              <span className="mx-auto flex h-12 w-12 items-center justify-center border border-border-strong bg-background text-muted-foreground">
                {uploading ? (
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                ) : (
                  <Upload className="h-4 w-4" strokeWidth={1.7} />
                )}
              </span>
              <h2 className="mt-6 font-display text-[24px] font-light leading-[1.08] tracking-[-0.03em] text-foreground sm:text-[26px]">
                {uploading
                  ? "Uploading your resume…"
                  : dragActive
                    ? "Drop to upload"
                    : "Place your resume here."}
              </h2>
              <p className="mx-auto mt-3 max-w-xs text-[12px] leading-[1.7] text-muted-foreground">
                A single PDF is all we need. Analysis takes roughly twenty to thirty seconds.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="btn-primary btn-sm mt-6 gap-1.5"
              >
                <Upload className="h-3.5 w-3.5" />
                Choose PDF
              </button>
              <p className="mt-4 font-mono text-[7.5px] uppercase tracking-[0.14em] text-muted-foreground/40">
                or drag and drop it here
              </p>
            </div>

            <div className="relative flex items-start gap-2.5 border-t border-border pt-4">
              <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary/60" />
              <p className="max-w-sm text-[10.5px] leading-[1.6] text-muted-foreground/60">
                Stored in a private bucket. Only your account can read it, and you can delete it
                at any time.
              </p>
            </div>
          </section>

          <aside>
            <div className="flex items-baseline justify-between border-b border-border pb-3">
              <h2 className="text-headline text-foreground">What happens next</h2>
              <span className="mono-label">Three steps</span>
            </div>
            <ol className="divide-y divide-border border-b border-border">
              {[
                {
                  title: "Parse the document",
                  description: "Text is extracted and structured into skills, technologies and roles.",
                },
                {
                  title: "Map your experience",
                  description: "Projects and roles become the raw material for tailored questions.",
                },
                {
                  title: "Generate your question set",
                  description: "Practice questions target what you claim to know — and what you don't.",
                },
              ].map((step, index) => (
                <li key={step.title} className="flex gap-4 py-5">
                  <span className="font-display text-[22px] font-light leading-none tracking-[-0.03em] tabular text-muted-foreground/30">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <div>
                    <p className="font-display text-[17px] leading-none tracking-[-0.02em] text-foreground">
                      {step.title}
                    </p>
                    <p className="mt-2 text-[11.5px] leading-[1.7] text-muted-foreground/75">
                      {step.description}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
            <p className="mt-4 font-mono text-[7.5px] uppercase leading-[1.9] tracking-[0.12em] text-muted-foreground/40">
              Your resume never leaves your account.
            </p>
          </aside>
        </div>
      ) : (
        <div className="space-y-7">
          {/* File row */}
          <div className="flex flex-col gap-4 border-y border-border py-4 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-4">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center border border-border-strong bg-card text-primary">
                <FileText className="h-4 w-4" strokeWidth={1.7} />
              </span>
              <div className="min-w-0">
                <p className="truncate font-display text-[18px] leading-none tracking-[-0.02em] text-foreground">
                  {fileName}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <StatusTag status={resume.analysis_status} analyzing={analyzing} />
                  <span className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-muted-foreground/45">
                    Uploaded{" "}
                    {new Date(resume.created_at).toLocaleDateString(undefined, {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              {isFailed && (
                <button
                  type="button"
                  onClick={() => retryAnalysis(resume.id, resume.file_url)}
                  className="btn-secondary btn-sm gap-1.5"
                  disabled={analyzing}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Retry
                </button>
              )}
              {isAnalyzed && (
                <button
                  type="button"
                  onClick={startResumeInterview}
                  className="btn-primary btn-sm gap-1.5"
                >
                  Practice with AI
                  <ArrowRight className="h-3.5 w-3.5" />
                </button>
              )}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="btn-icon"
                aria-label="Upload a different resume"
                title="Upload a different resume"
                disabled={uploading}
              >
                <Upload className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={deleteResume}
                className="btn-icon hover:text-destructive"
                aria-label="Delete resume"
                title="Delete resume"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>

          {(analyzing || resume.analysis_status === "analyzing") && (
            <div className="border-y border-border py-14 text-center">
              <p className="mono-label text-accent">Reading your resume</p>
              <p className="mx-auto mt-3 max-w-sm font-display text-[24px] font-light leading-[1.35] tracking-[-0.025em] text-foreground">
                Extracting structure, skills and experience.
              </p>
              <p className="mt-2 text-[11.5px] text-muted-foreground/60">
                This usually takes under thirty seconds.
              </p>
              <div className="mx-auto mt-7 flex max-w-md items-center justify-center gap-6">
                {["Parsing", "Structuring", "Writing questions"].map((label, index) => (
                  <span
                    key={label}
                    className={cn(
                      "flex items-center gap-2 font-mono text-[7.5px] uppercase tracking-[0.14em]",
                      index === 0 ? "text-foreground" : "text-muted-foreground/35",
                    )}
                  >
                    <span
                      className={cn(
                        "h-1 w-1",
                        index === 0 ? "animate-pulse bg-accent" : "bg-border-strong",
                      )}
                      aria-hidden="true"
                    />
                    {label}
                  </span>
                ))}
              </div>
            </div>
          )}

          {isAnalyzed && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
              className="space-y-9"
            >
              <div className="grid gap-x-12 gap-y-8 md:grid-cols-2">
                <DetailCard icon={Code2} title="Skills" count={(resume.skills || []).length}>
                  {(resume.skills || []).length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(resume.skills || []).map((skill, index) => (
                        <span key={index} className="tag-primary">
                          {skill}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <EmptyLine label="skills" />
                  )}
                </DetailCard>

                <DetailCard
                  icon={Layers}
                  title="Technologies"
                  count={(resume.technologies || []).length}
                >
                  {(resume.technologies || []).length ? (
                    <div className="flex flex-wrap gap-1.5">
                      {(resume.technologies || []).map((technology, index) => (
                        <span key={index} className="tag-accent">
                          {technology}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <EmptyLine label="technologies" />
                  )}
                </DetailCard>

                <DetailCard
                  icon={Briefcase}
                  title="Experience"
                  count={(resume.experience || []).length}
                >
                  {(resume.experience || []).length ? (
                    <ul className="space-y-2.5">
                      {(resume.experience || []).map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-[12px] leading-5 text-secondary-foreground"
                        >
                          <span className="mt-[9px] h-px w-2.5 shrink-0 bg-accent/70" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyLine label="experience" />
                  )}
                </DetailCard>

                <DetailCard
                  icon={GraduationCap}
                  title="Education"
                  count={(resume.education || []).length}
                >
                  {(resume.education || []).length ? (
                    <ul className="space-y-2.5">
                      {(resume.education || []).map((item, index) => (
                        <li
                          key={index}
                          className="flex items-start gap-3 text-[12px] leading-5 text-secondary-foreground"
                        >
                          <span className="mt-[9px] h-px w-2.5 shrink-0 bg-border-strong" />
                          {item}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <EmptyLine label="education" />
                  )}
                </DetailCard>
              </div>

              {resume.interview_questions?.length ? (
                <section>
                  <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-border pb-3">
                    <div className="flex items-baseline gap-3">
                      <span className="font-mono text-[8px] uppercase tracking-[0.16em] text-accent">
                        Generated
                      </span>
                      <h2 className="text-headline text-foreground">
                        Questions built from your resume
                      </h2>
                    </div>
                    <span className="mono-label">
                      {resume.interview_questions.length} questions
                    </span>
                  </div>
                  <ol className="divide-y divide-border border-b border-border">
                    {resume.interview_questions.map((question, index) => (
                      <li key={index} className="flex gap-5 py-4">
                        <span className="pt-0.5 font-mono text-[8.5px] tracking-[0.1em] text-accent/85">
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <p className="font-display text-[17px] font-light leading-[1.5] tracking-[-0.015em] text-secondary-foreground">
                          {question}
                        </p>
                      </li>
                    ))}
                  </ol>
                  <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-[10.5px] leading-[1.7] text-muted-foreground/50">
                      Questions use your projects and technologies as context.
                    </p>
                    <button
                      type="button"
                      onClick={startResumeInterview}
                      className="btn-primary btn-sm w-fit gap-1.5"
                    >
                      Start resume interview
                      <ArrowRight className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </section>
              ) : null}
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
