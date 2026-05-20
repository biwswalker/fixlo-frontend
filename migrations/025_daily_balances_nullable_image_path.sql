-- Allow NULL image_path for manual balance entries (source = 'manual')
-- Discord bot entries always have image_path; manual entries may not.
ALTER TABLE daily_balances ALTER COLUMN image_path DROP NOT NULL;
