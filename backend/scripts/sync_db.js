const { sequelize } = require('../src/models/index');

async function sync() {
  try {
    console.log('Testing connection to Supabase PostgreSQL...');
    await sequelize.authenticate();
    console.log('Connection successful!');

    console.log('Synchronizing models with Supabase...');
    // Sync all models (force: true will drop tables if they exist, alter: true updates them. Let's use force: true for clean start)
    await sequelize.sync({ force: true });
    console.log('All models synchronized successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Failed to sync database:', error);
    process.exit(1);
  }
}

sync();
