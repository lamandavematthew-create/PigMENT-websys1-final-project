-- OPTIONAL. Do not execute without team approval and a database backup.
-- This table maintains moderation independently of seller-owned listing status.
-- Confirm marketplace_listings.listing_id and users.user_id types are compatible before applying.
CREATE TABLE listing_moderation (
  listing_id INT NOT NULL PRIMARY KEY,
  is_hidden TINYINT(1) NOT NULL DEFAULT 0,
  reason VARCHAR(500) NULL,
  moderated_by INT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_listing_mod_listing FOREIGN KEY (listing_id) REFERENCES marketplace_listings(listing_id) ON DELETE CASCADE,
  CONSTRAINT fk_listing_mod_user FOREIGN KEY (moderated_by) REFERENCES users(user_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
