/** Pure helpers behind the messages and check-in screens (src/site/lib/appointmentThread.ts). */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import {
  mergeThread, doctorOpenedLine, latestSafetyNotice, needsRead, isStillAhead, istDayKey, checkInOpen, checkInLaterToday,
  todaysVisits, visitStateOf, doctorTitle, fill, type ThreadMessage,
} from "../src/site/lib/appointmentThread";
import { istDayKey as serverIstDayKey } from "../server/firebase/istDay";

const msg = (seq: number, sender: ThreadMessage["sender"] = "patient", id = `m${seq}`): ThreadMessage =>
  ({ id, seq, sender, kind: sender === "system" ? "emergency_notice" : "message", text: `t${seq}`, createdAt: "2026-11-17T05:00:00.000Z" });
const chat = (o: Partial<{ lastSeq: number; doctorReadSeq: number; doctorReadAt: string | null; patientReadSeq: number; urgent: boolean }> = {}) =>
  ({ lastSeq: 0, doctorReadSeq: 0, doctorReadAt: null, patientReadSeq: 0, urgent: false, urgentAcked: false, ...o });

describe("thread merge and cursor", () => {
  test("dedupes by id and keeps seq order", () => {
    const a = mergeThread([msg(1), msg(2)], [msg(2), msg(3)]);
    assert.deepEqual(a.messages.map((m) => m.seq), [1, 2, 3]);
    assert.equal(a.cursor, 3);
  });
  test("the cursor stops at a gap, so a message written meanwhile by the other side is not skipped", () => {
    // Polled up to 4; the doctor wrote 5; the patient's post came back as 6.
    const a = mergeThread([msg(1), msg(2), msg(3), msg(4)], [msg(6)]);
    assert.equal(a.cursor, 4);
    const b = mergeThread(a.messages, [msg(5, "doctor"), msg(6)]);
    assert.equal(b.cursor, 6);
    assert.deepEqual(b.messages.map((m) => m.seq), [1, 2, 3, 4, 5, 6]);
  });
  test("an empty thread has cursor 0", () => {
    assert.equal(mergeThread([], []).cursor, 0);
  });
});

describe("thread-level line and safety banner", () => {
  test("no line until the patient has written", () => {
    assert.equal(doctorOpenedLine([msg(1, "doctor")], chat()), null);
  });
  test("not opened until the doctor's read covers the latest patient message", () => {
    const list = [msg(1), msg(2, "doctor"), msg(3)];
    assert.deepEqual(doctorOpenedLine(list, chat({ doctorReadSeq: 2, doctorReadAt: "2026-11-17T06:00:00.000Z" })), { state: "not_opened" });
    assert.deepEqual(doctorOpenedLine(list, chat({ doctorReadSeq: 3, doctorReadAt: "2026-11-17T06:00:00.000Z" })), { state: "opened", at: "2026-11-17T06:00:00.000Z" });
  });
  test("the banner follows a notice stored right after the patient's latest message only", () => {
    assert.equal(latestSafetyNotice([msg(1), msg(2, "system")])?.seq, 2);
    assert.equal(latestSafetyNotice([msg(1), msg(2, "system"), msg(3)]), null);
    assert.equal(latestSafetyNotice([msg(1), msg(2, "system"), msg(3, "doctor")])?.seq, 2);
    assert.equal(latestSafetyNotice([msg(1), msg(2, "doctor")]), null);
  });
  test("read is needed only when something is unread (or an urgent flag is open, for the doctor)", () => {
    assert.equal(needsRead("patient", chat({ lastSeq: 3, patientReadSeq: 3 }), 3), false);
    assert.equal(needsRead("patient", chat({ lastSeq: 4, patientReadSeq: 3 }), 4), true);
    assert.equal(needsRead("doctor", chat({ lastSeq: 3, doctorReadSeq: 3 }), 3), false);
    assert.equal(needsRead("doctor", chat({ lastSeq: 3, doctorReadSeq: 3, urgent: true }), 3), true);
  });
  test("read is judged by what the screen has shown, not by the server's lastSeq", () => {
    // The server already holds seq 6 (written after the fetch); the screen shows up to 4.
    assert.equal(needsRead("doctor", chat({ lastSeq: 6, doctorReadSeq: 4 }), 4), false);
    assert.equal(needsRead("patient", chat({ lastSeq: 6, patientReadSeq: 4 }), 4), false);
    assert.equal(needsRead("doctor", chat({ lastSeq: 6, doctorReadSeq: 3 }), 4), true);
  });
});

