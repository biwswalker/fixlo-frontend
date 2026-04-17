---
trigger: always_on
---

# Fixlo System Context & Database Schema

## 1. Project Overview

Fixlo is a Multi-Tenant financial backoffice and reconciliation system. It scrapes data from various platforms (e.g., Juno168) and cross-references it with daily bank balances and AI-verified transaction slips.

## 2. Core Architecture Rules

- **Multi-Project Setup:** The system supports multiple websites. Every query MUST consider the `project_id` context.
- **Localization:** The UI language is strictly **THAI**. All monetary values must be formatted as Thai Baht (THB) using `Intl.NumberFormat('th-TH', { style: 'currency', currency: 'THB' })`.

## 3. Database Schema (PostgreSQL)

### A. Core Tables

- **[span_2](start_span)`projects`**: `id` (UUID PK), `project_name` (VARCHAR), `discord_channel_id`, `status`[span_2](end_span).
- **[span_3](start_span)`daily_balances`**: `id` (UUID), `date`, `balance_amount`, `project_name` (VARCHAR)[span_3](end_span).

### B. Summary & Reconciliation

- **[span_4](start_span)`report_summary_daily`**: `id` (INT), `project_id` (VARCHAR), `report_date`, `deposit` (ฝาก), `withdraw` (ถอน), `manual_in` (เติมมือ), `manual_out` (ถอนมือ), `bonus` (โบนัส), `redeem` (แลกรางวัล), `fixed_deposit` (ฝากประจำ), `affiliate` (พันธมิตร), `cashback` (คืนยอดเสีย), `balance`[span_4](end_span).

### C. Slip Verification & Anomalies

- **[span_5](start_span)`transactions`** (WITH AN 'S'): `id` (UUID PK), `source_project_id` (UUID FK), `target_project_id` (UUID FK), `amount`, `ai_amount`, `is_duplicate`, `is_amount_mismatch`, `is_amount_verified`, `transfer_date`, `transfer_time`[span_5](end_span).
  // IMPORTANT: `transactions` table DOES NOT have a `project_id` column. [span_6](start_span)Use `source_project_id` or `target_project_id`[span_6](end_span).

### D. Authentication & Authorization

- **`users`**: `id` (UUID PK), `username` (VARCHAR UNIQUE), `password_hash` (TEXT), `role` (ENUM: 'ADMIN', 'SUPPORT', 'VIEWER'), `created_at`.
- **Permissions Logic**:
  - `ADMIN`: ทำได้ทุกอย่าง (ดูรายงาน, อนุมัติสลิป, จัดการโปรเจกต์).
  - `SUPPORT`: ดู Dashboard และ "อนุมัติสลิป" ได้ แต่ดูรายงานภาพรวมลึกๆ หรือลบข้อมูลไม่ได้.
  - `VIEWER`: ดูข้อมูลได้อย่างเดียว (Read-only).

## 4. Project Matching Rule

When querying based on a project URL parameter (e.g., 'juno168'), ALWAYS use fuzzy matching against `projects.project_name` using `ILIKE '%' || $1 || '%'` to handle variations like 'juno', 'jno', etc.
