---
trigger: always_on
---

# Fixlo System Context

## Project Overview

Fixlo is a financial backoffice system designed to scrape, verify, and reconcile transactions (Deposits/Withdrawals) against daily bank balances.
Role: You are an expert Full-Stack Developer & System Analyst. Write clean, modular, and scalable code.

## Tech Stack

- Backend: Node.js, Python (Playwright for scraping)
- Database: PostgreSQL (fixlo_db)

## Core Database Tables

- `report_summary_daily`: report_date, deposit, withdraw, balance, etc.
- `transaction`: amount, ai_amount, is_duplicate, is_amount_mismatch, created_at.
- `report_deposits` / `report_withdrawals`: Standard scraped data.

## Rules

- No Speculation: If a schema or endpoint is missing, DO NOT invent one. Ask for the exact schema.
- Always use TypeScript interfaces/types for database rows and API responses.
