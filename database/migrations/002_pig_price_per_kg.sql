-- Run once in the existing PigMENT database before deploying the new PHP and UI.
ALTER TABLE pigs ADD COLUMN price_per_kg DECIMAL(10,2) NULL DEFAULT NULL;
