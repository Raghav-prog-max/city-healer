/**
 * Frame for the staff screens of the new site (provider workspace, provider review): brand,
 * language, who is signed in, sign out, and a link to the earlier workspace (src/App.tsx),
 * which still holds the consultation tools until they move here.
 */
import React from "react";
import { Link, useNavigate } from "react-router-dom";
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
        <p className="pt-2 text-sm"><a href="/dashboard" className="font-semibold text-care-deep underline underline-offset-2">{t.staff.legacy}</a></p>
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
