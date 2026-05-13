## What to build

เพิ่มความสามารถให้ admin สร้าง manual transaction (withdrawal ที่ไม่ผ่าน Discord) จากหน้า reconciliation และแสดงยอด manual แยกในตาราง account breakdown

**Schema:**
- สร้าง `manual_transactions` table ใหม่:
  ```
  id uuid PK DEFAULT gen_random_uuid(),
  project_id integer NOT NULL REFERENCES projects(id),
  project_account_id uuid NOT NULL REFERENCES project_accounts(id),
  amount numeric NOT NULL,
  transfer_at timestamp NOT NULL,
  image_path text,
  note text,
  created_by text NOT NULL,
  created_at timestamp DEFAULT now()
  ```

**Actions:**
- `createManualTransaction(projectId, projectAccountId, amount, transferAt, imagePath?, note?)` → INSERT, revalidate reconciliation

**Reconciliation query changes:**
- เพิ่ม `manualOutflow: number` ใน `AccountLevelStat`
- query manual_transactions แยก แล้ว aggregate ต่อ account เหมือน Discord outflow
- `effectiveOutflow = discordOutflow + manualOutflow + adjustments`

**`getAccountSlips` update (ต่อจาก issue #5):**
- เพิ่ม UNION query กับ `manual_transactions` — return เพิ่ม `source: 'discord' | 'manual'` และ `note` field
- Drawer แสดง badge แยก Discord / Manual

**UI:**
- `AddAdjustmentDialog` เปลี่ยนเป็น 3 tabs: **Adjustment** (เดิม) / **Manual Slip** (ใหม่) / **Manual Balance** (placeholder — issue #7)
- Manual Slip form: project_account (dropdown required), amount (required), transfer_at date+time (required), image_path (optional text), note (optional)
- Manual entry → MANUAL_MAPPED ทันที ไม่ผ่าน match queue
- ตาราง account breakdown: column "Manual" โผล่เฉพาะเมื่อ `manualOutflow > 0` ในแถวใดๆ ของวันนั้น

## Acceptance criteria

- [ ] Admin สร้าง manual transaction ได้จาก tab "Manual Slip" ใน dialog
- [ ] Manual transaction โผล่ใน drawer ของบัญชีนั้นวันนั้น พร้อม badge "Manual"
- [ ] Manual transaction นับใน `manualOutflow` ของ account breakdown
- [ ] Column "Manual" ไม่โผล่เมื่อทุก account มี manualOutflow = 0
- [ ] Column "Manual" โผล่ทันทีที่มี manual entry อย่างน้อย 1 รายการในวันนั้น
- [ ] `effectiveOutflow` = discordOutflow + manualOutflow + adjustments
- [ ] Manual transaction ไม่โผล่ใน pending match queue

## Blocked by

#5 (getAccountSlips และ drawer ต้องมีก่อน จึงขยาย query ได้)
