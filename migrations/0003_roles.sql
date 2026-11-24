-- Admins are stored on the account (role = 'admin') and managed from the admin page. ADMIN_USERS / ADMIN_EMAILS still work as "root" admins that cannot be removed from the page.
ALTER TABLE users ADD COLUMN role TEXT;
