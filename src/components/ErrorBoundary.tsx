import { Component, type ErrorInfo, type ReactNode } from "react";
import { Activity, RefreshCw } from "lucide-react";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * Top-level error boundary: prevents a runtime error in any view from
 * white-screening the entire SPA, and offers a one-click recovery path.
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("[ErrorBoundary] Unhandled render error:", error, errorInfo.componentStack);
  }

  private handleReload = () => {
    window.location.assign("/");
  };

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-950 text-slate-100 px-6 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-tr from-cyan-500 to-blue-600 p-3 shadow-lg shadow-blue-500/20 mb-6">
          <Activity className="h-10 w-10 text-white" />
        </div>
        <h1 className="font-heading text-2xl font-black tracking-wide mb-2">
          Something went wrong
        </h1>
        <p className="text-sm text-slate-400 max-w-md mb-6">
          City Healer hit an unexpected error while rendering this view. Your
          data is safe — reloading will take you back to the home screen.
        </p>
        {this.state.error && (
          <pre className="text-xs text-rose-400/80 bg-slate-900 border border-slate-800 rounded-xl px-4 py-3 max-w-lg overflow-x-auto mb-6">
            {this.state.error.message}
          </pre>
        )}
        <button
          onClick={this.handleReload}
          className="flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-900 to-teal-700 px-6 py-3 text-xs font-extrabold text-white shadow-xl transition-all hover:shadow-teal-900/20 active:scale-95 cursor-pointer"
        >
          <RefreshCw className="h-4 w-4" />
          Reload City Healer
        </button>
      </div>
    );
  }
}

export default ErrorBoundary;
