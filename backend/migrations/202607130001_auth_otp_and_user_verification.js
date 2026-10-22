async function up({ sequelize }) {
  await sequelize.query(`
    ALTER TABLE "Users"
      ALTER COLUMN "fullname" DROP NOT NULL;
  `);

  await sequelize.query(`
    ALTER TABLE "Users"
      ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN NOT NULL DEFAULT TRUE;
  `);

  await sequelize.query(`
    UPDATE "Users" SET "is_verified" = TRUE WHERE "is_verified" IS NULL;
  `);

  await sequelize.query(`
    ALTER TABLE "Users"
      ALTER COLUMN "is_verified" SET DEFAULT FALSE;
  `);

  await sequelize.query(`
    DO $$
    BEGIN
      IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_auth_otps_purpose') THEN
        CREATE TYPE "enum_auth_otps_purpose" AS ENUM ('REGISTER', 'RESET_PASSWORD');
      END IF;
    END
    $$;
  `);

  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "auth_otps" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "user_id" VARCHAR(255) NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
      "purpose" "enum_auth_otps_purpose" NOT NULL,
      "otp_hash" VARCHAR(255) NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "consumed_at" TIMESTAMP WITH TIME ZONE NULL,
      "attempt_count" INTEGER NOT NULL DEFAULT 0,
      "resend_available_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "reset_token_hash" VARCHAR(255) NULL,
      "reset_token_expires_at" TIMESTAMP WITH TIME ZONE NULL,
      "reset_token_consumed_at" TIMESTAMP WITH TIME ZONE NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_auth_otps_user_purpose_active"
      ON "auth_otps" ("user_id", "purpose", "consumed_at", "expires_at");
  `);
}

async function down({ sequelize }) {
  await sequelize.query('DROP TABLE IF EXISTS "auth_otps";');
  await sequelize.query('DROP TYPE IF EXISTS "enum_auth_otps_purpose";');
  await sequelize.query('ALTER TABLE "Users" DROP COLUMN IF EXISTS "is_verified";');
  await sequelize.query('ALTER TABLE "Users" ALTER COLUMN "fullname" SET NOT NULL;');
}

module.exports = { up, down };
