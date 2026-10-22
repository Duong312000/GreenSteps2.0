require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });
const { sequelize } = require('../src/config/db.config');
const { DataTypes } = require('sequelize');
(async () => {
  try {
    const query = sequelize.getQueryInterface();
    const columns = await query.describeTable('Users');
    if (!columns.facebook_id) await query.addColumn('Users', 'facebook_id', { type: DataTypes.STRING, allowNull: true, unique: true });
    console.log('Facebook identity column ready');
  } catch (error) { console.error(error.message); process.exitCode = 1; }
  finally { await sequelize.close(); }
})();
