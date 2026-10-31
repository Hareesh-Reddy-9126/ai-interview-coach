import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard, Mic, Target, FileText, BarChart3,
  Map, Gauge, Settings, History, Menu, LogOut, X, Code2,
  Search, ChevronDown, Sparkles, ArrowRight, Bell
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navGroups = [
  {
    label: "Main",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard", description: "Overview & quick actions" },
      { to: "/interview", icon: Mic, label: "Interview", description: "AI-powered mock interviews" },
      { to: "/coding", icon: Code2, label: "Coding Lab", description: "Algorithms & system design" },
      { to: "/practice", icon: Target, label: "Practice", description: "Focused skill building" },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/resume", icon: FileText, label: "Resume", description: "AI analysis & questions" },
      { to: "/analytics", icon: BarChart3, label: "Analytics", description: "Performance insights" },
      { to: "/roadmap", icon: Map, label: "Roadmap", description: "Personalized learning plan" },
      { to: "/history", icon: History, label: "History", description: "Past sessions & progress" },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/usage", icon: Gauge, label: "Plan & Usage", description: "Limits & fair use" },
      { to: "/settings", icon: Settings, label: "Settings", description: "Preferences & account" },
    ],
  },
];

const allNavItems = navGroups.flatMap(g => g.items);

