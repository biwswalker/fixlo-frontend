-- migration 048: seed global managed transaction types (ADR 0019)
-- Idempotent: skip if name already exists as a global type (project_id IS NULL).
INSERT INTO transaction_types (project_id, name, created_by)
SELECT NULL, v.name, 'system'
FROM (VALUES
  ('ถอนให้ลูกค้า'),
  ('โอนไบแนน'),
  ('รายจ่าย')
) AS v(name)
WHERE NOT EXISTS (
  SELECT 1 FROM transaction_types t
  WHERE t.name = v.name AND t.project_id IS NULL
);
