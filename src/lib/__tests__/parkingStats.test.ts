import { describe, it, expect } from "vitest";
import { aggregateParkingByAccountDay, aggregateUnregisteredParking } from "../parkingStats";

describe("aggregateParkingByAccountDay", () => {
  it("sums net amount per account per day", () => {
    const rows = [
      { project_account_id: "acc1", date: "2026-06-08", amount: 44188, status: "Approved" },
      { project_account_id: "acc1", date: "2026-06-08", amount: 10000, status: "Approved" },
    ];
    const result = aggregateParkingByAccountDay(rows);
    expect(result.get("acc1")?.get("2026-06-08")).toBe(54188);
  });

  it("counts Approved only — Pending/Rejected excluded", () => {
    const rows = [
      { project_account_id: "acc1", date: "2026-06-08", amount: 44188, status: "Approved" },
      { project_account_id: "acc1", date: "2026-06-08", amount: 99999, status: "Pending" },
      { project_account_id: "acc1", date: "2026-06-08", amount: 88888, status: "Rejected" },
    ];
    const result = aggregateParkingByAccountDay(rows);
    expect(result.get("acc1")?.get("2026-06-08")).toBe(44188);
  });

  it("skips FK-null rows (parking into an unregistered account)", () => {
    const rows = [
      { project_account_id: null, date: "2026-06-08", amount: 50000, status: "Approved" },
    ];
    const result = aggregateParkingByAccountDay(rows);
    expect(result.size).toBe(0);
  });

  it("partitions accounts and days independently", () => {
    const rows = [
      { project_account_id: "acc1", date: "2026-06-08", amount: 100, status: "Approved" },
      { project_account_id: "acc1", date: "2026-06-09", amount: 200, status: "Approved" },
      { project_account_id: "acc2", date: "2026-06-08", amount: 300, status: "Approved" },
    ];
    const result = aggregateParkingByAccountDay(rows);
    expect(result.get("acc1")?.get("2026-06-08")).toBe(100);
    expect(result.get("acc1")?.get("2026-06-09")).toBe(200);
    expect(result.get("acc2")?.get("2026-06-08")).toBe(300);
  });

  it("empty input → empty map", () => {
    expect(aggregateParkingByAccountDay([]).size).toBe(0);
  });
});

describe("aggregateUnregisteredParking", () => {
  it("groups FK-null Approved parking by account, summing amount", () => {
    const rows = [
      { project_account_id: null, account_name: "สมชาย ใจดี", account_number: "111", date: "2026-06-08", amount: 5000, status: "Approved" },
      { project_account_id: null, account_name: "สมชาย ใจดี", account_number: "111", date: "2026-06-08", amount: 3000, status: "Approved" },
      { project_account_id: null, account_name: "มานี รักดี", account_number: "222", date: "2026-06-08", amount: 7000, status: "Approved" },
    ];
    const result = aggregateUnregisteredParking(rows);
    expect(result).toEqual([
      { accountName: "สมชาย ใจดี", accountNumber: "111", amount: 8000 },
      { accountName: "มานี รักดี", accountNumber: "222", amount: 7000 },
    ]);
  });

  it("excludes FK-matched rows (already attributed to a master)", () => {
    const rows = [
      { project_account_id: "acc1", account_name: "ศุณิษา", account_number: "710", date: "2026-06-08", amount: 44188, status: "Approved" },
    ];
    expect(aggregateUnregisteredParking(rows)).toEqual([]);
  });

  it("excludes non-Approved rows", () => {
    const rows = [
      { project_account_id: null, account_name: "สมชาย", account_number: "111", date: "2026-06-08", amount: 5000, status: "Pending" },
    ];
    expect(aggregateUnregisteredParking(rows)).toEqual([]);
  });

  it("empty input → empty list", () => {
    expect(aggregateUnregisteredParking([])).toEqual([]);
  });
});
