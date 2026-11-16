/**
 * City Healer AI Assistant: chat and voice over the AI orchestrator (/api/ai/copilot).
 *
 * Hands-free mode: listen to one utterance -> send it -> read the answer aloud -> listen
 * again, until switched off. Each turn is its own recognition session, and listening only
 * resumes after the spoken answer has finished (see lib/speech.ts for why).
 */
import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Send, Mic, MicOff, Headphones, Volume2, RotateCcw, ChevronDown, Sparkles, Siren, ArrowRight } from "lucide-react";
import { useI18n } from "../i18n";
import { request } from "../lib/api";
import { useLocationConsent } from "../lib/location";
import { useSpeechInput, speak, stopSpeaking, synthesisSupported } from "../lib/speech";
import { Badge, Button, ErrorNote } from "../components/ui";
import { DietPlanView, DoctorCard, HospitalCard, LabResult, MedicineView, TriageView, SafetyNote } from "../components/health";

interface Reply {
  intent: string;
  confidence: number;
  reply: string;
  card?: { type: string; data: any };
  action?: { label: string; tab: string };
  trace: { step: string; model: string; detail: string; ms: number }[];
  disclaimer: string;
}
type Msg = { id: number; role: "user" | "ai"; text: string; data?: Reply; error?: string };

// The orchestrator names screens of the old app; map them to the new routes.
const TAB_ROUTES: Record<string, string> = {
  sos: "/app/emergency", symptoms: "/app/assistant", records: "/app/wallet", pharmacy: "/app/medicines",
  chn: "/app/nutrition", consultation: "/app/find-care?tab=doctors", beds: "/app/find-care?tab=hospitals", insurance: "/app/settings",
};

function AiCard({ card, onPick }: { card: NonNullable<Reply["card"]>; onPick: (intent: string) => void }) {
  const { t } = useI18n();
  switch (card.type) {
    case "triage": return <TriageView r={card.data} />;
    case "lab": return <LabResult a={card.data} />;
    case "diet": return <DietPlanView plan={card.data} />;
    case "medicine": return <MedicineView m={card.data} substitutes={card.data.substitutes} />;
    case "medicines": return <div className="grid gap-2">{card.data.map((m: any) => <div key={m.name} className="rounded-xl border border-line p-3"><p className="font-medium">{m.name}</p><p className="text-sm text-subtle">{m.composition} · {m.uses.slice(0, 2).join(", ")}</p></div>)}</div>;
    case "doctors": return <div className="grid gap-2 sm:grid-cols-2">{card.data.map((d: any) => <DoctorCard key={d.id} d={d} />)}</div>;
    case "hospitals": return <div className="grid gap-2 sm:grid-cols-2">{card.data.map((h: any) => <HospitalCard key={h.id} h={h} compact />)}</div>;
    case "emergency": return (
      <div className="space-y-3">
        <a href="tel:112" className="flex h-14 items-center justify-center gap-2 rounded-xl bg-danger text-lg font-bold text-white"><Siren className="h-5 w-5" aria-hidden="true" />{t.emergency.call}</a>
        <SafetyNote tone="danger">{t.emergency.noDispatch}</SafetyNote>
        <div className="grid gap-2 sm:grid-cols-2">{card.data.hospitals?.map((h: any) => <HospitalCard key={h.id} h={h} compact />)}</div>
      </div>
    );
    case "choices": return (
      <div className="flex flex-wrap gap-2">
        {card.data.map((intent: string) => (
          <button key={intent} onClick={() => onPick(intent)} className="h-10 rounded-full border border-line bg-white px-4 text-sm font-medium hover:border-care">{(t.intents as any)[intent] || intent}</button>
        ))}
      </div>
    );
    default: return null;
  }
}

