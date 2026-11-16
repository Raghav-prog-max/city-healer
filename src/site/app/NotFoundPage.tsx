/**
 * Any address the site does not know. This used to fall through to the earlier workspace
 * (src/App.tsx), which has been retired; everything now lives in src/site.
 */
import React from "react";
import { Link } from "react-router-dom";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { ButtonLink, LanguageSwitcher, Logo } from "../components/ui";

export default function NotFoundPage() {
  const { t, href } = useI18n();
  const session = useSession();
  const signedIn = !!session.user || session.demo;
  return (
    <div className="ch min-h-screen bg-paper">
      <header className="border-b border-line bg-white">
        <div className="mx-auto flex max-w-[1100px] items-center gap-4 px-4 py-3">
          <Link to={href("/")} aria-label={t.brand.name}><Logo /></Link>
          <span className="ml-auto"><LanguageSwitcher /></span>
        </div>
      </header>
      <main className="mx-auto max-w-[640px] px-4 py-16">
        <p className="font-mono text-sm font-semibold text-subtle">404</p>
        <h1 className="mt-2 font-display text-[30px] leading-tight">{t.notFound.title}</h1>
        <p className="mt-3 text-subtle">{t.notFound.body}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <ButtonLink to={href("/")}>{t.notFound.home}</ButtonLink>
          {signedIn && <ButtonLink to={href("/dashboard")} variant="secondary">{t.notFound.dashboard}</ButtonLink>}
        </div>
      </main>
    </div>
  );
}
