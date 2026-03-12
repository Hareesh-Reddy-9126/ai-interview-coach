import { NavLink, useLocation } from "react-router-dom";
import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Mic, Target, FileText, BarChart3,
  Map, CreditCard, Settings, History, Menu, LogOut, X, Code2,
  Search, Bell, ChevronDown, Sparkles
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

const navGroups = [
  {
    label: "Main",
    items: [
      { to: "/", icon: LayoutDashboard, label: "Dashboard" },
      { to: "/interview", icon: Mic, label: "Interview" },
      { to: "/coding", icon: Code2, label: "Coding Lab" },
      { to: "/practice", icon: Target, label: "Practice" },
    ],
  },
  {
    label: "Tools",
    items: [
      { to: "/resume", icon: FileText, label: "Resume" },
      { to: "/analytics", icon: BarChart3, label: "Analytics" },
      { to: "/roadmap", icon: Map, label: "Roadmap" },
      { to: "/history", icon: History, label: "History" },
    ],
  },
  {
    label: "Account",
    items: [
      { to: "/billing", icon: CreditCard, label: "Billing" },
      { to: "/settings", icon: Settings, label: "Settings" },
    ],
  },
];

const allNavItems = navGroups.flatMap(g => g.items);

export default function Layout({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isDesktop, setIsDesktop] = useState(false);
  const location = useLocation();
  const { signOut, user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    const handleResize = () => setIsDesktop(window.innerWidth >= 768);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  useEffect(() => { setMobileOpen(false); setProfileOpen(false); }, [location.pathname]);

  const currentPage = allNavItems.find(n => n.to === location.pathname);

  const renderNav = useCallback(() => (
    <nav className="flex-1 overflow-y-auto py-3 px-3 space-y-5">
      {navGroups.map((group) => (
        <div key={group.label}>
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/60 px-3 mb-1.5">{group.label}</p>
          <div className="space-y-0.5">
            {group.items.map((item) => {
              const active = location.pathname === item.to;
              return (
                <NavLink key={item.to} to={item.to}
                  className={`group flex items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 ${
                    active
                      ? "bg-primary/10 text-primary"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  }`}>
                  <item.icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${active ? "text-primary" : "text-muted-foreground/70 group-hover:text-foreground"}`} />
                  <span>{item.label}</span>
                  {active && (
                    <motion.div layoutId="nav-indicator" className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
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
      {/* Desktop sidebar */}
      <aside className="hidden md:flex fixed inset-y-0 left-0 z-40 w-[240px] flex-col border-r border-border/60 bg-sidebar">
        <div className="flex h-16 items-center gap-3 px-5 border-b border-border/60">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70 shadow-lg shadow-primary/20">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <span className="text-sm font-bold text-foreground tracking-tight">InterviewAI</span>
            <p className="text-[10px] text-muted-foreground/60 leading-none">Pro Platform</p>
          </div>
        </div>

        {renderNav()}

        {/* User section */}
        <div className="border-t border-border/60 p-3">
          <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-secondary transition-colors">
            <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center text-xs font-bold text-foreground">
              {userInitial}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
              <p className="text-[10px] text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
          <button onClick={signOut}
            className="flex items-center gap-3 w-full px-3 py-2 mt-1 rounded-lg text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all">
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
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setMobileOpen(false)}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm md:hidden"
            />
            <motion.aside
              initial={{ x: -260 }} animate={{ x: 0 }} exit={{ x: -260 }}
              transition={{ type: "spring", damping: 28, stiffness: 320 }}
              className="fixed inset-y-0 left-0 z-50 w-[260px] flex flex-col bg-sidebar border-r border-border/60 md:hidden"
            >
              <div className="flex h-16 items-center justify-between px-5 border-b border-border/60">
                <div className="flex items-center gap-3">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-primary to-primary/70">
                    <Sparkles className="h-4 w-4 text-primary-foreground" />
                  </div>
                  <span className="text-sm font-bold text-foreground">InterviewAI</span>
                </div>
                <button onClick={() => setMobileOpen(false)} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                  <X className="h-4 w-4" />
                </button>
              </div>
              {renderNav()}
              <div className="border-t border-border/60 p-3">
                {user && (
                  <div className="px-3 py-2 mb-1">
                    <p className="text-xs font-semibold text-foreground truncate">{userName}</p>
                    <p className="text-[10px] text-muted-foreground truncate">{user.email}</p>
                  </div>
                )}
                <button onClick={signOut}
                  className="flex items-center gap-3 w-full px-3 py-2 rounded-lg text-[13px] text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-all">
                  <LogOut className="h-4 w-4 shrink-0" />
                  <span>Sign Out</span>
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content */}
      <div className="flex-1 flex flex-col" style={{ marginLeft: isDesktop ? 240 : 0 }}>
        {/* Topbar */}
        <header className="sticky top-0 z-30 flex items-center h-16 px-5 border-b border-border/60 glass gap-4">
          <button onClick={() => setMobileOpen(true)} className="md:hidden p-2 -ml-1 text-muted-foreground hover:text-foreground rounded-lg hover:bg-secondary transition-colors">
            <Menu className="h-5 w-5" />
          </button>

          <div className="hidden md:flex items-center gap-2">
            <h1 className="text-sm font-semibold text-foreground">{currentPage?.label || "Dashboard"}</h1>
          </div>

          <div className="flex-1 max-w-md mx-auto md:mx-0 md:ml-8">
            <div className="relative group">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground/50 group-focus-within:text-muted-foreground transition-colors" />
              <input
                placeholder="Search anything..."
                className="w-full bg-secondary/40 rounded-lg pl-9 pr-4 py-2 text-sm text-foreground border border-transparent focus:border-border focus:bg-secondary/80 focus:outline-none transition-all placeholder:text-muted-foreground/35"
              />
              <kbd className="absolute right-3 top-1/2 -translate-y-1/2 hidden sm:inline-flex text-[10px] font-medium text-muted-foreground/40 bg-secondary/60 px-1.5 py-0.5 rounded border border-border/50">⌘K</kbd>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors relative">
              <Bell className="h-[18px] w-[18px]" />
              <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
            </button>

            <div className="relative ml-1">
              <button
                onClick={() => setProfileOpen(!profileOpen)}
                className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <div className="h-7 w-7 rounded-lg bg-gradient-to-br from-primary/25 to-accent/25 flex items-center justify-center text-[11px] font-bold text-foreground ring-1 ring-border/50">
                  {userInitial}
                </div>
                <span className="text-sm text-foreground font-medium hidden sm:block max-w-[100px] truncate">
                  {userName.split(' ')[0]}
                </span>
                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground hidden sm:block" />
              </button>

              <AnimatePresence>
                {profileOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 6, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.12 }}
                    className="absolute right-0 top-full mt-2 w-52 card-base p-1.5 shadow-2xl shadow-black/30 z-50"
                  >
                    <div className="px-3 py-2.5 border-b border-border mb-1">
                      <p className="text-sm font-semibold text-foreground truncate">{userName}</p>
                      <p className="text-[11px] text-muted-foreground truncate">{user?.email}</p>
                    </div>
                    <NavLink to="/settings" className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors">
                      <Settings className="h-4 w-4" /> Settings
                    </NavLink>
                    <button onClick={signOut} className="flex items-center gap-2.5 w-full px-3 py-2 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-destructive/8 transition-colors">
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
          <div className="fixed inset-0 pointer-events-none bg-mesh opacity-40" style={{ marginLeft: isDesktop ? 240 : 0 }} />
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative p-5 md:p-8 max-w-[1280px] mx-auto"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
