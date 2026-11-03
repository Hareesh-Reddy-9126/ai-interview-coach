import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { OrgProvider } from "@/hooks/useOrg";
import Layout from "@/components/Layout";
import ErrorBoundary from "@/components/ErrorBoundary";
import { lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { LogoMark } from "@/components/ui/logo";

// Lazy load pages
const OrgPageLazy = lazy(() => import("./pages/OrgPage"));
const Home = lazy(() => import("./pages/Home"));
const Index = lazy(() => import("./pages/Index"));
const Interview = lazy(() => import("./pages/Interview"));
const PracticeModes = lazy(() => import("./pages/PracticeModes"));
const CodingInterview = lazy(() => import("./pages/CodingInterview"));
const ResumeAnalyzer = lazy(() => import("./pages/ResumeAnalyzer"));
const Analytics = lazy(() => import("./pages/Analytics"));
const LearningRoadmap = lazy(() => import("./pages/LearningRoadmap"));
const InterviewHistory = lazy(() => import("./pages/InterviewHistory"));
const Usage = lazy(() => import("./pages/Usage"));
const SettingsPage = lazy(() => import("./pages/SettingsPage"));
const AuthPage = lazy(() => import("./pages/AuthPage"));
const NotFound = lazy(() => import("./pages/NotFound"));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 10000),
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 1,
    },
  },
});

function PageLoader() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4">
      <LogoMark size={32} className="animate-pulse-soft" />
      <p className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/40">
        Loading workspace
      </p>
    </div>
  );
}

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, mfaRequired } = useAuth();
  if (loading) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <LogoMark size={34} className="animate-pulse-soft" />
      <div className="flex items-center gap-2 text-[11px] text-muted-foreground/50">
        <Loader2 className="h-3 w-3 animate-spin" />
        Restoring your session
      </div>
    </div>
  );
  if (!user || mfaRequired) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading, mfaRequired } = useAuth();
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <LogoMark size={32} className="animate-pulse-soft" />
    </div>
  );
  if (user && !mfaRequired) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <Suspense fallback={<PageLoader />}>
    <Routes>
      <Route path="/auth" element={<AuthRoute><AuthPage /></AuthRoute>} />
      <Route path="/" element={<Home />} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout><Index /></Layout></ProtectedRoute>} />
      <Route path="/interview" element={<ProtectedRoute><Layout><Interview /></Layout></ProtectedRoute>} />
      <Route path="/practice" element={<ProtectedRoute><Layout><PracticeModes /></Layout></ProtectedRoute>} />
      <Route path="/coding" element={<ProtectedRoute><Layout><CodingInterview /></Layout></ProtectedRoute>} />
      <Route path="/resume" element={<ProtectedRoute><Layout><ResumeAnalyzer /></Layout></ProtectedRoute>} />
      <Route path="/analytics" element={<ProtectedRoute><Layout><Analytics /></Layout></ProtectedRoute>} />
      <Route path="/roadmap" element={<ProtectedRoute><Layout><LearningRoadmap /></Layout></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><Layout><InterviewHistory /></Layout></ProtectedRoute>} />
      <Route path="/usage" element={<ProtectedRoute><Layout><Usage /></Layout></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><Layout><SettingsPage /></Layout></ProtectedRoute>} />
      <Route path="/org" element={<ProtectedRoute><Layout><OrgPageLazy /></Layout></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
  </Suspense>
);

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <OrgProvider>
              <ErrorBoundary>
                <AppRoutes />
              </ErrorBoundary>
            </OrgProvider>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
