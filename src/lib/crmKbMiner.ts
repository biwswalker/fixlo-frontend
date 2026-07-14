// Turn parsed chat history into candidate intents (KB mining M2, issue #179 /
// PRD #177). Pure over parsed input: no I/O, no DB, no embeddings (ADR 0002).
//
// One conversation (one customer's CSV file) at a time. Within it we sessionize
// on the customer's own message gaps (reuse `crmSession`, ADR 0003), then for
// each admin reply collect the contiguous block of customer messages that
// immediately precede it in the same session as the reply's sample utterances.
// Replies are grouped by their decoration-free key (`crmReplyNormalize`); across
// the occurrences of a group the utterances are unioned + de-duped and the
// MOST-FREQUENT raw reply variant is kept as `targetResponse` (decision 5/7).
//
// Noise — bot auto-replies, image/sticker placeholders, blank lines — never
// becomes an utterance or a response (PRD user stories 3-4).

import type { ChatMessage } from "./crmChatCsvParse";
import { assignSessions } from "./crmSession";
import { crmReplyNormalize } from "./crmReplyNormalize";

/** A grouped candidate intent, ready for a supervisor to review in the KB UI. */
export interface IntentCandidate {
  /** Decoration-free grouping key of the admin reply (`crmReplyNormalize`). */
  normalizedKey: string;
  /** Unioned, de-duped customer utterances that preceded the reply. */
  sampleUtterances: string[];
  /** Most-frequent raw reply variant in the group — a real message to send. */
  targetResponse: string;
  /** How many admin replies fell into this group. */
  occurrences: number;
}

export interface MineOptions {
  /** Session gap in minutes (CRM default 360 = 6h). */
  gapMinutes: number;
}

// Image/sticker placeholders LINE writes for non-text customer turns. They are
// dropped from utterance blocks without breaking contiguity of surrounding text.
const NOISE_PLACEHOLDER = /คุณส่งรูป|คุณส่งสติกเกอร์/;

function isNoiseCustomerText(text: string): boolean {
  const t = text.trim();
  return t === "" || NOISE_PLACEHOLDER.test(t);
}

interface Group {
  key: string; // normalized grouping key
  order: number; // first-seen order, for stable output
  occurrences: number;
  utterances: string[]; // insertion-ordered, de-duped
  seenUtterances: Set<string>;
  variantCounts: Map<string, number>; // raw reply -> count
  variantOrder: Map<string, number>; // raw reply -> first-seen index
}

/** Pick the most-frequent raw reply; ties broken by earliest first-seen. */
function pickTargetResponse(group: Group): string {
  let best = "";
  let bestCount = -1;
  let bestOrder = Infinity;
  for (const [raw, count] of group.variantCounts) {
    const order = group.variantOrder.get(raw) ?? 0;
    if (count > bestCount || (count === bestCount && order < bestOrder)) {
      best = raw;
      bestCount = count;
      bestOrder = order;
    }
  }
  return best;
}

/**
 * Mine candidate intents from one conversation's messages. Messages may arrive
 * unsorted; they are processed in time order. Returns candidates in first-seen
 * order, each with at least one utterance and occurrence.
 */
export function mineIntentCandidates(
  messages: ChatMessage[],
  opts: MineOptions,
): IntentCandidate[] {
  if (messages.length === 0) return [];

  // Sessionize on customer identity (senderName). In one file the customer is a
  // single userId, so their bursts split correctly on the gap; admin/bot names
  // sessionize on their own but we only read a session index for customers.
  const timed = messages.map((m) => ({
    userId: m.senderName,
    at: Date.parse(m.at),
    msg: m,
  }));
  const sessioned = assignSessions(timed, opts.gapMinutes);

  // Stable time order (ties keep original order via index).
  const ordered = sessioned
    .map((s, i) => ({ ...s, i }))
    .sort((a, b) => a.at - b.at || a.i - b.i);

  const groups = new Map<string, Group>();
  let nextOrder = 0;

  // Contiguous customer block immediately preceding the current position, within
  // a single session. Reset by an admin reply (consumed) or a bot turn (break).
  let block: string[] = [];
  let blockSession: number | null = null;

  const record = (rawReply: string, utterances: string[]) => {
    const key = crmReplyNormalize(rawReply);
    if (!key || utterances.length === 0) return;
    let group = groups.get(key);
    if (!group) {
      group = {
        key,
        order: nextOrder++,
        occurrences: 0,
        utterances: [],
        seenUtterances: new Set(),
        variantCounts: new Map(),
        variantOrder: new Map(),
      };
      groups.set(key, group);
    }
    group.occurrences++;
    group.variantCounts.set(rawReply, (group.variantCounts.get(rawReply) ?? 0) + 1);
    if (!group.variantOrder.has(rawReply)) {
      group.variantOrder.set(rawReply, group.variantOrder.size);
    }
    for (const u of utterances) {
      if (!group.seenUtterances.has(u)) {
        group.seenUtterances.add(u);
        group.utterances.push(u);
      }
    }
  };

  for (const { msg, sessionIndex } of ordered) {
    if (msg.senderType === "customer") {
      if (isNoiseCustomerText(msg.text)) continue; // drop, keep contiguity
      // A session boundary between customer messages starts a fresh block.
      if (blockSession !== null && sessionIndex !== blockSession) block = [];
      block.push(msg.text.trim());
      blockSession = sessionIndex;
    } else if (msg.senderType === "admin") {
      if (msg.text.trim() !== "") record(msg.text.trim(), block);
      block = [];
      blockSession = null;
    } else {
      // bot: interrupts the customer→admin adjacency, so it breaks the block.
      block = [];
      blockSession = null;
    }
  }

  return [...groups.values()]
    .sort((a, b) => a.order - b.order)
    .map((g) => ({
      normalizedKey: g.key,
      sampleUtterances: g.utterances,
      targetResponse: pickTargetResponse(g),
      occurrences: g.occurrences,
    }));
}
