const { randomBytes } = require('node:crypto');

process.env.NODE_ENV ||= 'test';
process.env.JWT_SECRET ||= randomBytes(48).toString('base64url');
if (process.env.TEST_MONGODB_URI) process.env.MONGODB_URI = process.env.TEST_MONGODB_URI;
