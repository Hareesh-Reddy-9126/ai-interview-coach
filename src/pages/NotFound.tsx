import { useLocation } from "react-router-dom";
import { useEffect } from "react";
import { ArrowLeft } from "lucide-react";

export default function NotFound() {
  const location = useLocation();
  useEffect(() => { console.error("404:", location.pathname); }, [location.pathname]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-background relative">
      <div className="fixed inset-0 bg-mesh pointer-events-none" />
      <div className="text-center space-y-5 relative z-10">
        <h1 className="text-7xl font-bold gradient-text tracking-tighter">404</h1>
        <p className="text-lg text-muted-foreground">This page doesn't exist</p>
        <a href="/" className="btn-primary px-6 py-3 inline-flex items-center gap-2 text-sm font-semibold">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </a>
      </div>
    </div>
  );
}
