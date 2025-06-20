const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const dbPath = path.join(__dirname, '../../chatme/database/users.db');

const db = new sqlite3.Database(dbPath, sqlite3.OPEN_READWRITE, (err) => {
  if (err) {
    console.error('❌ DB open error:', err.message);
  } else {
    console.log('✅ Connected to SQLite database');
  }
});

module.exports = db;
