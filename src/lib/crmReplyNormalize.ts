// Grouping key for admin canned replies (KB mining M2, issue #179 / PRD #177).
//
// Admins answer the same questions with near-verbatim canned replies that differ
// only by DECORATION — an emoji, extra spaces, a trailing politeness particle
// (ค่ะ/ครับ/นะคะ), or a signature (คุณ<ชื่อ> / น้อง<ชื่อ>). `crmReplyNormalize`
// reduces such a reply to a stable key so those variants collapse into ONE
// candidate intent, while CONTENT words are never touched — so "ยอดฝากเข้า",
// "เครดิตเข้า", and "ถอนเรียบร้อย" keep DIFFERENT keys (grouping decision 1/6,
// ADR 0005). The most-frequent raw variant is kept elsewhere as the response;
// this key is only for grouping.

// Emoji, skin-tone modifiers, regional indicators, ZWJ, variation selectors,
// and the keycap combiner — pure decoration, stripped wholesale.
const EMOJI =
  /[\p{Extended_Pictographic}\u{1F1E6}-\u{1F1FF}\u{1F3FB}-\u{1F3FF}‍️⃣]/gu;

// Punctuation (\p{P}), symbols (\p{S}, e.g. ฿ ~ +), and the Thai repetition mark
// ๆ. Thai letters/vowels/tone marks are Lo/Mn and are never in these classes, so
// content survives.
const DECORATION = /[\p{P}\p{S}ๆ]/gu;
const TRAILING_DECORATION = /[\p{P}\p{S}ๆ]+$/u;
const TRAILING_SPACE = /[\s​﻿]+$/u;
const ALL_SPACE = /[\s​﻿]+/gu;

// Trailing Thai politeness particles — decoration that varies by admin/gender.
// Longer forms first so alternation is greedy (นะคะ before นะ/คะ).
const PARTICLES = [
  "นะคะ",
  "นะครับ",
  "นะค่ะ",
  "นะจ๊ะ",
  "นะจ้ะ",
  "ครับผม",
  "ค่าา",
  "จ้าา",
  "ค่ะ",
  "ค่า",
  "ค๊า",
  "คร้าบ",
  "ครับ",
  "คับ",
  "คะ",
  "จ้า",
  "จ้ะ",
  "จ๊ะ",
  "น่ะ",
  "นะ",
];
const TRAILING_PARTICLE = new RegExp(`(?:${PARTICLES.join("|")})$`, "u");

// A trailing admin signature: an honorific คุณ/น้อง preceded by a word boundary
// (start or whitespace) and followed by a name token, at the very end. The
// leading-boundary requirement keeps content like "โอนให้คุณแล้ว" (คุณ = "you",
// no preceding space) intact — only a space-separated end signature is stripped.
const TRAILING_SIGNATURE = /(?:^|[\s​﻿])(?:คุณ|น้อง)[\s​﻿]*\S+$/u;

/**
 * Reduce an admin reply to a decoration-free grouping key. Strips emoji,
 * whitespace, trailing politeness particles, a trailing คุณ/น้อง signature, and
 * punctuation — never content words. Two replies that differ only by decoration
 * yield the same key; replies that differ in content words do not.
 */
export function crmReplyNormalize(text: string): string {
  if (!text) return "";
  let s = text.normalize("NFC").replace(EMOJI, "");

  // Peel trailing decoration/particles/signature until stable, since they stack
  // in any order ("...แล้วค่ะ 🙏 คุณบี").
  let prev: string;
  do {
    prev = s;
    s = s.replace(TRAILING_SPACE, "");
    s = s.replace(TRAILING_DECORATION, "");
    s = s.replace(TRAILING_SIGNATURE, "");
    s = s.replace(TRAILING_PARTICLE, "");
  } while (s !== prev);

  return s.replace(DECORATION, "").replace(ALL_SPACE, "").toLowerCase();
}
