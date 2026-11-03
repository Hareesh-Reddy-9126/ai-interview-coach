import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  Gauge,
  LogOut,
  Menu,
  Plus,
  Search,
  Settings,
  X,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { findNavItem, navGroups } from "@/lib/navigation";
import { Logo } from "@/components/ui/logo";
import { CommandPalette } from "@/components/ui/command-palette";
import { cn } from "@/lib/utils";

function useWorkspaceSummary(userId?: string) {
  const [summary, setSummary] = useState<{ interviews: number; streak: number } | null>(null);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    supabase
      .from("user_analytics")
      .select("interviews_completed, current_streak")
      .eq("user_id", userId)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled) return;
        setSummary({
          interviews: Number(data?.interviews_completed) || 0,
          streak: Number(data?.current_streak) || 0,
        });
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  return summary;
}

function NavItemRow({
  item,
  onNavigate,
}: {
  item: (typeof navGroups)[number]["items"][number];
  onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex h-9 items-center gap-3 border-l border-transparent pl-3.5 pr-2 text-[12px] font-medium tracking-[0.005em] transition-colors duration-200",
          isActive
            ? "border-[hsl(var(--sidebar-primary))] bg-[hsl(var(--sidebar-accent))]/60 text-[hsl(var(--sidebar-accent-foreground))]"
            : "text-sidebar-foreground/70 hover:text-sidebar-accent-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          <item.icon
            className={cn(
              "h-[13px] w-[13px] shrink-0 transition-colors",
              isActive
                ? "text-[hsl(var(--sidebar-primary))]"
                : "text-sidebar-foreground/40 group-hover:text-sidebar-foreground/75",
            )}
            strokeWidth={1.6}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {isActive && <span className="h-[3px] w-[3px] bg-[hsl(var(--sidebar-primary))]" />}
        </>
      )}
    </NavLink>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const { user, signOut } = useAuth();
  const summary = useWorkspaceSummary(user?.id);

  const currentPage = useMemo(() => findNavItem(location.pathname), [location.pathname]);

  const userName = user?.user_metadata?.name || user?.email?.split("@")[0] || "User";
  const userInitial = (user?.user_metadata?.name?.[0] || user?.email?.[0] || "U").toUpperCase();
  const firstName = userName.split(" ")[0];

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
  }, [location.pathname]);

  const openPalette = useCallback(() => setPaletteOpen(true), []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
      if (event.key === "Escape") {
        setProfileOpen(false);
        setMobileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const nav = (onNavigate?: () => void) => (
    <nav className="flex-1 overflow-y-auto px-4 pb-6 pt-6 scrollbar-none" aria-label="Primary">
      {navGroups.map((group, groupIndex) => (
        <div key={group.label} className="mb-7 last:mb-0">
          <p className="mb-2 flex items-center gap-2.5 px-3.5 font-mono text-[7.5px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/35">
            <span className="w-3 text-sidebar-primary/60">0{groupIndex + 1}</span>
            <span className="h-px w-3 bg-sidebar-border" />
            {group.label}
          </p>
          <div className="space-y-px">
            {group.items.map((item) => (
              <NavItemRow key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const sidebarFooter = (
    <div className="border-t border-sidebar-border">
      <div className="px-6 py-5">
        <div className="flex items-start justify-between">
          <p className="font-mono text-[7.5px] font-medium uppercase tracking-[0.18em] text-sidebar-foreground/40">
            Current cycle
          </p>
          <Link
            to="/analytics"
            onClick={onNavigateFromDetails}
            className="font-mono text-[7.5px] uppercase tracking-[0.12em] text-sidebar-primary/80 transition-colors hover:text-sidebar-primary"
          >
            Details
          </Link>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-4">
          <div>
            <p className="font-display text-[28px] leading-none text-[hsl(var(--sidebar-accent-foreground))] tabular">
              {summary ? summary.interviews : "—"}
            </p>
            <p className="mt-1.5 font-mono text-[7px] uppercase tracking-[0.14em] text-sidebar-foreground/40">
              Interviews
            </p>
          </div>
          <div>
            <p className="font-display text-[28px] leading-none text-[hsl(var(--sidebar-accent-foreground))] tabular">
              {summary ? summary.streak : "—"}
              <span className="font-body text-[10px] text-sidebar-foreground/45">d</span>
            </p>
            <p className="mt-1.5 font-mono text-[7px] uppercase tracking-[0.14em] text-sidebar-foreground/40">
              Streak
            </p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-sidebar-border px-5 py-4">
        <Link
          to="/settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center border border-sidebar-border bg-sidebar-accent/60 font-display text-[14px] text-[hsl(var(--sidebar-accent-foreground))] transition-colors hover:border-sidebar-primary/50"
          aria-label="Open settings"
        >
          {userInitial}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-medium leading-tight text-[hsl(var(--sidebar-accent-foreground))]">
            {userName}
          </p>
          <p className="mt-0.5 truncate font-mono text-[8px] leading-tight text-sidebar-foreground/40">
            {user?.email}
          </p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex h-7 w-7 items-center justify-center text-sidebar-foreground/40 transition-colors hover:text-[hsl(var(--sidebar-accent-foreground))]"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" strokeWidth={1.6} />
        </button>
      </div>

      <p className="px-5 pb-4 font-mono text-[6.5px] uppercase tracking-[0.18em] text-sidebar-foreground/25">
        NVIDIA Nemotron · Private by default
      </p>
    </div>
  );

  function onNavigateFromDetails() {
    setMobileOpen(false);
  }

  return (
    <div className="grain min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:bg-primary focus:px-3 focus:py-2 focus:font-mono focus:text-[9px] focus:uppercase focus:tracking-[0.14em] focus:text-primary-foreground"
      >
        Skip to content
      </a>

      {/* Desktop rail */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[264px] flex-col border-r border-sidebar-border bg-sidebar md:flex">
        <div className="flex h-[78px] shrink-0 items-center border-b border-sidebar-border px-6">
          <Link to="/" className="outline-none focus-visible:ring-1 focus-visible:ring-sidebar-ring">
            <Logo tone="inverse" />
          </Link>
        </div>

        <div className="border-b border-sidebar-border px-6 py-5">
          <p className="font-mono text-[7.5px] font-medium uppercase tracking-[0.2em] text-sidebar-foreground/40">
            Private workspace
          </p>
          <div className="mt-2 flex items-baseline justify-between gap-2">
            <p className="truncate font-display text-[21px] leading-none text-[hsl(var(--sidebar-accent-foreground))]">
              {firstName}&apos;s atelier
            </p>
            <span className="font-mono text-[7px] uppercase tracking-[0.14em] text-sidebar-primary">
              Full
            </span>
          </div>
        </div>

        {nav()}
        {sidebarFooter}
      </aside>

      {/* Mobile drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-foreground/45 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 34, stiffness: 380 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[280px] flex-col bg-sidebar md:hidden"
            >
              <div className="flex h-[78px] items-center justify-between border-b border-sidebar-border px-5">
                <Link to="/" onClick={() => setMobileOpen(false)}>
                  <Logo tone="inverse" />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="flex h-8 w-8 items-center justify-center text-sidebar-foreground/60"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" strokeWidth={1.5} />
                </button>
              </div>
              <div className="border-b border-sidebar-border px-5 py-4">
                <p className="font-mono text-[7px] uppercase tracking-[0.18em] text-sidebar-foreground/40">
                  Private workspace
                </p>
                <p className="mt-1.5 truncate font-display text-[20px] leading-none text-[hsl(var(--sidebar-accent-foreground))]">
                  {firstName}&apos;s atelier
                </p>
              </div>
              {nav(() => setMobileOpen(false))}
              {sidebarFooter}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative min-h-screen md:pl-[264px]">
        <header className="sticky top-0 z-30 flex h-[64px] items-center gap-4 border-b border-border bg-background/92 px-5 backdrop-blur-md md:px-10">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="-ml-2 flex h-8 w-8 items-center justify-center text-foreground md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-[18px] w-[18px]" strokeWidth={1.5} />
          </button>

          <div className="flex min-w-0 items-baseline gap-3">
            <span className="hidden font-mono text-[8px] uppercase tracking-[0.18em] text-muted-foreground/55 sm:block">
              Atelier
            </span>
            <span className="hidden h-3 w-px bg-border sm:block" aria-hidden="true" />
            <span className="truncate font-display text-[19px] leading-none text-foreground">
              {currentPage?.label ?? "Overview"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-3 sm:gap-5">
            <button
              type="button"
              onClick={openPalette}
              className="group hidden h-8 items-center gap-2 font-mono text-[8.5px] uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground sm:flex"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5" strokeWidth={1.5} />
              <span className="hidden lg:inline">Search</span>
              <kbd className="ml-0.5 hidden border border-border px-1.5 py-0.5 font-mono text-[7.5px] text-muted-foreground/60 lg:block">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={openPalette}
              className="flex h-8 w-8 items-center justify-center text-muted-foreground sm:hidden"
              aria-label="Search"
            >
              <Search className="h-4 w-4" strokeWidth={1.5} />
            </button>

            <Link
              to="/interview"
              className="btn-primary btn-sm hidden gap-2 xs:inline-flex"
            >
              <Plus className="h-3 w-3" strokeWidth={1.8} />
              New session
            </Link>

            <div className="hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className={cn(
                  "flex h-8 items-center gap-2.5 border border-transparent pl-1 pr-1.5 transition-colors hover:border-border",
                  profileOpen && "border-border bg-card",
                )}
                aria-label="Account menu"
                aria-expanded={profileOpen}
              >
                <span className="flex h-6 w-6 items-center justify-center bg-primary font-display text-[12px] leading-none text-primary-foreground">
                  {userInitial}
                </span>
                <span className="hidden max-w-[110px] truncate font-mono text-[8px] uppercase tracking-[0.12em] text-foreground sm:block">
                  {firstName}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground" strokeWidth={1.5} />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setProfileOpen(false)}
                      aria-hidden="true"
                    />
                    <motion.div
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.14 }}
                      className="absolute right-0 top-full z-50 mt-2 w-60 border border-border-strong bg-popover p-0 shadow-premium-xl"
                    >
                      <div className="border-b border-border px-4 py-4">
                        <p className="font-mono text-[7.5px] uppercase tracking-[0.16em] text-muted-foreground/60">
                          Signed in
                        </p>
                        <p className="mt-1.5 truncate font-display text-[19px] leading-tight text-foreground">
                          {userName}
                        </p>
                        <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">
                          {user?.email}
                        </p>
                      </div>
                      <div className="p-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            navigate("/settings");
                          }}
                          className="flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left text-[11.5px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          <Settings className="h-3.5 w-3.5" strokeWidth={1.5} /> Settings
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            navigate("/usage");
                          }}
                          className="flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left text-[11.5px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          <Gauge className="h-3.5 w-3.5" strokeWidth={1.5} /> Plan &amp; usage
                        </button>
                        <div className="my-1 h-px bg-border" />
                        <button
                          type="button"
                          onClick={signOut}
                          className="flex w-full items-center gap-2.5 px-2.5 py-2.5 text-left text-[11.5px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <LogOut className="h-3.5 w-3.5" strokeWidth={1.5} /> Sign out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="relative mx-auto w-full max-w-[1360px] px-5 pb-20 pt-8 md:px-10 md:pt-10"
        >
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
