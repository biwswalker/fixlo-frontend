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

- **`projects`**: `id` (VARCHAR PK), `name` (VARCHAR), `url` (VARCHAR), `status` (VARCHAR), `created_at` (TIMESTAMP)

### B. Summary & Reconciliation

- **`report_summary_daily`** (Daily Aggregated Data):
  `id` (SERIAL PK), `project_id` (VARCHAR FK), `report_date` (DATE), `deposit` (DECIMAL), `withdraw` (DECIMAL), `manual_in` (DECIMAL), `manual_out` (DECIMAL), `bonus` (DECIMAL), `redeem` (DECIMAL), `fixed_deposit` (DECIMAL), `affiliate` (DECIMAL), `cashback` (DECIMAL), `balance` (DECIMAL), `created_at` (TIMESTAMP)

### C. Slip Verification & Anomalies (AI Processed)

- **`transaction`** (Individual user slips):
  `id` (PK), `project_id` (VARCHAR FK), `discord_message_id`, `image_path`, `image_hash`, `source_project_id`, `target_project_id`, `amount` (DECIMAL), `ref_id`, `sender_account`, `receiver_account`, `sender_name`, `receiver_name`, `sender_bank`, `receiver_bank`, `transfer_date`, `transfer_time`, `qr_code_text`, `is_duplicate` (BOOLEAN), `duplicate_of_ref_id`, `is_time_anomaly` (BOOLEAN), `time_diff_minutes`, `raw_ai_output` (TEXT), `ai_amount` (DECIMAL), `qr_amount` (DECIMAL), `is_amount_mismatch` (BOOLEAN), `is_amount_verified` (BOOLEAN), `created_at` (TIMESTAMP)

### D. Scraped Raw Data Tables (From Platforms)

All standard scraped tables MUST include: `id` (SERIAL PK), `project_id` (VARCHAR FK), and `created_at` (TIMESTAMP DEFAULT CURRENT_TIMESTAMP).

- **`report_deposits`**: `bank_acc`, `full_name`, `username`, `amb_user`, `amount` (DECIMAL), `promotion`, `status`, `web_acc`, `manage_by`, `trans_date`, `action_by`
- **`report_withdrawals`**: `bank_info`, `full_name`, `username`, `amb_user`, `amount` (DECIMAL), `status`, `web_acc`, `trans_date`, `note`, `action_by`

## 4. Rule of Thumb for AI

DO NOT hallucinate schemas. If a column is not listed above, ask the user before writing the SQL or Type definition.
