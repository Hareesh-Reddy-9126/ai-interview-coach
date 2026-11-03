import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ArrowRight,
  Code2,
  CornerDownLeft,
  FileText,
  Mic,
  Search,
  Target,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { allNavItems } from "@/lib/navigation";
import { cn } from "@/lib/utils";

interface PaletteItem {
  label: string;
  description: string;
  to: string;
  icon: LucideIcon;
  keywords?: string[];
}

const quickActions: PaletteItem[] = [
  {
    label: "Start a mock interview",
    description: "Live, adaptive questions with scored feedback",
    to: "/interview",
    icon: Mic,
    keywords: ["new", "session", "ai"],
  },
  {
    label: "Behavioral drill",
    description: "STAR-format questions on impact and conflict",
    to: "/interview?focus=Behavioral&difficulty=Medium",
    icon: Target,
    keywords: ["behavioral", "star"],
  },
  {
    label: "System design round",
    description: "Architecture prompts with trade-off review",
    to: "/interview?focus=System%20Design&difficulty=Hard",
    icon: Target,
    keywords: ["system", "design", "architecture"],
  },
  {
    label: "Solve a coding problem",
    description: "Monaco editor, tests and AI code review",
    to: "/coding",
    icon: Code2,
    keywords: ["algorithm", "challenge"],
  },
  {
    label: "Analyze a resume",
    description: "Extract skills and generate tailored questions",
    to: "/resume",
    icon: FileText,
    keywords: ["cv", "upload"],
  },
];

export function CommandPalette({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (item: PaletteItem) =>
      !q ||
      item.label.toLowerCase().includes(q) ||
      item.description.toLowerCase().includes(q) ||
      (item.keywords ?? []).some((keyword) => keyword.includes(q));

    return [
      { label: "Go to", items: allNavItems.filter(match) },
      { label: "Start something", items: quickActions.filter(match) },
    ].filter((group) => group.items.length > 0);
  }, [query]);

  const flatItems = useMemo(() => groups.flatMap((group) => group.items), [groups]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIndex(0);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 40);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.clearTimeout(focusTimer);
    };
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  useEffect(() => {
    if (!open) return;
    const el = document.getElementById(`palette-item-${activeIndex}`);
    el?.scrollIntoView({ block: "nearest" });
  }, [activeIndex, open]);

  const run = (to: string) => {
    onOpenChange(false);
    navigate(to);
  };

  const onKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === "Escape") {
      event.preventDefault();
      onOpenChange(false);
      return;
    }
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((index) => (flatItems.length ? (index + 1) % flatItems.length : 0));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((index) =>
        flatItems.length ? (index - 1 + flatItems.length) % flatItems.length : 0,
      );
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      const item = flatItems[activeIndex];
      if (item) run(item.to);
    }
  };

  let runningIndex = -1;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-start justify-center p-4 pt-[11vh]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.14 }}
        >
          <div
            className="absolute inset-0 bg-[hsl(var(--foreground)/0.25)]"
            onClick={() => onOpenChange(false)}
            aria-hidden="true"
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Command palette"
            initial={{ opacity: 0, y: -10, scale: 0.985 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.99 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="relative w-full max-w-[580px] overflow-hidden border border-[hsl(var(--surface-border))] bg-[hsl(var(--surface))]"
            onKeyDown={onKeyDown}
          >
            <div className="border-b border-border px-4">
              <div className="flex items-center gap-3 h-[56px]">
                <Search className="h-4 w-4 shrink-0 text-muted-foreground/60" aria-hidden="true" />
                <input
                  ref={inputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search pages, actions, practice modes…"
                  aria-label="Search commands"
                  className="h-[52px] flex-1 bg-transparent text-[13.5px] text-foreground outline-none placeholder:text-muted-foreground/40"
                />
                <kbd className="hidden mono-label border border-border bg-card px-1.5 py-0.5 sm:block">
                  ESC
                </kbd>
              </div>
            </div>

            <div className="max-h-[min(52vh,360px)] overflow-y-auto p-1">
              {flatItems.length === 0 ? (
                <div className="px-4 py-12 text-center">
                  <p className="text-[13px] font-medium text-foreground">No results for "{query}"</p>
                  <p className="mt-1 mono-label text-muted-foreground">
                    Try a page name, a topic, or an action.
                  </p>
                </div>
              ) : (
                groups.map((group) => (
                  <div key={group.label} className="mb-1 last:mb-0">
                    <p className="px-2 pb-1 pt-1.5 mono-label text-muted-foreground/50">
                      {group.label}
                    </p>
                    {group.items.map((item) => {
                      runningIndex += 1;
                      const index = runningIndex;
                      const active = index === activeIndex;
                      return (
                        <button
                          key={`${group.label}-${item.to}-${item.label}`}
                          id={`palette-item-${index}`}
                          type="button"
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => run(item.to)}
                          className={cn(
                            "flex w-full items-center gap-3 px-2.5 py-2.5 text-left transition-colors",
                            active ? "bg-surface-2" : "hover:bg-surface-2/50",
                          )}
                        >
                          <span
                            className={cn(
                              "flex h-8 w-8 shrink-0 items-center justify-center border",
                              active
                                ? "border-primary/30 bg-primary/10 text-primary"
                                : "border-border bg-surface-2 text-muted-foreground",
                            )}
                          >
                            <item.icon className="h-3.5 w-3.5" />
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-[13px] font-medium text-foreground">
                              {item.label}
                            </span>
                            <span className="block truncate mono-label text-muted-foreground/60">
                              {item.description}
                            </span>
                          </span>
                          {active ? (
                            <CornerDownLeft className="h-3.5 w-3.5 shrink-0 text-muted-foreground/50" />
                          ) : (
                            <ArrowRight className="h-3.5 w-3.5 shrink-0 text-transparent" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ))
              )}
            </div>

            <div className="flex items-center justify-between border-t border-border bg-surface-2/30 px-4 py-2.5">
              <div className="flex items-center gap-4 mono-label text-muted-foreground/60">
                <span className="flex items-center gap-1.5">
                  <kbd className="border border-border bg-card px-1 py-0.5">↑</kbd>
                  <kbd className="border border-border bg-card px-1 py-0.5">↓</kbd>
                  navigate
                </span>
                <span className="flex items-center gap-1.5">
                  <kbd className="border border-border bg-card px-1.5 py-0.5">↵</kbd>
                  open
                </span>
              </div>
              <span className="mono-label text-muted-foreground/40">
                {flatItems.length} {flatItems.length === 1 ? "result" : "results"}
              </span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}