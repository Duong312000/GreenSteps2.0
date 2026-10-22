const { Sequelize } = require('sequelize');
require('dotenv').config();

const dbUri = process.env.DATABASE_URL;
if (!dbUri) {
  console.error('DATABASE_URL is not set in .env file!');
  process.exit(1);
}

const isLocalDatabase = /localhost|127\.0\.0\.1/.test(dbUri);

const sequelizeOptions = {
  dialect: 'postgres',
  logging: false
};

if (!isLocalDatabase) {
  sequelizeOptions.dialectOptions = {
    ssl: {
      require: true,
      rejectUnauthorized: false
    }
  };
}

const sequelize = new Sequelize(dbUri, sequelizeOptions);

module.exports = { sequelize };
