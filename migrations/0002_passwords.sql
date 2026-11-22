-- Username + password sign-in. Email magic links are no longer used (the old `magic` table is simply left unused); Google stays as an optional extra.
-- Username accounts keep a placeholder in the (unique, required) email column: 'u:<username>'.
ALTER TABLE users ADD COLUMN username TEXT;
ALTER TABLE users ADD COLUMN pw TEXT;
CREATE UNIQUE INDEX users_username ON users(username) WHERE username IS NOT NULL;
