-- Run once against the existing PigMENT database.
-- Existing listing totals remain in asking_price with a NULL rate.
ALTER TABLE marketplace_listings
  ADD COLUMN asking_price_per_kg DECIMAL(8,2) NULL DEFAULT NULL;
