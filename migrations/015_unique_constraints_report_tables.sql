-- Migration 015: UNIQUE constraints on report_* tables and daily_balances
-- Pairs with scraper ON CONFLICT clauses in fixlo-spectre.
-- Run after deduplication pass below.

-- ============================================================
-- AUDIT — run standalone to inspect duplicates before applying
-- ============================================================
-- SELECT report_date, project_id, COUNT(*) FROM report_summary_daily GROUP BY 1,2 HAVING COUNT(*) > 1;
-- SELECT trans_date, username, amount, web_acc, COUNT(*) FROM report_deposits GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
-- SELECT trans_date, username, amount, web_acc, COUNT(*) FROM report_withdrawals GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
-- SELECT trans_date, member_user, amount, staff_user, COUNT(*) FROM report_manual_credit_in GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
-- SELECT trans_date, member_user, amount, staff_user, COUNT(*) FROM report_manual_credit_out GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
-- SELECT trans_date, member_user, amount, staff_user, COUNT(*) FROM report_manual_bonus_in GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
-- SELECT trans_date, member_user, amount, staff_user, COUNT(*) FROM report_manual_bonus_out GROUP BY 1,2,3,4 HAVING COUNT(*) > 1;
-- SELECT date, account_name, COUNT(*) FROM daily_balances GROUP BY 1,2 HAVING COUNT(*) > 1;

-- ============================================================
-- DEDUPE — latest row (max created_at) wins per natural key
-- ============================================================

-- report_summary_daily
DELETE FROM report_summary_daily
WHERE id NOT IN (
  SELECT DISTINCT ON (report_date, project_id) id
  FROM report_summary_daily
  ORDER BY report_date, project_id, created_at DESC NULLS LAST
);

-- report_deposits
DELETE FROM report_deposits
WHERE id NOT IN (
  SELECT DISTINCT ON (trans_date, username, amount, web_acc) id
  FROM report_deposits
  ORDER BY trans_date, username, amount, web_acc, created_at DESC NULLS LAST
);

-- report_withdrawals
DELETE FROM report_withdrawals
WHERE id NOT IN (
  SELECT DISTINCT ON (trans_date, username, amount, web_acc) id
  FROM report_withdrawals
  ORDER BY trans_date, username, amount, web_acc, created_at DESC NULLS LAST
);

-- report_manual_credit_in
DELETE FROM report_manual_credit_in
WHERE id NOT IN (
  SELECT DISTINCT ON (trans_date, member_user, amount, staff_user) id
  FROM report_manual_credit_in
  ORDER BY trans_date, member_user, amount, staff_user, created_at DESC NULLS LAST
);

-- report_manual_credit_out
DELETE FROM report_manual_credit_out
WHERE id NOT IN (
  SELECT DISTINCT ON (trans_date, member_user, amount, staff_user) id
  FROM report_manual_credit_out
  ORDER BY trans_date, member_user, amount, staff_user, created_at DESC NULLS LAST
);

-- report_manual_bonus_in
DELETE FROM report_manual_bonus_in
WHERE id NOT IN (
  SELECT DISTINCT ON (trans_date, member_user, amount, staff_user) id
  FROM report_manual_bonus_in
  ORDER BY trans_date, member_user, amount, staff_user, created_at DESC NULLS LAST
);

-- report_manual_bonus_out
DELETE FROM report_manual_bonus_out
WHERE id NOT IN (
  SELECT DISTINCT ON (trans_date, member_user, amount, staff_user) id
  FROM report_manual_bonus_out
  ORDER BY trans_date, member_user, amount, staff_user, created_at DESC NULLS LAST
);

-- daily_balances
DELETE FROM daily_balances
WHERE id NOT IN (
  SELECT DISTINCT ON (date, account_name) id
  FROM daily_balances
  ORDER BY date, account_name, created_at DESC NULLS LAST
);

-- ============================================================
-- UNIQUE CONSTRAINTS
-- ============================================================

ALTER TABLE report_summary_daily
  ADD CONSTRAINT uq_report_summary_daily_date_project UNIQUE (report_date, project_id);

ALTER TABLE report_deposits
  ADD CONSTRAINT uq_report_deposits_natural_key UNIQUE (trans_date, username, amount, web_acc);

ALTER TABLE report_withdrawals
  ADD CONSTRAINT uq_report_withdrawals_natural_key UNIQUE (trans_date, username, amount, web_acc);

ALTER TABLE report_manual_credit_in
  ADD CONSTRAINT uq_report_manual_credit_in_natural_key UNIQUE (trans_date, member_user, amount, staff_user);

ALTER TABLE report_manual_credit_out
  ADD CONSTRAINT uq_report_manual_credit_out_natural_key UNIQUE (trans_date, member_user, amount, staff_user);

ALTER TABLE report_manual_bonus_in
  ADD CONSTRAINT uq_report_manual_bonus_in_natural_key UNIQUE (trans_date, member_user, amount, staff_user);

ALTER TABLE report_manual_bonus_out
  ADD CONSTRAINT uq_report_manual_bonus_out_natural_key UNIQUE (trans_date, member_user, amount, staff_user);

ALTER TABLE daily_balances
  ADD CONSTRAINT uq_daily_balances_date_account UNIQUE (date, account_name);
