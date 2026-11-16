import React from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useI18n } from "../i18n";
import type { Locale } from "../i18n/messages";

/** Brand mark: a cross whose arms are network links. Decorative; the wordmark carries the name. */
export function Logo({ dark = false, compact = false }: { dark?: boolean; compact?: boolean }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width="30" height="30" viewBox="0 0 32 32" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill={dark ? "#F8FAFC" : "#0E0F0C"} />
        <path d="M16 7v18M7 16h18" stroke="#0EA5E9" strokeWidth="3.2" strokeLinecap="round" />
        <circle cx="16" cy="7" r="2.4" fill="#22C55E" />
        <circle cx="25" cy="16" r="2.4" fill="#22C55E" />
        <circle cx="16" cy="25" r="2.4" fill="#22C55E" />
        <circle cx="7" cy="16" r="2.4" fill="#22C55E" />
      </svg>
      {!compact && (
        <span className={`text-[17px] font-semibold tracking-tight ${dark ? "text-paper" : "text-ink"}`}>{t.brand.name}</span>
      )}
    </span>
  );
}

type Variant = "primary" | "secondary" | "ghost" | "danger" | "light";
const VARIANTS: Record<Variant, string> = {
  primary: "bg-care text-white hover:bg-care-deep shadow-sm shadow-care/20",
  secondary: "bg-white text-text border border-line hover:border-care hover:text-care-deep",
  ghost: "bg-transparent text-text hover:bg-mist",
  danger: "bg-danger text-white hover:bg-red-700",
  light: "bg-paper text-ink hover:bg-white",
};

export function Button({
  variant = "primary", size = "md", loading, className = "", children, ...rest
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: "sm" | "md" | "lg"; loading?: boolean }) {
  const sizes = { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-[52px] px-6 text-base" };
  return (
    <button
      {...rest}
      disabled={rest.disabled || loading}
      className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-200 disabled:opacity-50 disabled:pointer-events-none ${sizes[size]} ${VARIANTS[variant]} ${className}`}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}

export function ButtonLink({
  to, variant = "primary", size = "md", className = "", children, ...rest
}: { to: string; variant?: Variant; size?: "sm" | "md" | "lg"; className?: string; children: React.ReactNode } & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const sizes = { sm: "h-9 px-3.5 text-sm", md: "h-11 px-5 text-[15px]", lg: "h-[52px] px-6 text-base" };
  return (
    <Link to={to} {...rest} className={`inline-flex items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-200 ${sizes[size]} ${VARIANTS[variant]} ${className}`}>
      {children}
    </Link>
  );
}

export function Card({ className = "", children, ...rest }: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={`rounded-2xl border border-line bg-white ${className}`}>{children}</div>;
}

export function Badge({ tone = "neutral", children, className = "" }: { tone?: "neutral" | "care" | "health" | "warn" | "danger" | "ink"; children: React.ReactNode; className?: string }) {
  const tones = {
    neutral: "bg-mist text-subtle border-line",
    care: "bg-sky-50 text-care-deep border-sky-200",
    health: "bg-green-50 text-health-deep border-green-200",
    warn: "bg-amber-50 text-amber-800 border-amber-200",
    danger: "bg-red-50 text-red-700 border-red-200",
    ink: "bg-ink text-paper border-ink",
  };
  return <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-semibold ${tones[tone]} ${className}`}>{children}</span>;
}

export function LanguageSwitcher({ dark = false }: { dark?: boolean }) {
  const { locale, switchLocale, t } = useI18n();
  const opts: { v: Locale; label: string }[] = [{ v: "en", label: "EN" }, { v: "hi", label: "हिन्दी" }];
  return (
    <div role="group" aria-label={t.nav.language} className={`inline-flex rounded-lg p-0.5 ${dark ? "bg-white/10" : "bg-mist border border-line"}`}>
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          lang={o.v}
          aria-pressed={locale === o.v}
          onClick={() => switchLocale(o.v)}
          className={`h-8 min-w-11 rounded-md px-2.5 text-[13px] font-semibold transition-colors ${
            locale === o.v
              ? dark ? "bg-paper text-ink" : "bg-white text-ink shadow-sm"
              : dark ? "text-paper/70 hover:text-paper" : "text-subtle hover:text-text"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function ErrorNote({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useI18n();
  return (
    <div role="alert" className="flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      <span>{message === "network" ? t.app.serverDown : message}</span>
      {onRetry && <button onClick={onRetry} className="font-semibold underline underline-offset-2">{t.app.retry}</button>}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center gap-2 text-sm text-subtle" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> {label}
    </div>
  );
}