/** embedded: shown inside the patient dashboard, which supplies its own page title. */
export default function AssistantPage({ embedded = false }: { embedded?: boolean } = {}) {
  const { t, locale, href } = useI18n();
  const { coords } = useLocationConsent();
  const [params, setParams] = useSearchParams();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [handsFree, setHandsFree] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceReplies, setVoiceReplies] = useState(false);
  const handsFreeRef = useRef(false);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const speech = useSpeechInput(locale);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [messages, busy]);

  const send = useCallback(async (text: string): Promise<Reply | null> => {
    const message = text.trim();
    if (!message) return null;
    setMessages((m) => [...m, { id: idRef.current++, role: "user", text: message }]);
    setInput("");
    setBusy(true);
    try {
      const data = await request<Reply>("/api/ai/copilot", { body: { message, userLat: coords?.lat, userLng: coords?.lng } });
      setMessages((m) => [...m, { id: idRef.current++, role: "ai", text: data.reply, data }]);
      return data;
    } catch (e: any) {
      setMessages((m) => [...m, { id: idRef.current++, role: "ai", text: "", error: e.message }]);
      return null;
    } finally {
      setBusy(false);
    }
  }, [coords]);

  // A question passed from Home or elsewhere: ?q=...
  useEffect(() => {
    const q = params.get("q");
    if (q) { setParams({}, { replace: true }); send(q); }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // One-shot dictation: speak, then it is sent.
  const dictate = async () => {
    if (speech.listening) { speech.stop(); return; }
    stopSpeaking();
    const text = await speech.listenOnce();
    if (text) {
      const r = await send(text);
      if (r && voiceReplies) { setSpeaking(true); await speak(r.reply, locale); setSpeaking(false); }
    }
  };

  // Hands-free conversation loop.
  const runHandsFree = useCallback(async () => {
    let silent = 0;
    while (handsFreeRef.current) {
      const text = await speech.listenOnce();
      if (!handsFreeRef.current) break;
      if (!text) {
        // Stop after three silent turns, or at once if the microphone is blocked.
        if (++silent >= 3) break;
        continue;
      }
      silent = 0;
      const r = await send(text);
      if (!handsFreeRef.current) break;
      if (r) {
        setSpeaking(true);
        await speak(r.reply, locale);
        setSpeaking(false);
        // An emergency answer ends hands-free: the person needs to act, not keep talking.
        if (r.intent === "emergency_rule") break;
      }
    }
    handsFreeRef.current = false;
    setHandsFree(false);
  }, [speech, send, locale]);

  const toggleHandsFree = () => {
    if (handsFree) {
      handsFreeRef.current = false;
      setHandsFree(false);
      speech.stop();
      stopSpeaking();
      setSpeaking(false);
    } else {
      handsFreeRef.current = true;
      setHandsFree(true);
      runHandsFree();
    }
  };

  useEffect(() => { if (speech.error === "blocked" || speech.error === "unsupported") { handsFreeRef.current = false; setHandsFree(false); } }, [speech.error]);
  useEffect(() => () => { handsFreeRef.current = false; stopSpeaking(); }, []);

  const pickIntent = (intent: string) => {
    const examples: Record<string, string> = { symptoms: t.assistant.s1, lab_report: t.assistant.s2, medicine: t.assistant.s3, diet: t.assistant.s4 };
    if (examples[intent]) setInput(examples[intent]);
    else send((t.intents as any)[intent] || intent);
  };

  const status = speaking ? t.assistant.speaking : speech.listening ? t.assistant.listening : busy ? t.assistant.thinking : "";

  return (
    <div className="mx-auto flex h-[calc(100vh-11rem)] max-w-[860px] flex-col lg:h-[calc(100vh-7.5rem)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          {!embedded && <h1 className="font-display text-[30px] leading-tight">{t.assistant.title}</h1>}
          <p className="mt-1 text-sm text-subtle">{t.assistant.scope}</p>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => { setMessages([]); stopSpeaking(); }}><RotateCcw className="h-4 w-4" aria-hidden="true" />{t.assistant.clear}</Button>
        )}
      </div>

      <div className="mt-4 flex-1 space-y-4 overflow-y-auto rounded-2xl border border-line bg-white p-4 sm:p-5" aria-live="polite">
        {messages.length === 0 && (
          <div className="py-6">
            <p className="flex items-center gap-2 text-sm font-semibold text-subtle"><Sparkles className="h-4 w-4 text-care" aria-hidden="true" />{t.assistant.suggestions}</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {[t.assistant.s1, t.assistant.s2, t.assistant.s3, t.assistant.s4].map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-xl border border-line px-4 py-3 text-left text-[15px] hover:border-care hover:bg-sky-50/50">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) =>
          m.role === "user" ? (
            <p key={m.id} className="ml-auto w-fit max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-care px-4 py-2.5 text-white">{m.text}</p>
          ) : m.error ? (
            <ErrorNote key={m.id} message={m.error} />
          ) : (
            <div key={m.id} className="max-w-full space-y-3 rounded-2xl rounded-bl-md border border-line bg-mist/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <p className="leading-relaxed">{m.text}</p>
                {synthesisSupported() && (
                  <button onClick={() => speak(m.text, locale)} aria-label="Read aloud" className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-subtle hover:bg-white hover:text-text"><Volume2 className="h-4 w-4" /></button>
                )}
              </div>
              {m.data?.card && <div className="rounded-xl bg-white p-4"><AiCard card={m.data.card} onPick={pickIntent} /></div>}
              {m.data?.action && TAB_ROUTES[m.data.action.tab] && TAB_ROUTES[m.data.action.tab] !== "/app/assistant" && (
                <Link to={href(TAB_ROUTES[m.data.action.tab])} className="inline-flex items-center gap-1 text-sm font-semibold text-care-deep">{m.data.action.label}<ArrowRight className="h-4 w-4" aria-hidden="true" /></Link>
              )}
              {m.data && (
                <details className="group text-sm">
                  <summary className="flex list-none items-center gap-1 text-subtle hover:text-text">
                    <ChevronDown className="h-4 w-4 transition-transform group-open:rotate-180" aria-hidden="true" />{t.assistant.howModel}
                  </summary>
                  <ol className="mt-2 space-y-1 rounded-lg bg-white p-3 font-mono text-xs text-subtle">
                    {m.data.trace.map((s, i) => <li key={i}>{i + 1}. {s.model}: {s.detail} <span className="opacity-60">({s.ms} ms)</span></li>)}
                  </ol>
                </details>
              )}
              {m.data && <p className="flex items-center gap-2 text-xs text-subtle"><Badge tone="care">{t.assistant.decisionSupport}</Badge>{m.data.disclaimer}</p>}
            </div>
          ),
        )}
        {busy && <p className="text-sm text-subtle" role="status">{t.assistant.thinking}</p>}
        <div ref={endRef} />
      </div>

      {(speech.error === "blocked" || speech.error === "unsupported") && (
        <div className="mt-3"><SafetyNote tone="warn">{speech.error === "blocked" ? t.assistant.micBlocked : t.assistant.noSpeech}</SafetyNote></div>
      )}
      {handsFree && <p className="mt-3 rounded-xl bg-green-50 px-4 py-2 text-sm text-health-deep">{t.assistant.handsFreeOn}</p>}

      <form
        className="mt-3 flex items-end gap-2"
        onSubmit={(e) => { e.preventDefault(); send(input); }}
      >
        <div className="relative flex-1">
          <label htmlFor="assistant-input" className="sr-only">{t.assistant.placeholder}</label>
          <textarea
            id="assistant-input"
            rows={1}
            value={speech.listening ? speech.interim || "" : input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(input); } }}
            placeholder={status || t.assistant.placeholder}
            readOnly={speech.listening}
            className="block max-h-40 min-h-[52px] w-full resize-none rounded-xl border border-line bg-white px-4 py-3.5 text-[16px] outline-none focus:border-care focus:ring-4 focus:ring-care/15"
          />
        </div>
        {speech.supported && (
          <>
            <button
              type="button"
              onClick={dictate}
              disabled={handsFree}
              aria-pressed={speech.listening && !handsFree}
              aria-label={speech.listening ? t.assistant.stop : t.assistant.listen}
              title={speech.listening ? t.assistant.stop : t.assistant.listen}
              className={`grid h-[52px] w-[52px] place-items-center rounded-xl border transition-colors disabled:opacity-40 ${speech.listening && !handsFree ? "border-danger bg-danger text-white" : "border-line bg-white hover:border-care"}`}
            >
              {speech.listening && !handsFree ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
            </button>
            <button
              type="button"
              onClick={toggleHandsFree}
              aria-pressed={handsFree}
              title={handsFree ? t.assistant.handsFreeOn : t.assistant.handsFree}
              className={`hidden h-[52px] items-center gap-2 rounded-xl border px-4 text-sm font-semibold transition-colors sm:inline-flex ${handsFree ? "border-health bg-health text-white" : "border-line bg-white hover:border-care"}`}
            >
              <Headphones className="h-5 w-5" aria-hidden="true" />{t.assistant.handsFree}
            </button>
          </>
        )}
        <Button type="submit" size="lg" className="h-[52px]" disabled={!input.trim() || busy} aria-label={t.assistant.send}><Send className="h-5 w-5" aria-hidden="true" /></Button>
      </form>
      <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-subtle">
        {speech.supported && (
          <button type="button" onClick={toggleHandsFree} aria-pressed={handsFree} className="font-semibold text-care-deep sm:hidden">
            <Headphones className="mr-1 inline h-4 w-4" aria-hidden="true" />{t.assistant.handsFree}: {handsFree ? "ON" : "OFF"}
          </button>
        )}
        {synthesisSupported() && (
          <label className="inline-flex items-center gap-2">
            <input type="checkbox" className="accent-care" checked={voiceReplies} onChange={(e) => setVoiceReplies(e.target.checked)} />
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />{t.assistant.readAloud}
          </label>
        )}
        {status && <span role="status">{status}</span>}
      </div>
    </div>
  );
}
