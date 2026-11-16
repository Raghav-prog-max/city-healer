/**
 * One appointment's message thread, for the panel that shows it (patient or doctor). Mount it
 * only while the panel is open: it loads the thread, polls for newer messages every 15 s while
 * the tab is visible, and marks the thread read only when the open panel has something new to
 * show, and only up to what it has shown ({ upTo: cursor }). If `appointmentId` changes, the
 * thread starts over: nothing of the previous booking is kept, shown or used as a cursor.
 * Server: server/firebase/messages.ts.
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { request } from "./api";
import { useVisiblePoll } from "./usePoll";
import { mergeThread, needsRead, type ThreadChat, type ThreadMessage } from "./appointmentThread";

export const MESSAGES_POLL_MS = 15_000;

type ThreadMeta = { chat: ThreadChat; canPost: boolean; closedCode?: string; closedReason?: string; opensAt: string; closesAt: string };
type ThreadResponse = ThreadMeta & { messages: ThreadMessage[] };
type PostResponse = { messages: ThreadMessage[]; safety?: { level: "emergency"; kind: string } };

export function useThread(appointmentId: string, role: "patient" | "doctor", onRead?: () => void) {
  const route = `/api/v1/appointments/${encodeURIComponent(appointmentId)}/messages`;
  const [messages, setMessages] = useState<ThreadMessage[]>([]);
  const [meta, setMeta] = useState<ThreadMeta | null>(null);
  const [error, setError] = useState("");
  const [postError, setPostError] = useState("");
  const [sending, setSending] = useState(false);

  const list = useRef<ThreadMessage[]>([]);
  const cursor = useRef(0);
  const inFlight = useRef(false);
  const loadedOnce = useRef(false);
  const alive = useRef(true);
  const onReadRef = useRef(onRead);
  useEffect(() => { onReadRef.current = onRead; });
  useEffect(() => { alive.current = true; return () => { alive.current = false; }; }, []);

  // Another booking: start over. Done during render, so no poll for the new id can run with the
  // old cursor; `thread` lets a request for the old id that is still in flight be ignored.
  const thread = useRef(route);
  if (thread.current !== route) {
    thread.current = route;
    list.current = []; cursor.current = 0; loadedOnce.current = false; inFlight.current = false;
    setMessages([]); setMeta(null); setError(""); setPostError("");
  }

  const add = (more: ThreadMessage[]) => {
    if (!more.length) return;
    const merged = mergeThread(list.current, more);
    list.current = merged.messages;
    cursor.current = merged.cursor;
    setMessages(merged.messages);
  };

  const load = useCallback(async () => {
    if (inFlight.current) return;
    inFlight.current = true;
    const current = () => alive.current && thread.current === route;
    try {
      const r = await request<ThreadResponse>(`${route}?after=${cursor.current}`);
      if (!current()) return;
      const { messages: more, ...rest } = r;
      add(more);
      setMeta(rest);
      setError("");
      const first = !loadedOnce.current;
      loadedOnce.current = true;
      // Read state changes only when the open, visible panel has shown something new, and only
      // up to what it has shown: anything written after this fetch stays unread.
      const shown = cursor.current;
      if ((first || more.length > 0) && needsRead(role, r.chat, shown) && document.visibilityState === "visible") {
        await request(`${route}/read`, { body: { upTo: shown } });
        if (current()) onReadRef.current?.();
      }
    } catch (e: any) {
      if (current()) setError(e?.message || "error");
    } finally {
      if (thread.current === route) inFlight.current = false;
    }
  }, [route, role]);

  useVisiblePoll(load, MESSAGES_POLL_MS, true);

  /** Post one message. Resolves to the server's safety flag, or false when it was refused. */
  const send = async (text: string): Promise<PostResponse["safety"] | null | false> => {
    setSending(true); setPostError("");
    try {
      const r = await request<PostResponse>(route, { body: { text } });
      if (!alive.current || thread.current !== route) return r.safety || null;
      add(r.messages);
      void load(); // pick up anything the other side wrote meanwhile, and the new window state
      return r.safety || null;
    } catch (e: any) {
      if (alive.current) { setPostError(e?.message || "error"); void load(); }
      return false;
    } finally {
      if (alive.current) setSending(false);
    }
  };

  return { messages, meta, error, postError, sending, send, loaded: meta !== null };
}
