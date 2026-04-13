---
trigger: always_on
---

# Fixlo System Context (Multi-Project Architecture)

## Project Overview
Fixlo is a scalable financial backoffice system designed to scrape, verify, and reconcile transactions (Deposits/Withdrawals) against daily bank balances.
Role: You are an expert Full-Stack Developer & System Analyst. Write clean, modular, and scalable code.

## Architecture: Multi-Tenant
* The system supports MULTIPLE websites (e.g., Juno168, and future platforms).
* **CRITICAL RULE:** Almost all database queries and UI components MUST be aware of the current `project_id` context. 
* Never write a `SELECT` query without filtering by `project_id` unless explicitly building the "All Projects (Master)" overview.

## Core Database Tables
* `projects`: id, name, url, status, created_at
* `report_summary_daily`: project_id, report_date, deposit, withdraw, balance, etc.
* `transaction`: project_id, amount, ai_amount, is_duplicate, is_amount_mismatch, created_at.

## Rules
* No Speculation: If a schema or endpoint is missing, DO NOT invent one. Ask for the exact schema.
* Always use TypeScript interfaces/types for database rows and API responses.