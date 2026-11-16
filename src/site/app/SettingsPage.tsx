import React, { useState } from "react";
import { useI18n } from "../i18n";
import { useSession } from "../lib/session";
import { changePassword } from "../../firebase";
import { useLocationConsent } from "../lib/location";
import { Button, Card, LanguageSwitcher } from "../components/ui";
import { SafetyNote } from "../components/health";

/** embedded: shown inside the patient dashboard, which supplies its own page title. */
export default function SettingsPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t } = useI18n();
  const { user, demo } = useSession();
  const { coords, status, locate, revoke } = useLocationConsent();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const change = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setMsg(null);
    try {
      await changePassword(current, next);
      setMsg({ ok: true, text: t.settings.saved }); setCurrent(""); setNext("");
    } catch (err: any) { setMsg({ ok: false, text: err.message }); } finally { setBusy(false); }
  };
  const field = "mt-1.5 h-11 w-full rounded-lg border border-line bg-white px-3 text-[16px] outline-none focus:border-care focus:ring-4 focus:ring-care/15";

  return (
    <div className="mx-auto max-w-[720px] space-y-5">
      {!embedded && <h1 className="font-display text-[32px]">{t.settings.title}</h1>}
      <Card className="flex flex-wrap items-center justify-between gap-3 p-5">
        <h2 className="font-semibold">{t.settings.language}</h2>
        <LanguageSwitcher />
      </Card>
      <Card className="p-5">
        <h2 className="font-semibold">{t.settings.location}</h2>
        <p className="mt-1 text-sm text-subtle">{coords ? t.settings.locationOn : t.settings.locationOff}</p>
        <div className="mt-3">
          {coords ? <Button variant="secondary" onClick={revoke}>{t.settings.revoke}</Button> : <Button variant="secondary" onClick={locate} loading={status === "locating"}>{t.settings.allow}</Button>}
        </div>
      </Card>
      {/* Email accounts only: phone accounts sign in with a code and have no password. */}
      {user && !demo && !!user.email && (
        <Card className="p-5">
          <h2 className="font-semibold">{t.settings.changePassword}</h2>
          <form onSubmit={change} className="mt-3 space-y-3">
            <label className="block text-sm font-medium">{t.settings.current}<input type="password" className={field} value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" /></label>
            <label className="block text-sm font-medium">{t.settings.next}<input type="password" className={field} value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" minLength={8} /></label>
            <p className="text-xs text-subtle">{t.auth.passwordHint}</p>
            {msg && <p role="status" className={`text-sm ${msg.ok ? "text-health-deep" : "text-danger"}`}>{msg.text}</p>}
            <Button type="submit" loading={busy} disabled={!current || next.length < 8}>{t.settings.save}</Button>
          </form>
        </Card>
      )}
      <SafetyNote><strong>{t.settings.privacy}.</strong> {t.settings.privacyBody}</SafetyNote>
    </div>
  );
}
