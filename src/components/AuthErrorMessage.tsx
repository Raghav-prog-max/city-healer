import React from "react";
import { AlertCircle, X } from "lucide-react";

interface AuthErrorMessageProps {
  error: {
    code: string;
    message: string;
  } | null;
  onClear?: () => void;
  isDarkMode?: boolean;
}

export const AuthErrorMessage: React.FC<AuthErrorMessageProps> = ({
  error,
  onClear,
  isDarkMode = false,
}) => {
  if (!error) return null;

  // Render a friendly name for the error code if we want, or just show the code in monospace
  const codeLabel = error.code.replace("auth/", "");

  return (
    <div
      id="auth-error-message-banner"
      className={`relative overflow-hidden rounded-2xl border p-4 transition-all duration-300 animate-fadeIn ${
        isDarkMode
          ? "bg-rose-950/30 border-rose-900/40 text-rose-200 shadow-lg shadow-rose-950/20"
          : "bg-rose-50/90 border-rose-100 text-rose-900 shadow-sm"
      }`}
    >
      {/* Decorative left accent bar */}
      <div className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-rose-500 to-rose-600" />

      <div className="flex items-start gap-3">
        <div className="flex-shrink-0 mt-0.5">
          <AlertCircle className={`w-5 h-5 ${isDarkMode ? "text-rose-400" : "text-rose-600"}`} />
        </div>

        <div className="flex-grow pr-6 space-y-1">
          <p className="text-xs font-semibold leading-relaxed">
            {error.message}
          </p>
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] font-mono font-medium uppercase tracking-wider px-1.5 py-0.5 rounded ${
                isDarkMode ? "bg-rose-950/60 text-rose-400/80" : "bg-rose-100/50 text-rose-700"
              }`}
            >
              error: {codeLabel}
            </span>
          </div>
        </div>

        {onClear && (
          <button
            id="auth-error-dismiss-btn"
            type="button"
            onClick={onClear}
            className={`absolute top-3 right-3 p-1 rounded-lg transition-colors cursor-pointer ${
              isDarkMode
                ? "text-rose-400/60 hover:text-rose-300 hover:bg-rose-950/50"
                : "text-rose-500/60 hover:text-rose-700 hover:bg-rose-100/40"
            }`}
            aria-label="Dismiss error"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
    </div>
  );
};
