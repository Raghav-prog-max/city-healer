/**
 * Voice input and spoken replies (Web Speech API).
 *
 * Why the old hands-free mode failed, and what is different here:
 *  - It ran one long continuous session. Chrome ends those after a pause or ~60 s and the
 *    app never restarted it, so it silently stopped listening. Here each utterance is its
 *    own short session, restarted explicitly.
 *  - It never spoke the answer, so "hands-free" still needed eyes on the screen. Replies
 *    are read aloud with an Indian English or Hindi voice where the device has one.
 *  - It listened while the app was talking, and transcribed itself. Listening now waits
 *    until speech synthesis has finished.
 *  - Errors (microphone blocked, no speech) were shown as raw codes or swallowed.
 */
import { useCallback, useEffect, useRef, useState } from "react";

type Rec = any;

export const speechSupported = (): boolean =>
  typeof window !== "undefined" && !!((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

export const synthesisSupported = (): boolean => typeof window !== "undefined" && "speechSynthesis" in window;

export type SpeechError = "blocked" | "no-speech" | "network" | "unsupported" | null;

export function useSpeechInput(lang: "en" | "hi") {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<SpeechError>(null);
  const recRef = useRef<Rec | null>(null);

  const stop = useCallback(() => {
    try { recRef.current?.abort(); } catch {}
    recRef.current = null;
    setListening(false);
    setInterim("");
  }, []);

  /** Listen for one utterance; resolves with the final text ("" if nothing was said). */
  const listenOnce = useCallback((): Promise<string> => {
    return new Promise((resolve) => {
      const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (!SR) { setError("unsupported"); resolve(""); return; }
      try { recRef.current?.abort(); } catch {}
      const rec: Rec = new SR();
      recRef.current = rec;
      // en-IN copes with Hinglish in Latin script; hi-IN returns Devanagari.
      rec.lang = lang === "hi" ? "hi-IN" : "en-IN";
      rec.interimResults = true;
      rec.continuous = false;
      rec.maxAlternatives = 1;
      let finalText = "";
      rec.onstart = () => { setListening(true); setError(null); setInterim(""); };
      rec.onresult = (e: any) => {
        let live = "";
        for (let i = e.resultIndex; i < e.results.length; i++) {
          const r = e.results[i];
          if (r.isFinal) finalText += r[0].transcript;
          else live += r[0].transcript;
        }
        setInterim((finalText + " " + live).trim());
      };
      rec.onerror = (e: any) => {
        if (e.error === "not-allowed" || e.error === "service-not-allowed") setError("blocked");
        else if (e.error === "no-speech") setError("no-speech");
        else if (e.error === "network") setError("network");
      };
      rec.onend = () => {
        if (recRef.current === rec) recRef.current = null;
        setListening(false);
        setInterim("");
        resolve(finalText.trim());
      };
      try { rec.start(); } catch { setListening(false); resolve(""); }
    });
  }, [lang]);

  useEffect(() => () => { try { recRef.current?.abort(); } catch {} }, []);

  return { supported: speechSupported(), listening, interim, error, listenOnce, stop, setError };
}

function pickVoice(lang: "en" | "hi"): SpeechSynthesisVoice | undefined {
  const voices = window.speechSynthesis.getVoices();
  const want = lang === "hi" ? ["hi-IN", "hi"] : ["en-IN", "en-GB", "en-US", "en"];
  for (const w of want) {
    const v = voices.find((x) => x.lang.replace("_", "-").toLowerCase().startsWith(w.toLowerCase()));
    if (v) return v;
  }
  return undefined;
}

/** Read text aloud; resolves when finished (or at once if speech is unavailable). */
export function speak(text: string, lang: "en" | "hi"): Promise<void> {
  return new Promise((resolve) => {
    if (!synthesisSupported() || !text) return resolve();
    window.speechSynthesis.cancel();
    // Bracketed asides and URLs read badly; speak the plain sentence.
    const clean = text.replace(/\[[^\]]*\]/g, "").replace(/https?:\/\/\S+/g, "").trim();
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = lang === "hi" ? "hi-IN" : "en-IN";
    const v = pickVoice(lang);
    if (v) u.voice = v;
    u.rate = 1;
    let done = false;
    const finish = () => { if (!done) { done = true; clearInterval(poll); resolve(); } };
    u.onend = finish;
    u.onerror = finish;
    window.speechSynthesis.speak(u);
    // Some browsers never fire onend; watch the speaking flag instead of guessing a time,
    // so the microphone never reopens while the app is still talking.
    const started = Date.now();
    const poll = setInterval(() => {
      if (Date.now() - started > 1000 && !window.speechSynthesis.speaking) finish();
      if (Date.now() - started > 60000) finish();
    }, 250);
  });
}

export function stopSpeaking() {
  if (synthesisSupported()) window.speechSynthesis.cancel();
}
