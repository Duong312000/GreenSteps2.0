require('dotenv').config();
const app = require('./src/app');
const { sequelize } = require('./src/config/db.config');

const PORT = process.env.PORT || 5055;

async function startServer() {
  try {
    console.log('Connecting to PostgreSQL database...');
    await sequelize.authenticate();
    console.log('Successfully connected to PostgreSQL database!');
    // await sequelize.sync({ alter: true });
    console.log('PostgreSQL database schema is ready!');

    app.listen(PORT, () => {
      console.log(`GreenSteps Premium E-Commerce Server is running on port ${PORT}...`);
    });
  } catch (err) {
    console.error('Failed to connect to database. Server was not started.');
    console.error(err.message);
    process.exit(1);
  }
}

startServer();
