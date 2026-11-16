/**
 * Pure helpers for the appointment messages and same-day check-in screens
 * (server: server/firebase/messages.ts and server/firebase/checkin.ts). No React, no network,
 * no clock unless one is passed in, so they are unit-tested directly (tests/appointment-thread.test.ts).
 */

export type ThreadSender = "patient" | "doctor" | "system";
export type ThreadMessage = { id: string; seq: number; sender: ThreadSender; kind: string; text: string; createdAt: string };
export type ThreadChat = { lastSeq: number; doctorReadSeq: number; doctorReadAt: string | null; patientReadSeq: number; urgent: boolean; urgentAcked: boolean };

/** The server's limit on one message (messageBodySchema in messages.ts). */
export const MESSAGE_MAX = 2000;

/**
 * Add messages to a thread, keyed by id (a poll and a post can return the same message), in
 * seq order. Also returns the highest seq up to which the thread has no gap: that, not the
 * highest seq seen, is the safe ?after cursor. A post can return seq 6 while seq 5 (written by
 * the other side a moment earlier) has not been fetched yet; polling after 6 would skip 5.
 */
export function mergeThread(list: ThreadMessage[], more: ThreadMessage[]): { messages: ThreadMessage[]; cursor: number } {
  const byId = new Map(list.map((m) => [m.id, m]));
  for (const m of more) byId.set(m.id, m);
  const messages = [...byId.values()].sort((a, b) => a.seq - b.seq);
  let cursor = 0;
  for (const m of messages) {
    if (m.seq === cursor + 1) cursor = m.seq;
    else if (m.seq > cursor + 1) break;
  }
  return { messages, cursor };
}

/**
 * The patient's one thread-level line: null when they have written nothing, "opened" when the
 * doctor's read covers their latest message, else "not_opened". Opened, not answered.
 */
export function doctorOpenedLine(messages: ThreadMessage[], chat: Pick<ThreadChat, "doctorReadSeq" | "doctorReadAt"> | null):
  { state: "opened"; at: string } | { state: "not_opened" } | null {
  const mine = messages.filter((m) => m.sender === "patient");
  if (!mine.length) return null;
  const last = mine[mine.length - 1].seq;
  if (chat && chat.doctorReadAt && chat.doctorReadSeq >= last) return { state: "opened", at: chat.doctorReadAt };
  return { state: "not_opened" };
}

/**
 * The safety notice the red banner is about: the newest automatic notice, when it answers the
 * patient's latest message (it is stored right after it). Null otherwise.
 */
export function latestSafetyNotice(messages: ThreadMessage[]): ThreadMessage | null {
  let lastPatient = -1;
  let lastSystem: ThreadMessage | null = null;
  for (const m of messages) {
    if (m.sender === "patient") lastPatient = m.seq;
    if (m.sender === "system") lastSystem = m;
  }
  return lastSystem && lastSystem.seq === lastPatient + 1 ? lastSystem : null;
}

/** Whether the caller has something to mark read (the server makes a repeat a no-op anyway). */
export function needsRead(role: "patient" | "doctor", chat: ThreadChat): boolean {
  if (role === "patient") return chat.lastSeq > chat.patientReadSeq;
  return chat.lastSeq > chat.doctorReadSeq || chat.urgent;
}

// ---------------------------------------------------------------------------------------------
// Same-day check-in. The day is the Asia/Kolkata calendar day, with a fixed +05:30 offset, the
// same rule as server/firebase/istDay.ts. The server decides; this only chooses what to show.

const IST_OFFSET_MS = (5 * 60 + 30) * 60_000;
export const CHECKIN_OPENS_BEFORE_MS = 60 * 60_000;

/** "YYYY-MM-DD" of the IST day an instant falls on, or "" for an unreadable time. */
export function istDayKey(t: string | number): string {
  const ms = typeof t === "number" ? t : Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms + IST_OFFSET_MS).toISOString().slice(0, 10) : "";
}

/** The check-in window of a booking: its IST day, from one hour before it starts until it ends. */
export function checkInOpen(startsAt: string, endsAt: string, now: number): boolean {
  const start = Date.parse(startsAt), end = Date.parse(endsAt);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
  return istDayKey(now) === istDayKey(start) && start - CHECKIN_OPENS_BEFORE_MS <= now && now <= end;
}

/** Whether a booking can still come into its check-in window today (so the screen keeps a clock). */
export function checkInLaterToday(startsAt: string, endsAt: string, now: number): boolean {
  const end = Date.parse(endsAt);
  return istDayKey(now) === istDayKey(startsAt) && Number.isFinite(end) && now <= end;
}

export type VisitState = "not_arrived" | "waiting" | "called" | "done";

/** The doctor's Today list: that IST day's in-person bookings, confirmed or completed, in booked-time order. */
export function todaysVisits<T extends { startsAt: string; consultationType: string; status: string }>(bookings: T[], now: number): T[] {
  const today = istDayKey(now);
  return bookings
    .filter((b) => b.consultationType === "in_person" && (b.status === "confirmed" || b.status === "completed") && istDayKey(b.startsAt) === today)
    .sort((a, b) => String(a.startsAt).localeCompare(String(b.startsAt)));
}

/** A booking's visit state from its fields, the same rule as stateOf in checkin.ts. */
export function visitStateOf(b: { status: string; arrivedAt?: string | null; calledAt?: string | null }): VisitState {
  if (b.status === "completed") return "done";
  if (b.calledAt) return "called";
  if (b.arrivedAt) return "waiting";
  return "not_arrived";
}

/** "Dr Asha Rao" from "Asha Rao", without doubling a title the name already has. */
export function doctorTitle(name: string, prefix: string): string {
  const n = (name || "").trim();
  if (!n) return "";
  return /^(dr\.?|डॉ\.?)\s/i.test(n) ? n : `${prefix} ${n}`;
}

/** Fill {name}-style placeholders. */
export function fill(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (all, k) => (k in values ? String(values[k]) : all));
}
