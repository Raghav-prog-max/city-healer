/**
 * Frame for the staff screens of the site (provider workspace, hospital desk, admin pages):
 * brand, language, who is signed in, sign out, and for administrators links between their pages.
 */
import React from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { LanguageSwitcher, Logo } from "../components/ui";

export default function StaffShell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  const { t, href } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const who = session.profile?.email || session.profile?.phone || session.name;
  const signOut = async () => { await session.signOut(); navigate(href("/"), { replace: true }); };

  return (
    <div className="ch min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <Link to={href("/")} aria-label={t.brand.name}><Logo /></Link>
          {session.role === "ADMIN" && (
            <nav className="flex gap-1 text-sm font-semibold" aria-label={t.staff.nav.providers + " / " + t.staff.nav.listings}>
              {([["/admin/providers", t.staff.nav.providers], ["/admin/hospitals", t.staff.nav.listings]] as const).map(([path, label]) => (
                <NavLink key={path} to={href(path)} className={({ isActive }) => `rounded-lg px-3 py-1.5 ${isActive ? "bg-ink text-paper" : "text-subtle hover:text-text"}`}>{label}</NavLink>
              ))}
            </nav>
          )}
          <span className="ml-auto hidden text-sm text-subtle sm:inline">{who}</span>
          <LanguageSwitcher />
          <button onClick={signOut} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line px-3 text-sm font-semibold hover:border-care">
            <LogOut className="h-4 w-4" aria-hidden="true" />{t.staff.signOut}
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-[1100px] space-y-6 px-4 py-8">
        <div>
          <h1 className="font-display text-[30px] leading-tight">{title}</h1>
          <p className="mt-1.5 max-w-[640px] text-subtle">{sub}</p>
        </div>
        {children}
      </main>
    </div>
  );
}

export const fieldClass = "mt-1.5 h-11 w-full rounded-lg border border-line bg-white px-3 text-[16px] outline-none focus:border-care focus:ring-4 focus:ring-care/15";

/** "Wed, 18 Nov, 10:30 am – 11:00 am" in the reader's language and time zone. */
export function formatSlot(startsAt: string, endsAt: string, locale: string) {
  const tag = locale === "hi" ? "hi-IN" : "en-IN";
  const start = new Date(startsAt), end = new Date(endsAt);
  const time = (d: Date) => d.toLocaleTimeString(tag, { hour: "numeric", minute: "2-digit" });
  return `${start.toLocaleDateString(tag, { weekday: "short", day: "numeric", month: "short" })}, ${time(start)} – ${time(end)}`;
}
