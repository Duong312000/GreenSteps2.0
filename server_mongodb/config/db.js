require('dotenv').config();
const mongoose = require('mongoose');
const { MongoClient } = require('mongodb');

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/GreenStepsData';

// 1. Kết nối qua Mongoose (Hỗ trợ Schema, Validation, Middleware)
const connectDB = async () => {
  try {
    const conn = await mongoose.connect(MONGODB_URI);
    console.log(`[MongoDB] Mongoose kết nối thành công: ${conn.connection.host}/${conn.connection.name}`);
    return conn;
  } catch (error) {
    console.error('[MongoDB] Lỗi kết nối Mongoose:', error.message);
    process.exit(1);
  }
};

// 2. MongoClient Native (Theo phong cách Slide Chương VII)
let nativeClient = null;
let nativeDb = null;

const getNativeDB = async () => {
  if (!nativeClient) {
    nativeClient = new MongoClient(MONGODB_URI);
    await nativeClient.connect();
    const dbName = MONGODB_URI.split('/').pop().split('?')[0] || 'GreenStepsData';
    nativeDb = nativeClient.db(dbName);
    console.log(`[MongoDB] MongoClient Native kết nối thành công tới Database: ${dbName}`);
  }
  return { client: nativeClient, db: nativeDb };
};

module.exports = {
  connectDB,
  getNativeDB,
  MONGODB_URI
};
