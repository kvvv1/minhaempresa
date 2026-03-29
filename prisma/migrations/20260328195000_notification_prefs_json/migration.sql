ALTER TABLE "User"
ALTER COLUMN "notificationPrefs" TYPE JSONB
USING "notificationPrefs"::jsonb;
