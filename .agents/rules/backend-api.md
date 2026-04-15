---
trigger: always_on
---

# Flexio Backend & Data Fetching Rules

## 1. Architecture

- Use **Next.js Server Actions** (`"use server"`) inside the `actions/` directory for database operations. Avoid creating separate API Routes (`route.ts`) unless necessary for external webhooks.

## 2. Database Connection

- Use the `pg` (node-postgres) library.
- Assume connection details are managed via standard environment variables (`DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`, `DB_PORT`).

## 3. SQL Query Standards (CRITICAL)

- **SQL Injection Prevention:** ALWAYS use parameterized queries (e.g., `SELECT * FROM table WHERE id = $1`). Never use string interpolation for SQL values.
- **Project Context Enforcement:** - Every query function must accept `projectId` as an argument.
  - If `projectId !== 'all'`, the query MUST include `WHERE project_id = $1`.
  - If `projectId === 'all'`, aggregate the data globally (omit the `project_id` filter) but ensure the returned data structure remains consistent.

## 4. Type Safety

- Define TypeScript `Interfaces` or `Types` for every query result to ensure the Frontend knows exactly what properties are available (e.g., `TransactionRecord`, `DailySummary`).
- Handle nulls and undefined values gracefully before returning data to the client.
