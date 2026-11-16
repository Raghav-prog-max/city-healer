// The patient's messages panel and same-day check-in line for one Firestore booking
// (server/firebase/messages.ts and server/firebase/checkin.ts). Strings come from the copy object
// in PatientDashboard.jsx, passed in as `t`. Message text is rendered as plain React text.
import React, { useState } from "react";
import { createPortal } from "react-dom";
import { X, Phone, Ambulance, AlertTriangle, Send } from "lucide-react";
import { request } from "../lib/api";
import { useThread } from "../lib/useThread";
import { useVisiblePoll } from "../lib/usePoll";
import { MESSAGE_MAX, checkInOpen, checkInLaterToday, doctorOpenedLine, doctorTitle, fill, istDayKey } from "../lib/appointmentThread";

const shown = (t, e) => (e === "network" ? t.serverDown : e);
const stamp = (iso, lang) => new Date(iso).toLocaleString(lang === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** The sentence that replaces the composer when nobody can post (closedCode from the server). */
function closedSentence(meta, t, name) {
  if (meta.closedCode === "CHAT_NOT_OPEN_YET") return fill(t.chatNotOpenYet, { name });
  if (meta.closedCode === "CHAT_CLOSED") return t.chatClosed;
  if (meta.closedCode === "APPOINTMENT_CANCELLED") return t.chatCancelled;
  return meta.closedReason || t.chatClosed;
}

/**
 * Mounted only while open; closing it unmounts the thread, which stops its polling. Rendered
 * into document.body (inside a .chd wrapper for the dashboard styles), so a transformed parent
 * such as the animated view frame cannot turn its fixed backdrop into a box inside the card.
 */
export function MessagesModal({ a, t, lang, onClose, onRead, onSOS }) {
  const { messages, meta, error, postError, sending, send, loaded } = useThread(a.id, "patient", onRead);
  const [text, setText] = useState("");
  // The red banner answers a post made in this modal whose reply carried `safety`, until
  // dismissed. It is not rebuilt from the thread's history: an old notice, already seen and
  // dismissed, stays in the thread as an amber message but does not raise the banner again.
  const [banner, setBanner] = useState(false);
  const name = doctorTitle(a.doctorName, t.drPrefix) || a.doctorName || "";
  const line = doctorOpenedLine(messages, meta && meta.chat);

  const submit = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    const r = await send(body);
    if (r !== false) setText("");
    if (r && r.level === "emergency") setBanner(true);
  };

  return createPortal(<div className="chd"><div className="modal-backdrop" onClick={onClose}>
    <div className="modal msg-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby={`msg-title-${a.id}`}>
      <button className="modal-x" onClick={onClose} aria-label={t.close}><X /></button>
      <h3 id={`msg-title-${a.id}`}>{t.messagesTitle}</h3>
      <div className="msg-sub">{name} · {a.date} {a.time}</div>

      {error && <div className="msg-error" role="alert">{loaded ? shown(t, error) : t.threadError}</div>}
      {loaded && <div className="chat-messages msg-thread" aria-live="polite">
        {messages.length === 0 ? <div className="msg-empty">{t.noMessages}</div> : messages.map((m) => m.sender === "system"
          ? <div key={m.id} className="msg-system" role="note"><AlertTriangle size={14} /><div><div className="msg-meta">{stamp(m.createdAt, lang)}</div>{m.text}</div></div>
          : <div key={m.id} className={"bubble " + (m.sender === "patient" ? "user" : "ai")}>
            <div className="msg-meta">{m.sender === "patient" ? t.you : name} · {stamp(m.createdAt, lang)}</div>
            <div className="msg-text">{m.text}</div>
          </div>)}
      </div>}
      {line && <div className="msg-read">{line.state === "opened" ? fill(t.openedAt, { time: stamp(line.at, lang) }) : t.notOpened}</div>}

      {banner && <div className="msg-alert" role="alert">
        <div><AlertTriangle size={15} /><span>{t.redFlag}</span></div>
        <div className="msg-alert-actions">
          <a href="tel:112"><Phone size={14} />{t.call112}</a>
          <button type="button" onClick={onSOS}><Ambulance size={14} />{t.openSos}</button>
          <button type="button" className="msg-dismiss" onClick={() => setBanner(false)}>{t.dismiss}</button>
        </div>
      </div>}

      <div className="msg-notice">{fill(t.notMonitored, { name })} <a href="tel:112">{t.call112}</a></div>
      {meta && (meta.canPost ? <form className="msg-compose" onSubmit={submit}>
        <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={MESSAGE_MAX} rows={3} placeholder={t.writeMessage} aria-label={t.writeMessage} />
        <div className="msg-compose-row"><span>{text.length}/{MESSAGE_MAX}</span><button className="primary-btn" type="submit" disabled={sending || !text.trim()}><Send size={13} />{t.send}</button></div>
        {postError && <div className="msg-error" role="alert">{shown(t, postError)}</div>}
      </form> : <div className="msg-closed">{closedSentence(meta, t, name)}</div>)}
    </div>
  </div></div>, document.body);
}

