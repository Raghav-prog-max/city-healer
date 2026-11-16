/**
 * The doctor's messages panel for one booking (server/firebase/messages.ts). Mounted only while
 * open: it loads the thread, polls every 15 s while the tab is visible, and marks it read when
 * the open panel shows something new. Text is rendered as plain text, never as HTML.
 */
import React, { useState } from "react";
import { useI18n } from "../i18n";
import { Button } from "../components/ui";
import { useThread } from "../lib/useThread";
import { MESSAGE_MAX, type ThreadMessage } from "../lib/appointmentThread";

export default function BookingMessages({ appointmentId, patientName, onRead }: { appointmentId: string; patientName: string; onRead: () => void }) {
  const { t, locale } = useI18n();
  const p = t.staff.provider;
  const { messages, meta, error, postError, sending, send, loaded } = useThread(appointmentId, "doctor", onRead);
  const [text, setText] = useState("");
  const shown = (m: string) => (m === "network" ? t.app.serverDown : m);
  const time = (iso: string) => new Date(iso).toLocaleString(locale === "hi" ? "hi-IN" : "en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    if ((await send(body)) !== false) setText("");
  };

  const bubble = (m: ThreadMessage) => {
    if (m.sender === "system") {
      return (
        <div key={m.id} className="w-full rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
          <p className="text-xs font-semibold">{p.systemLabel} · {time(m.createdAt)}</p>
          <p className="mt-1 whitespace-pre-wrap break-words">{m.text}</p>
        </div>
      );
    }
    const own = m.sender === "doctor";
    return (
      <div key={m.id} className={`max-w-[85%] rounded-lg px-3 py-2 ${own ? "ml-auto bg-sky-50" : "mr-auto border border-line bg-white"}`}>
        <p className="text-xs text-subtle">{own ? p.you : patientName || p.patient} · {time(m.createdAt)}</p>
        <p className="mt-0.5 whitespace-pre-wrap break-words">{m.text}</p>
      </div>
    );
  };

  return (
    <div className="mt-3 space-y-3 rounded-lg border border-line bg-mist p-3">
      <p className="text-xs text-subtle">{p.messagesNote}</p>
      {error && <p role="alert" className="text-sm text-danger">{shown(error)}</p>}
      {loaded && (
        <div className="flex max-h-80 flex-col gap-2 overflow-y-auto" aria-live="polite">
          {messages.length === 0 ? <p className="text-subtle">{p.noMessages}</p> : messages.map(bubble)}
        </div>
      )}
      {meta && (meta.canPost ? (
        <form onSubmit={submit} className="space-y-2">
          <label className="block text-sm font-medium">{p.writeMessage}
            <textarea className="mt-1 w-full rounded-lg border border-line bg-white p-2.5 text-[15px] outline-none focus:border-care focus:ring-4 focus:ring-care/15" rows={3}
              value={text} onChange={(e) => setText(e.target.value)} maxLength={MESSAGE_MAX} />
          </label>
          <div className="flex items-center gap-2">
            <Button size="sm" type="submit" loading={sending} disabled={!text.trim()}>{p.send}</Button>
            <span className="ml-auto text-xs text-subtle">{text.length}/{MESSAGE_MAX}</span>
          </div>
          {postError && <p role="alert" className="text-sm text-danger">{shown(postError)}</p>}
        </form>
      ) : meta.closedReason ? <p className="text-sm text-subtle">{meta.closedReason}</p> : null)}
    </div>
  );
}