describe("check-in window on the IST day", () => {
  test("the client IST day matches the server's, across the UTC date line", () => {
    for (const iso of ["2026-11-16T19:00:00.000Z", "2026-11-17T18:00:00.000Z", "2026-11-17T18:30:00.000Z", "2026-11-17T18:29:59.999Z"]) {
      assert.equal(istDayKey(iso), serverIstDayKey(iso), iso);
    }
    assert.equal(istDayKey("2026-11-16T19:00:00.000Z"), "2026-11-17"); // 00:30 IST
    assert.equal(istDayKey("nonsense"), "");
  });
  test("opens one hour before the start and closes at the end", () => {
    const start = "2026-11-17T06:00:00.000Z", end = "2026-11-17T06:30:00.000Z";
    const at = (iso: string) => Date.parse(iso);
    assert.equal(checkInOpen(start, end, at("2026-11-17T04:59:00.000Z")), false);
    assert.equal(checkInOpen(start, end, at("2026-11-17T05:00:00.000Z")), true);
    assert.equal(checkInOpen(start, end, at("2026-11-17T06:30:00.000Z")), true);
    assert.equal(checkInOpen(start, end, at("2026-11-17T06:31:00.000Z")), false);
    assert.equal(checkInLaterToday(start, end, at("2026-11-17T01:00:00.000Z")), true);
    assert.equal(checkInLaterToday(start, end, at("2026-11-16T06:00:00.000Z")), false);
  });
  test("a 00:30 IST slot does not open at 23:45 IST the evening before", () => {
    // 00:30 IST on 18 Nov is 19:00 UTC on 17 Nov; 23:45 IST on 17 Nov is within an hour but on another IST day.
    assert.equal(checkInOpen("2026-11-17T19:00:00.000Z", "2026-11-17T19:30:00.000Z", Date.parse("2026-11-17T18:15:00.000Z")), false);
  });
});

describe("doctor's Today list", () => {
  const b = (id: string, startsAt: string, o: Partial<{ consultationType: string; status: string; arrivedAt: string | null; calledAt: string | null }> = {}) =>
    ({ id, startsAt, consultationType: "in_person", status: "confirmed", ...o });
  test("today's in-person confirmed and completed bookings, in booked-time order", () => {
    const now = Date.parse("2026-11-17T06:00:00.000Z");
    const list = todaysVisits([
      b("late", "2026-11-17T10:00:00.000Z"),
      b("early", "2026-11-17T04:00:00.000Z"),
      b("online", "2026-11-17T05:00:00.000Z", { consultationType: "online" }),
      b("cancelled", "2026-11-17T05:00:00.000Z", { status: "cancelled" }),
      b("done", "2026-11-17T03:00:00.000Z", { status: "completed" }),
      b("tomorrow", "2026-11-18T04:00:00.000Z"),
      b("ist-midnight", "2026-11-16T19:00:00.000Z"), // 00:30 IST on the 17th
    ], now);
    assert.deepEqual(list.map((x) => x.id), ["ist-midnight", "done", "early", "late"]);
  });
  test("visit state follows checkin.ts", () => {
    assert.equal(visitStateOf({ status: "completed", calledAt: "x" }), "done");
    assert.equal(visitStateOf({ status: "confirmed", arrivedAt: "x", calledAt: "y" }), "called");
    assert.equal(visitStateOf({ status: "confirmed", arrivedAt: "x" }), "waiting");
    assert.equal(visitStateOf({ status: "confirmed" }), "not_arrived");
  });
});

describe("copy helpers", () => {
  test("doctor title is not doubled", () => {
    assert.equal(doctorTitle("Asha Rao", "Dr"), "Dr Asha Rao");
    assert.equal(doctorTitle("Dr. Asha Rao", "Dr"), "Dr. Asha Rao");
    assert.equal(doctorTitle("", "Dr"), "");
  });
  test("fill replaces known placeholders only", () => {
    assert.equal(fill("{n} patients before you. {x}", { n: 2 }), "2 patients before you. {x}");
  });
});

describe("the overview card's booking", () => {
  const now = "2026-11-17T06:05:00.000Z", today = "2026-11-17";
  test("a Firestore booking stays until it ends, not until it starts", () => {
    const b = { at: "2026-11-17T06:00:00.000Z", startsAt: "2026-11-17T06:00:00.000Z", endsAt: "2026-11-17T06:30:00.000Z", status: "CONFIRMED" };
    assert.equal(isStillAhead(b, now, today), true, "five minutes after the booked time, before the end");
    assert.equal(isStillAhead(b, "2026-11-17T06:30:01.000Z", today), false);
  });
  test("cancelled, refused and completed bookings never show", () => {
    for (const status of ["CANCELLED", "REJECTED", "COMPLETED"]) {
      assert.equal(isStillAhead({ at: "2026-11-18T06:00:00.000Z", endsAt: "2026-11-18T06:30:00.000Z", status }, now, today), false, status);
    }
  });
  test("rows from the earlier store, without an end, keep the old rule", () => {
    assert.equal(isStillAhead({ at: "2026-11-17T06:00:00.000Z", status: "CONFIRMED" }, now, today), false);
    assert.equal(isStillAhead({ date: "2026-11-17", status: "CONFIRMED" }, now, today), true);
    assert.equal(isStillAhead({ date: "2026-11-16", status: "CONFIRMED" }, now, today), false);
  });
});