const QUEUE_POLL_MS = 30_000;
const CLOCK_MS = 30_000;

/**
 * "I have arrived" on a confirmed in-person booking on its day from one hour before, then the
 * patient's place in the line (a count, never a time) and "Leave the line". The server decides
 * whether check-in is open; the clock here only chooses when to show the button.
 */
export function CheckInLine({ a, t, onChanged }) {
  const fromProps = a.calledAt ? "called" : a.arrivedAt ? "waiting" : "not_arrived";
  const [view, setView] = useState({ state: fromProps, ahead: null, estimate: null, from: fromProps });
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  // A reloaded list (after leaving, or a refresh) is newer than what this line last showed.
  let current = view;
  if (view.from !== fromProps) { current = { state: fromProps, ahead: view.state === fromProps ? view.ahead : null, from: fromProps }; setView(current); }

  // Only on the booking's own (IST) day: an arrival left on an earlier day is not a place in today's line.
  const today = istDayKey(now) === istDayKey(a.startsAt);
  const inLine = today && (current.state === "waiting" || current.state === "called");
  useVisiblePoll(() => setNow(Date.now()), CLOCK_MS, !inLine && checkInLaterToday(a.startsAt, a.endsAt, now));
  useVisiblePoll(async () => {
    try {
      const r = await request(`/api/v1/appointments/${encodeURIComponent(a.id)}/queue`);
      setView((v) => ({ ...v, state: r.state, ahead: r.ahead, estimate: r.estimate ?? null }));
      if (r.state === "done" || r.state === "not_arrived") onChanged();
    } catch (e) {
      // Cancelled or no longer in person: the list reload shows the booking as it is now. Any
      // other failure (network, too many requests) keeps the last place shown.
      if (e && (e.status === 409 || e.status === 404)) { setView((v) => ({ ...v, state: "not_arrived", ahead: null })); onChanged(); }
    }
  }, QUEUE_POLL_MS, inLine);

  const call = async (method) => {
    setBusy(true); setError("");
    try {
      const r = await request(`/api/v1/appointments/${encodeURIComponent(a.id)}/check-in`, { method });
      setView((v) => ({ ...v, state: r.state, ahead: r.ahead ?? null, estimate: r.estimate ?? null }));
      onChanged();
    } catch (e) { setError(shown(t, e.message)); onChanged(); } finally { setBusy(false); }
  };

  let body = null;
  if (!today) body = null;
  else if (current.state === "called") body = <b>{t.doctorReady}</b>;
  else if (current.state === "waiting") {
    const place = current.ahead === null ? "" : current.ahead === 0 ? t.youAreNext : current.ahead === 1 ? t.aheadOne : fill(t.aheadMany, { n: current.ahead });
    body = <>
      <span>{t.checkedIn} {place} {current.ahead ? t.notATime : ""} {current.ahead && current.estimate ? fill(t.waitEstimate, { low: current.estimate.low, high: current.estimate.high }) : ""} {fill(t.bookedTime, { time: a.time })}</span>
      <button type="button" className="text-btn" disabled={busy} onClick={() => call("DELETE")}>{t.leaveLine}</button>
    </>;
  } else if (current.state === "not_arrived" && checkInOpen(a.startsAt, a.endsAt, now)) {
    body = <button type="button" className="primary-btn" disabled={busy} onClick={() => call("POST")}>{t.arrived}</button>;
  }
  if (!body && !error) return null;
  return <div className="checkin-line" role="status">{body}{error && <span className="msg-error" role="alert">{error}</span>}</div>;
}
