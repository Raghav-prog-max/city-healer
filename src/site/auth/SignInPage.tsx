/**
 * Sign in with Firebase Authentication: a phone code (Firebase Phone Auth) or email and
 * password. New patients sign up through onboarding (/get-started), which also collects the
 * profile and consent; anyone signed in without a finished profile is sent there.
 */
import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ArrowLeft, Lock, Phone, Mail } from "lucide-react";
import { useI18n } from "../i18n";
import { useSession, staffHome } from "../lib/session";
import { auth, signInWithEmailAndPassword, sendPasswordResetEmail, requestPhoneOtp, confirmPhoneOtp, usingFirebaseEmulators } from "../../firebase";
import { Logo, Button, LanguageSwitcher } from "../components/ui";
import { request } from "../lib/api";

export default function SignInPage() {
  const { t, href } = useI18n();
  const session = useSession();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [method, setMethod] = useState<"phone" | "email">("phone");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [sentTo, setSentTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [demoAvailable, setDemoAvailable] = useState(false);
  const next = params.get("next") || href("/dashboard");

  useEffect(() => {
    request<any>("/api/health").then((h) => setDemoAvailable(!!h.demoMode)).catch(() => {});
  }, []);

  // Once signed in: staff to their workspace, unfinished profiles to onboarding, others onward.
  useEffect(() => {
    if (!session.ready || !session.user || !session.role) return;
    // Staff go back to the page they asked for when it is one of theirs, else to their home.
    if (session.role !== "PATIENT") {
      const home = staffHome(session.role, href);
      const area = session.role === "ADMIN" ? href("/admin") : home;
      navigate(params.get("next")?.startsWith(area) ? params.get("next")! : home, { replace: true });
    }
    else if (session.needsOnboarding) navigate(href("/get-started"), { replace: true });
    else navigate(next, { replace: true });
  }, [session.ready, session.user, session.role, session.needsOnboarding]); // eslint-disable-line react-hooks/exhaustive-deps

  const run = async (fn: () => Promise<unknown>) => {
    setError(""); setNotice(""); setBusy(true);
    try { await fn(); } catch (err: any) { setError(err?.message || t.app.error); } finally { setBusy(false); }
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    if (method === "email") return run(() => signInWithEmailAndPassword(auth, email, password));
    if (!sentTo) return run(async () => { setSentTo(await requestPhoneOtp(phone, "recaptcha-container")); setCode(""); });
    return run(() => confirmPhoneOtp(code));
  };

  const forgot = () => run(async () => {
    if (!email.trim()) throw { message: t.auth.forgotNeedsEmail };
    await sendPasswordResetEmail(auth, email);
    setNotice(t.auth.resetSent);
  });

  const field = "mt-1.5 h-12 w-full rounded-xl border border-line bg-white px-4 text-[16px] outline-none transition focus:border-care focus:ring-4 focus:ring-care/15";
  const canSubmit = method === "email" ? !!email && password.length >= 6 : sentTo ? /^\d{6}$/.test(code) : phone.replace(/\D/g, "").length >= 10;

  return (
    <div className="ch grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-ink p-12 text-paper lg:flex lg:flex-col">
        <div className="ch-grid-bg absolute inset-0" aria-hidden="true" />
        <div className="absolute -left-24 top-1/3 h-96 w-96 rounded-full bg-care/25 blur-[110px]" aria-hidden="true" />
        <Link to={href("/")} className="relative"><Logo dark /></Link>
        <div className="relative mt-auto">
          <p className="font-display text-[44px] leading-tight">{t.hero.title}</p>
          <p className="mt-4 flex items-center gap-2 text-paper/60"><Lock className="h-4 w-4 text-health" aria-hidden="true" />{t.hero.trust}</p>
        </div>
      </div>
      <div className="flex flex-col bg-white px-5 py-6 sm:px-10">
        <div className="flex items-center justify-between">
          <Link to={href("/")} className="inline-flex items-center gap-1.5 text-sm font-medium text-subtle hover:text-text"><ArrowLeft className="h-4 w-4" aria-hidden="true" />{t.auth.back}</Link>
          <LanguageSwitcher />
        </div>
        <main className="m-auto w-full max-w-[420px] py-10">
          <div className="lg:hidden"><Logo /></div>
          <h1 className="font-display mt-6 text-[34px] leading-tight">{t.auth.signInTitle}</h1>

          <div className="mt-6 inline-flex rounded-xl border border-line bg-mist p-1" role="tablist">
            {([["phone", Phone, t.auth.phone], ["email", Mail, t.auth.email]] as const).map(([m, Icon, label]) => (
              <button key={m} role="tab" aria-selected={method === m} onClick={() => { setMethod(m); setError(""); setNotice(""); }}
                className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-sm font-semibold ${method === m ? "bg-white text-text shadow-sm" : "text-subtle"}`}>
                <Icon className="h-4 w-4" aria-hidden="true" />{label}
              </button>
            ))}
          </div>

          <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
            {method === "email" ? (
              <>
                <label className="block text-sm font-semibold">{t.auth.email}
                  <input className={field} type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
                </label>
                <label className="block text-sm font-semibold">{t.auth.password}
                  <input className={field} type="password" value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="current-password" required />
                </label>
                <button type="button" onClick={forgot} className="text-sm font-semibold text-care-deep">{t.auth.forgot}</button>
              </>
            ) : (
              <>
                <label className="block text-sm font-semibold">{t.auth.phone}
                  <input className={field} type="tel" inputMode="tel" value={phone} onChange={(e) => { setPhone(e.target.value); setSentTo(""); }} autoComplete="tel" placeholder="+91 98765 43210" />
                </label>
                {sentTo && (
                  <label className="block text-sm font-semibold">{t.auth.code} <span className="font-normal text-subtle">({sentTo})</span>
                    <input className={`${field} tracking-[0.4em]`} inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))} />
                  </label>
                )}
                {sentTo && <button type="button" onClick={() => run(async () => setSentTo(await requestPhoneOtp(phone, "recaptcha-container")))} className="text-sm font-semibold text-care-deep">{t.auth.resend}</button>}
                {usingFirebaseEmulators && <p className="rounded-lg bg-mist px-3 py-2 text-xs text-subtle">{t.auth.emulatorHint}</p>}
              </>
            )}
            <div id="recaptcha-container" />
            {error && <p role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{error}</p>}
            {notice && <p role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{notice}</p>}
            <Button type="submit" size="lg" className="w-full" loading={busy} disabled={!canSubmit}>
              {busy ? t.auth.working : method === "phone" && !sentTo ? t.auth.sendCode : t.auth.signIn}
            </Button>
          </form>
          <p className="mt-6 text-center text-sm text-subtle">
            {t.auth.noAccount}{" "}
            <Link to={href("/get-started")} className="font-semibold text-care-deep">{t.auth.signUp}</Link>
          </p>
          {demoAvailable && (
            <div className="mt-8 border-t border-line pt-6 text-center">
              <button
                className="text-sm font-semibold text-subtle underline underline-offset-4 hover:text-text"
                onClick={() => { session.startDemo(); navigate(next, { replace: true }); }}
              >
                {t.auth.demo}
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
