// Canonical session-boundary definition for the CRM service desk.
// A session is a burst of one customer's messages; a new session starts when the
// idle gap since that customer's previous message exceeds the session gap.
// See docs/crm/adr/0003-service-desk-reframe.md. n8n writes crm_sessions at
// ingestion time using this same rule; Fixlo owns the definition + tests.

export interface TimedMessage {
  userId: string;
  at: number; // epoch milliseconds
}

/**
 * Whether a message at `at` starts a new session relative to the previous
 * message from the same customer at `prevAt`. The first message of a customer
 * (`prevAt` null) always starts a session.
 */
export function startsNewSession(
  prevAt: number | null,
  at: number,
  gapMinutes: number,
): boolean {
  if (prevAt === null) return true;
  return at - prevAt > gapMinutes * 60_000;
}

/**
 * Annotate each message with a per-customer `sessionIndex` (0-based, in time
 * order). Messages are grouped by `userId`; within a customer, the index
 * increments whenever the idle gap exceeds `gapMinutes`. Input order is
 * preserved in the returned array; unsorted input is handled.
 */
export function assignSessions<T extends TimedMessage>(
  messages: T[],
  gapMinutes: number,
): (T & { sessionIndex: number })[] {
  const byUser = new Map<string, { msg: T; i: number }[]>();
  messages.forEach((msg, i) => {
    const bucket = byUser.get(msg.userId);
    if (bucket) bucket.push({ msg, i });
    else byUser.set(msg.userId, [{ msg, i }]);
  });

  const sessionOf = new Array<number>(messages.length);
  for (const bucket of byUser.values()) {
    bucket.sort((a, b) => a.msg.at - b.msg.at);
    let index = 0;
    let prevAt: number | null = null;
    for (const { msg, i } of bucket) {
      if (startsNewSession(prevAt, msg.at, gapMinutes)) {
        if (prevAt !== null) index++;
      }
      sessionOf[i] = index;
      prevAt = msg.at;
    }
  }

  return messages.map((msg, i) => ({ ...msg, sessionIndex: sessionOf[i] }));
}
