require('dotenv').config();
const { sequelize } = require('../src/config/db.config');
const migrations = [
  require('../migrations/202607130001_auth_otp_and_user_verification'),
  require('../migrations/202607130002_pending_registrations')
];

async function main() {
  const direction = process.argv[2] === 'down' ? 'down' : 'up';
  try {
    await sequelize.authenticate();
    const steps = direction === 'down' ? [...migrations].reverse() : migrations;
    for (const migration of steps) {
      await migration[direction]({ sequelize });
    }
    console.log(`Auth OTP migration ${direction} completed.`);
  } finally {
    await sequelize.close();
  }
}

main().catch((error) => {
  console.error('Auth OTP migration failed:', error);
  process.exit(1);
});