function SearchResultsDropdown({
  searchOpen,
  search,
  searchResults,
  onSelect,
  onClose
}: {
  searchOpen: boolean;
  search: string;
  searchResults: typeof allNavItems;
  onSelect: (to: string) => void;
  onClose: () => void;
}) {
  if (!searchOpen || !search.trim()) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -6, scale: 0.98 }}
        transition={{ duration: 0.15 }}
        className="absolute left-0 right-0 top-full mt-2 z-50"
      >
        <div className="card-base shadow-2xl shadow-black/30 overflow-hidden border-border/50">
          {searchResults.length > 0 ? (
            searchResults.map((item) => (
              <button
                key={item.to}
                type="button"
                onMouseDown={(event) => event.preventDefault()}
                onClick={() => { onSelect(item.to); onClose(); }}
                className="flex items-center gap-3 w-full px-4 py-3 rounded-none border-t border-border/40 first:border-0 text-sm text-left text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-all"
              >
                <span className="h-5 w-5 flex-shrink-0 flex items-center justify-center">
                  <item.icon className="h-4 w-4" />
                </span>
                <div className="flex-1 text-left">
                  <span className="block font-medium truncate">{item.label}</span>
                  <span className="text-[10px] text-muted-foreground/50 truncate block">{item.description}</span>
                </div>
                <ArrowRight className="h-4 w-4 ml-auto opacity-40" />
              </button>
            ))
          ) : (
            <div className="px-4 py-6 text-center">
              <Search className="h-8 w-8 mx-auto text-muted-foreground/30 mb-2" />
              <p className="text-sm text-muted-foreground">No pages found for "{search}"</p>
            </div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return allNavItems
      .filter((item) => item.label.toLowerCase().includes(query) || item.description.toLowerCase().includes(query))
      .slice(0, 6);
  }, [search]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setNotificationsOpen(false);
        setProfileOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const goToResult = (to: string) => {
    navigate(to);
    setSearch("");
    setSearchOpen(false);
    searchRef.current?.blur();
  };

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => {
    setMobileOpen(false);
    setProfileOpen(false);
    setNotificationsOpen(false);
  }, [location.pathname]);

  const currentPage = allNavItems.find(n => n.to === location.pathname);

  const renderNav = useCallback(() => (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6" role="navigation" aria-label="Main navigation">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 px-2 mb-2">{group.label}</p>
          <div className="space-y-1">
            {group.items.map((item) => {
              const active = location.pathname === item.to;
              return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => cn(
                    "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-all duration-200",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                  aria-current={active ? "page" : undefined}
                >
                  <span
                    className={cn(
                      "h-5 w-5 shrink-0 flex items-center justify-center transition-all duration-200",
                      active ? "text-primary" : "text-muted-foreground/60 group-hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4" />
                  </span>
                  <div className="flex-1 min-w-0 text-left">
                    <span className="block truncate">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground/50 truncate block mt-0.5">{item.description}</span>
                  </div>
                  {active && (
                    <motion.span
                      layoutId="nav-indicator"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-2.5 w-2.5 rounded-full bg-primary"
                    />
                  )}
                </NavLink>
              );
            })}
          </div>
        </div>
      ))}
    </nav>
  ), [location.pathname]);

  const userName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'User';
  const userInitial = (user?.user_metadata?.name?.[0] || user?.email?.[0] || 'U').toUpperCase();

  return (
    <div className="flex min-h-screen w-full bg-background">
      {/* Background mesh */}
      <div className="fixed inset-0 pointer-events-none bg-mesh opacity-30 md:hidden" />

      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-64 flex-col border-r border-border/50 bg-sidebar/80 backdrop-blur-xl">
        <div className="flex h-16 items-center gap-3 px-4 border-b border-border/50">
          <motion.div
            initial={{ scale: 0, rotate: -180 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary to-accent shadow-lg shadow-primary/30"
          >
            <Sparkles className="h-5 w-5 text-primary-foreground" />
          </motion.div>
          <div className="min-w-0">
            <span className="text-sm font-bold text-foreground tracking-tight">AI Interview Lab</span>
            <p className="text-[10px] text-muted-foreground/60 leading-none">Interview Practice</p>
          </div>
        </div>

        {renderNav()}

        {/* User section */}
        <div className="border-t border-border/50 p-3">
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary/50 transition-colors">
            <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xs font-bold text-foreground ring-1 ring-border/50">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
              <p className="text-[10px] text-muted-foreground/70 truncate">{user?.email}</p>
            </div>
          </div>
          <button
            onClick={signOut}
            className="mt-2 flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all"
          >
            <LogOut className="h-4 w-4 shrink-0" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay sidebar */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 w-68 flex flex-col bg-sidebar/95 backdrop-blur-xl border-r border-border/50 md:hidden"
            >
              <div className="flex h-16 items-center justify-between px-4 border-b border-border/50">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-primary to-accent">
                    <Sparkles className="h-5 w-5 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-bold text-foreground">AI Interview Lab</span>
                </div>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                  aria-label="Close menu"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              {renderNav()}
              <div className="border-t border-border/50 p-3">
                {user && (
                  <div className="px-3 py-2 mb-2">
                    <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-[10px] text-muted-foreground/70 truncate">{user.email}</p>
                  </div>
                )}
                <button
                  onClick={signOut}
                  className="flex items-center gap-2.5 w-full px-3 py-2 rounded-xl text-sm font-medium text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all"
                >
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: isDesktop ? 256 : 0 }}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-4 md:px-6 border-b border-border/50 glass-strong gap-4">
          <button
            onClick={() => setMobileOpen(true)}
            className="md:hidden p-2 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors"
            aria-label="Open menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden md:flex items-center gap-3 ml-2">
            <motion.span
              key={currentPage?.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              className="text-sm font-semibold text-foreground"
            >
              {currentPage?.label || "Dashboard"}
            </motion.span>
          </div>

          {/* Search */}
          <form onSubmit={(e) => { e.preventDefault(); if (searchResults[0]) goToResult(searchResults[0].to); }} className="group relative flex-1 max-w-md mx-auto md:mx-0 md:ml-6">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-primary transition-colors" />
            <input
              ref={searchRef}
              value={search}
              onChange={(event) => { setSearch(event.target.value); setSearchOpen(true); }}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => window.setTimeout(() => setSearchOpen(false), 120)}
              placeholder="Search pages, features... (⌘K)"
              aria-label="Search pages"
              className="w-full bg-secondary/40 rounded-xl pl-11 pr-4 py-2.5 text-sm text-foreground border border-transparent focus:border-primary/30 focus:bg-secondary/80 focus:outline-none focus:ring-2 focus:ring-primary/15 transition-all placeholder:text-muted-foreground/35"
            />
            <kbd className="absolute right-3.5 top-1/2 -translate-y-1/2 hidden sm:inline-flex text-[10px] font-medium text-muted-foreground/40 bg-secondary/60 px-2 py-0.5 rounded border border-border/50">⌘K</kbd>

            <SearchResultsDropdown
              searchOpen={searchOpen}
              search={search}
              searchResults={searchResults}
              onSelect={goToResult}
              onClose={() => { setSearchOpen(false); setSearch(""); }}
            />
          </form>

          {/* Right side actions */}
          <div className="flex items-center gap-1.5 ml-auto">
            {/* Notifications */}
            <div className="relative">
              <button
                onClick={() => setNotificationsOpen(!notificationsOpen)}
                className="relative p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                aria-label="Notifications"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-primary animate-pulse-glow" />
              </button>
              <AnimatePresence>
                {notificationsOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: -6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -6, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-2 w-72 card-base p-1 shadow-2xl shadow-black/30 z-50"
                  >
                    <div className="px-4 py-3 border-b border-border">
                      <h4 className="text-sm font-semibold text-foreground">Notifications</h4>
                    </div>
                    <div className="p-2 space-y-1 max-h-64 overflow-y-auto">
                      <p className="text-sm text-muted-foreground text-center py-4">No new notifications</p>
                    </div>
                    <button
                      onClick={() => setNotificationsOpen(false)}
                      className="w-full px-4 py-2 text-sm text-primary hover:bg-primary/5 rounded-t-xl border-t border-border"
                    >
                      View all
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile dropdown */}
            <div className="relative ml-1">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 px-3 py-2 rounded-xl hover:bg-secondary transition-colors"
                aria-label="User menu"
              >
                <div className="h-8 w-8 rounded-xl bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center text-xs font-bold text-foreground ring-1 ring-border/50">
                  {userInitial}
                </div>
                <span className="text-sm text-foreground font-medium hidden sm:block max-w-[120px] truncate">
                  {userName.split(' ')[0]}
                </span>
                <ChevronDown className="h-4 w-4 text-muted-foreground hidden sm:block" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-2 w-56 card-base p-1.5 shadow-2xl shadow-black/30 z-50"
                  >
                    <div className="px-3 py-3 border-b border-border mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                      <p className="text-xs text-muted-foreground/70 truncate">{user?.email}</p>
                    </div>
                    <NavLink
                      to="/settings"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Settings className="h-4 w-4" /> Settings
                    </NavLink>
                    <NavLink
                      to="/usage"
                      onClick={() => setProfileOpen(false)}
                      className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors"
                    >
                      <Gauge className="h-4 w-4" /> Plan & Usage
                    </NavLink>
                    <button
                      onClick={signOut}
                      className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors"
                    >
                      <LogOut className="h-4 w-4" /> Sign Out
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>
        </header>

        {/* Main workspace */}
        <main className="flex-1 relative">
          <div className="fixed inset-0 pointer-events-none bg-mesh opacity-40" style={{ marginLeft: isDesktop ? 256 : 0 }} />
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative p-5 md:p-8 lg:p-10 max-w-[1400px] mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}