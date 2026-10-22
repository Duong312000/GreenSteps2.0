async function up({ sequelize }) {
  await sequelize.query(`
    CREATE TABLE IF NOT EXISTS "pending_registrations" (
      "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      "username" VARCHAR(255) NOT NULL,
      "email" VARCHAR(255) NOT NULL,
      "password_hash" VARCHAR(255) NOT NULL,
      "otp_hash" VARCHAR(255) NOT NULL,
      "expires_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "consumed_at" TIMESTAMP WITH TIME ZONE NULL,
      "attempt_count" INTEGER NOT NULL DEFAULT 0,
      "resend_available_at" TIMESTAMP WITH TIME ZONE NOT NULL,
      "created_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      "updated_at" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_pending_registrations_email_active"
      ON "pending_registrations" ("email", "consumed_at", "expires_at");
  `);

  await sequelize.query(`
    CREATE INDEX IF NOT EXISTS "idx_pending_registrations_username_active"
      ON "pending_registrations" ("username", "consumed_at", "expires_at");
  `);
}

async function down({ sequelize }) {
  await sequelize.query('DROP TABLE IF EXISTS "pending_registrations";');
}

module.exports = { up, down };
