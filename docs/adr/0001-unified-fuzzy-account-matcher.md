---
status: accepted
date: 2026-05-09
revised: 2026-05-09 (after reading fixlo-spectre)
---

# Consolidate slip-to-account matching across fixlo-frontend and fixlo-spectre

## Context

ปัจจุบันมี matcher **3 ตัว** กระจายข้าม 2 repo:

| # | File | Repo | Trigger | DB-driven? |
|---|---|---|---|---|
| 1 | `lib/smartMatcher.js` | **fixlo-spectre** | Worker (production, every slip insert) | ✓ |
| 2 | `src/lib/smartMatcher.ts` | fixlo-frontend | UI "Re-run matching" button | ✓ |
| 3 | `src/lib/accountMatcher.ts` | fixlo-frontend | `reconciliation.ts:293` for legacy view | ✗ (hardcoded 8 names) |

Spectre matcher (#1) เป็น **production source of truth** — match SLIP ตอน worker insert transaction. UI matcher (#2) ทำงานเฉพาะตอน user กด "Re-run matching" บน rows ที่ status = UNMAPPED/PENDING_REVIEW. Legacy matcher (#3) ใช้แค่ display name fallback.

### ความแตกต่างระหว่าง spectre (#1) กับ frontend smartMatcher (#2)

Spectre matcher ดีกว่ามาก:
- **Bank normalization ภาษาไทย**: `กสิกร→kbank, ไทยพาณิชย์→scb, กรุงเทพ→bbl, กรุงไทย→ktb, กรุงศรี→bay, ทหารไทย→ttb, ออมสิน→gsb, ธกส→baac`. Frontend ไม่มี
- **Two-case scoring**: Gateway (`wealth/dpay/apay/badoo/binance`) → 80 bank / 20 name. Person → 70 name / 20 acc / 10 bank. TrueMoney → 85/15/0 (ไม่เช็ค acc เพราะ wallet มักไม่โชว์)
- **`JSON.parse(aliases)` ถูกต้อง**. Frontend ใช้ `aliases.split(/[, \n]+/)` — บังเอิญใช้ได้เพราะ normalize strip brackets/quotes
- Frontend มี `normMasterName.includes(normScannedBank)` ที่ตรรกะแปลก (เช็ค bank ในชื่อ)

ทั้งคู่ใช้ threshold เดียวกัน: ≥85 AUTO_MAPPED, ≥50 PENDING_REVIEW, else UNMAPPED.

Mask handling ในเลขบัญชี: spectre ใช้ `replace(/[-\s]/g, "")` strip dash/space ก่อนแล้ว regex `[x*]→.*`. Frontend ใช้ `replace(/[^a-z0-9]/g, "")` strip non-alphanumeric. **ทั้งสอง support `-` mask อยู่แล้ว** (ผ่าน strip — ADR ต้นเขียนผิด).

ข้อมูล input จาก AI OCR (Gemini) ไม่ตรง 100% (ชื่อเพี้ยน, acc_num ถูก mask) — ต้องการ fuzzy ทั้ง name + acc_num ตามที่ spectre ทำอยู่แล้ว.

## Decision

1. **ลบ `src/lib/accountMatcher.ts` ทิ้ง** จาก fixlo-frontend. ทำ `reconciliation.ts:293` ให้ใช้ display name จาก [[project_accounts]] โดยตรง (ไม่ต้อง match ใหม่ — ใช้ `project_account_id` ที่ spectre matcher set ไว้แล้ว).

2. **Sync `src/lib/smartMatcher.ts` ของ frontend ให้ behavior ตรงกับ spectre**:
   - Copy logic ของ spectre version (bank normalization, gateway/person split, TrueMoney case, JSON.parse aliases)
   - ตัด bank-via-name fallback แปลกๆ ทิ้ง
   - เก็บ threshold 85/50 เดิม

3. **ระยะยาว: extract เป็น shared package** (workspace package หรือ monorepo) เพื่อไม่ให้ drift อีกครั้ง. ตอนนี้ duplicate ก่อนเพราะคนละภาษา (TS/JS) คนละ repo.

## Considered alternatives

- **Frontend re-call spectre's matcher via HTTP/IPC** — ตัดปัญหา drift จริง แต่เพิ่ม latency + dependency บน worker uptime. ตัดทิ้ง
- **Unified matcher in shared library now** — ดีระยะยาว แต่ blocks immediate fix; ต้อง setup monorepo/package publishing ก่อน
- **Patch frontend อย่างเดียว ไม่แตะ accountMatcher** — accountMatcher ก็ยังตกหล่น (hardcoded 8 vs DB ~20) → drift ต่อไป

## Consequences

- `reconciliation.ts:293` refactor ให้ใช้ `project_account_id` แทนการ match สดด้วยชื่อ
- frontend smartMatcher behavior เปลี่ยน → ผลของปุ่ม "Re-run matching" จะตรงกับ matcher ตัวจริงตอน insert
- ไม่ต้อง backfill — spectre matcher ทำงานปกติอยู่แล้ว, การแก้ frontend แค่ทำให้ re-match ตรงกัน
- ต้องมี integration test ทั้งสอง matchers ให้ผลลัพธ์เดียวกันบน fixture เดียวกัน
- Open: setup shared package ระยะถัดไป
- ดู [[CONTEXT]] schema debt #5
