---
title: System MOC
type: index
tags: [system, frontend, ui, moc]
generated: 2026-05-10
---

# Fixlo Frontend — Map of Content

คู่มือผู้ใช้/ผู้ดูแลระบบ Fixlo (frontend Next.js) — อธิบายหน้าจอแต่ละหน้าและที่มาของตัวเลขทุกตัว.

> ดู [[../../CONTEXT|CONTEXT]] สำหรับ domain glossary, ดู [[../db/MOC|DB MOC]] สำหรับ schema reference.

## เอกสารชุดนี้

- [[overview]] — ระบบทำอะไร, สถาปัตยกรรมโดยรวม, แหล่งข้อมูล
- [[page-dashboard]] — หน้าปัดหลัก (`/dashboard/[projectId]`)
- [[page-reconciliation]] — หน้ากระทบยอด (`/dashboard/[projectId]/reconciliation`)
- [[calculations]] — สูตรคำนวณรวม + ตัวอย่างเลขจริง

## Quick map

| หน้า | path | ใครเข้าได้ | ตัวเลขหลัก |
|---|---|---|---|
| หน้าปัดหลัก | `/dashboard/[projectId]` | ทุก role | กระแสเงินสดสุทธิ, ยอดฝาก, ยอดถอน, breakdown รายรับ-รายจ่าย, chart รายวัน |
| กระทบยอด | `/dashboard/[projectId]/reconciliation` | `owner`, `admin` เท่านั้น | ยอดรับเข้าระบบ, ยอดจ่ายจากสลิป, ยอดคงเหลือธนาคาร, ส่วนต่าง (variance), per-account outflow |

## Project selector

`projectId` ใน URL = ชื่อ project (เช่น `juno168`) หรือ `all` (รวมทุก project).
- ค่า `all` → query รวมทุก project (ไม่กรอง `project_id`)
- ค่าอื่น → resolve ผ่าน [[../db/tables/projects|projects]] ตาราง `WHERE project_name ILIKE '%<projectId>%' AND status = 'ACTIVE'`
- ไม่เจอ project → redirect `/dashboard/all`

## Date range

ทั้ง 2 หน้าใช้ date range จาก URL query:
- `?from=YYYY-MM-DD&to=YYYY-MM-DD` (หน้าปัดหลัก)
- `?period=day|week|month&date=YYYY-MM-DD` (หน้ากระทบยอด)
- Default: 7 วันย้อนหลัง (หน้าปัดหลัก), วันนี้ (กระทบยอด)
