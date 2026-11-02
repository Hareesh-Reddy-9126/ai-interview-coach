import { useCallback, useEffect, useMemo, useState } from "react";
import { NavLink, Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import {
  ChevronDown,
  ChevronRight,
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

function NavItemRow({ item, onNavigate }: { item: (typeof navGroups)[number]["items"][number]; onNavigate?: () => void }) {
  return (
    <NavLink
      to={item.to}
      onClick={onNavigate}
      className={({ isActive }) =>
        cn(
          "group relative flex h-9 items-center gap-2.5 rounded-lg px-2.5 text-[12.5px] font-medium transition-colors duration-150",
          isActive
            ? "bg-[hsl(var(--sidebar-accent))] text-foreground"
            : "text-sidebar-foreground hover:bg-[hsl(var(--sidebar-accent))]/60 hover:text-foreground",
        )
      }
    >
      {({ isActive }) => (
        <>
          {isActive && (
            <motion.span
              layoutId="sidebar-active-rail"
              className="absolute -left-px top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-full bg-primary"
              transition={{ type: "spring", stiffness: 420, damping: 34 }}
            />
          )}
          <item.icon
            className={cn(
              "h-[15px] w-[15px] shrink-0 transition-colors",
              isActive ? "text-primary" : "text-muted-foreground/55 group-hover:text-foreground/80",
            )}
            strokeWidth={1.9}
          />
          <span className="flex-1 truncate">{item.label}</span>
          {isActive && <span className="h-1 w-1 rounded-full bg-primary/60" />}
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
    <nav className="flex-1 overflow-y-auto px-3 pb-4 pt-3 scrollbar-none" aria-label="Primary">
      {navGroups.map((group) => (
        <div key={group.label} className="mb-5 last:mb-0">
          <p className="mb-1.5 px-2.5 text-[9.5px] font-medium uppercase tracking-[0.15em] text-muted-foreground/40">
            {group.label}
          </p>
          <div className="space-y-0.5">
            {group.items.map((item) => (
              <NavItemRow key={item.to} item={item} onNavigate={onNavigate} />
            ))}
          </div>
        </div>
      ))}
    </nav>
  );

  const sidebarFooter = (
    <div className="space-y-3 border-t border-sidebar-border px-3 py-3">
      <div className="rounded-[10px] border border-sidebar-border bg-[hsl(var(--sidebar-accent))]/50 p-3">
        <div className="flex items-center justify-between">
          <span className="text-[9.5px] font-medium uppercase tracking-[0.13em] text-muted-foreground/50">
            Your cycle
          </span>
          <Link
            to="/analytics"
            className="text-[10px] font-medium text-muted-foreground/60 transition-colors hover:text-primary"
          >
            Details
          </Link>
        </div>
        <div className="mt-2.5 grid grid-cols-2 gap-2">
          <div>
            <p className="font-display text-[16px] font-semibold leading-none text-foreground tabular">
              {summary ? summary.interviews : "—"}
            </p>
            <p className="mt-1 text-[9.5px] text-muted-foreground/50">Interviews</p>
          </div>
          <div>
            <p className="font-display text-[16px] font-semibold leading-none text-foreground tabular">
              {summary ? `${summary.streak}d` : "—"}
            </p>
            <p className="mt-1 text-[9.5px] text-muted-foreground/50">Streak</p>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2.5 px-1.5 py-1">
        <Link
          to="/settings"
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-2 text-[11px] font-semibold text-foreground transition-colors hover:border-border-strong"
          aria-label="Open settings"
        >
          {userInitial}
        </Link>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[11.5px] font-medium leading-tight text-foreground">{userName}</p>
          <p className="truncate text-[10px] leading-tight text-muted-foreground/50">{user?.email}</p>
        </div>
        <button
          type="button"
          onClick={signOut}
          className="flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground/50 transition-colors hover:bg-surface-3 hover:text-foreground"
          aria-label="Sign out"
          title="Sign out"
        >
          <LogOut className="h-3.5 w-3.5" />
        </button>
      </div>

      <p className="px-1.5 text-[9px] tracking-[0.02em] text-muted-foreground/30">
        Powered by NVIDIA NIM · Nemotron
      </p>
    </div>
  );

  return (
    <div className="grain min-h-screen bg-background">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[200] focus:rounded-md focus:bg-primary focus:px-3 focus:py-2 focus:text-xs focus:font-medium focus:text-primary-foreground"
      >
        Skip to content
      </a>

      <div className="pointer-events-none fixed inset-0 bg-mesh opacity-70" aria-hidden="true" />

      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-sidebar-border bg-sidebar/95 backdrop-blur-xl md:flex">
        <div className="flex h-[58px] shrink-0 items-center px-4">
          <Link to="/" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <Logo />
          </Link>
        </div>

        <div className="mx-3 mb-1 flex items-center justify-between rounded-lg border border-sidebar-border bg-[hsl(var(--sidebar-accent))]/35 px-2.5 py-2">
          <div className="flex min-w-0 items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-[5px] bg-primary/[0.12] text-[9px] font-bold text-primary">
              {userInitial}
            </span>
            <span className="truncate text-[11px] font-medium text-sidebar-foreground">
              {firstName}&apos;s workspace
            </span>
          </div>
          <span className="rounded-[4px] border border-primary/20 bg-primary/10 px-1.5 py-[1px] text-[8.5px] font-semibold uppercase tracking-[0.08em] text-primary">
            Full
          </span>
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
              className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring", damping: 32, stiffness: 380 }}
              className="fixed inset-y-0 left-0 z-50 flex w-[272px] flex-col border-r border-sidebar-border bg-sidebar md:hidden"
            >
              <div className="flex h-[58px] items-center justify-between px-4">
                <Link to="/" onClick={() => setMobileOpen(false)}>
                  <Logo />
                </Link>
                <button
                  type="button"
                  onClick={() => setMobileOpen(false)}
                  className="btn-icon"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {nav(() => setMobileOpen(false))}
              {sidebarFooter}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      <div className="relative min-h-screen md:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-[58px] items-center gap-3 border-b border-border/70 bg-background/75 px-4 backdrop-blur-xl md:px-7">
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            className="btn-icon -ml-1.5 md:hidden"
            aria-label="Open menu"
          >
            <Menu className="h-[18px] w-[18px]" />
          </button>

          <div className="hidden min-w-0 items-center gap-1.5 text-[12px] md:flex">
            <span className="text-muted-foreground/45">Workspace</span>
            <ChevronRight className="h-3 w-3 text-muted-foreground/30" />
            <span className="truncate font-medium text-foreground">
              {currentPage?.label ?? "Page"}
            </span>
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              type="button"
              onClick={openPalette}
              className="group hidden h-8 w-[228px] items-center gap-2 rounded-lg border border-border bg-surface-2/60 px-2.5 text-left transition-colors hover:border-border-strong hover:bg-surface-2 sm:flex"
              aria-label="Open command palette"
            >
              <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
              <span className="flex-1 text-[11.5px] text-muted-foreground/50">Search or jump to…</span>
              <kbd className="rounded border border-border bg-card px-1.5 py-0.5 text-[9.5px] font-medium text-muted-foreground/50">
                ⌘K
              </kbd>
            </button>

            <button
              type="button"
              onClick={openPalette}
              className="btn-icon sm:hidden"
              aria-label="Search"
            >
              <Search className="h-4 w-4" />
            </button>

            <Link to="/interview" className="btn-primary btn-sm hidden gap-1.5 xs:inline-flex">
              <Plus className="h-3.5 w-3.5" />
              New session
            </Link>

            <div className="mx-1 hidden h-5 w-px bg-border sm:block" aria-hidden="true" />

            <div className="relative">
              <button
                type="button"
                onClick={() => setProfileOpen((open) => !open)}
                className={cn(
                  "flex h-8 items-center gap-2 rounded-lg border border-transparent pl-1 pr-2 transition-colors hover:border-border hover:bg-surface-2",
                  profileOpen && "border-border bg-surface-2",
                )}
                aria-label="Account menu"
                aria-expanded={profileOpen}
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-surface-3 text-[10px] font-semibold text-foreground ring-1 ring-border">
                  {userInitial}
                </span>
                <span className="hidden max-w-[110px] truncate text-[11.5px] font-medium text-foreground sm:block">
                  {firstName}
                </span>
                <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
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
                      initial={{ opacity: 0, y: -4, scale: 0.985 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -4, scale: 0.985 }}
                      transition={{ duration: 0.12 }}
                      className="absolute right-0 top-full z-50 mt-2 w-56 overflow-hidden rounded-xl border border-border-strong bg-popover p-1.5 shadow-premium-xl"
                    >
                      <div className="border-b border-border px-2.5 pb-2.5 pt-1.5">
                        <p className="truncate text-[12.5px] font-medium text-foreground">{userName}</p>
                        <p className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{user?.email}</p>
                      </div>
                      <div className="pt-1.5">
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            navigate("/settings");
                          }}
                          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          <Settings className="h-3.5 w-3.5" /> Settings
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setProfileOpen(false);
                            navigate("/usage");
                          }}
                          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
                        >
                          <Gauge className="h-3.5 w-3.5" /> Plan &amp; usage
                        </button>
                        <div className="my-1 h-px bg-border" />
                        <button
                          type="button"
                          onClick={signOut}
                          className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-[12px] text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                        >
                          <LogOut className="h-3.5 w-3.5" /> Sign out
                        </button>
                      </div>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        <main id="main-content" className="relative mx-auto w-full max-w-[1240px] px-4 py-7 md:px-8 md:py-9">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 7 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: [0.16, 1, 0.3, 1] }}
          >
            {children}
          </motion.div>
        </main>
      </div>

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} />
    </div>
  );
}
