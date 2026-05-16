import { describe, it, expect } from "vitest";
import { normalizeName, fuzzyNameMatch } from "../nameNormalizer";

describe("normalizeName", () => {
  it("lowercases, trims, and tokenizes on whitespace", () => {
    expect(normalizeName("  Hello   World  ")).toEqual(["hello", "world"]);
  });

  it("strips leading honorific คุณ", () => {
    expect(normalizeName("คุณ ศุณิษา")).toEqual(["ศุณิษา"]);
  });

  it("strips leading นาย / นาง / น.ส. / นางสาว / mr. / ms. / mrs.", () => {
    expect(normalizeName("นาย สมชาย")).toEqual(["สมชาย"]);
    expect(normalizeName("นาง สมหญิง")).toEqual(["สมหญิง"]);
    expect(normalizeName("น.ส. มาลี")).toEqual(["มาลี"]);
    expect(normalizeName("นางสาว มาลี")).toEqual(["มาลี"]);
    expect(normalizeName("Mr. Smith")).toEqual(["smith"]);
    expect(normalizeName("Ms. Jane Doe")).toEqual(["jane", "doe"]);
    expect(normalizeName("Mrs. Doe")).toEqual(["doe"]);
  });

  it("does not strip mid-string honorific", () => {
    // คุณ appearing in middle should remain
    expect(normalizeName("สมชาย คุณ ดี")).toEqual(["สมชาย", "คุณ", "ดี"]);
  });

  it("returns empty array for null / empty / whitespace-only", () => {
    expect(normalizeName(null)).toEqual([]);
    expect(normalizeName(undefined)).toEqual([]);
    expect(normalizeName("")).toEqual([]);
    expect(normalizeName("   ")).toEqual([]);
  });
});

describe("fuzzyNameMatch", () => {
  it("matches identical names", () => {
    expect(fuzzyNameMatch("สมชาย", "สมชาย")).toBe(true);
  });

  it("matches single-char Thai typo after honorific strip (Mode A)", () => {
    expect(fuzzyNameMatch("คุณ ศุญิษา", "ศุณิษา")).toBe(true);
  });

  it("matches when one side has extra token (full vs short form)", () => {
    // Mode C: alias short token present in full OCR name
    expect(fuzzyNameMatch("เกษม ติะแสนเทพ", "เกษม")).toBe(true);
  });

  it("rejects short tokens at fuzzy distance 2 (BBL vs GSB)", () => {
    expect(fuzzyNameMatch("BBL", "GSB")).toBe(false);
  });

  it("rejects when Levenshtein distance ≥ 2 on long tokens", () => {
    // distance 2 — two char swaps
    expect(fuzzyNameMatch("abcdef", "abxyef")).toBe(false);
  });

  it("returns false for null / empty inputs", () => {
    expect(fuzzyNameMatch(null, "abc")).toBe(false);
    expect(fuzzyNameMatch("abc", null)).toBe(false);
    expect(fuzzyNameMatch("", "abc")).toBe(false);
  });
});
