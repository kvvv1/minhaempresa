ALTER TABLE "CompanyValuation"
ALTER COLUMN "scores" TYPE JSONB
USING "scores"::jsonb;
