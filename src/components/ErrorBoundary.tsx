import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Caught error:", error, errorInfo);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="flex min-h-[50vh] items-center justify-center px-5">
          <div className="w-full max-w-md border border-border bg-card/50 p-8 text-center">
            <span className="mx-auto mb-5 flex h-10 w-10 items-center justify-center border border-destructive/30 bg-destructive/[0.06] text-destructive">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <p className="section-label">Unexpected error</p>
            <h2 className="mt-3 font-display text-[24px] font-light leading-[1.1] tracking-[-0.03em] text-foreground">
              Something went wrong
            </h2>
            <p className="mt-3 text-[12px] leading-[1.7] text-muted-foreground">
              {this.state.error?.message || "An unexpected error occurred."}
            </p>
            <div className="mt-6 flex justify-center gap-2">
              <button onClick={this.handleReset} className="btn-primary btn-sm gap-1.5">
                <RefreshCw className="h-3.5 w-3.5" /> Try again
              </button>
              <button onClick={() => window.location.reload()} className="btn-secondary btn-sm">
                Reload page
              </button>
            </div>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
