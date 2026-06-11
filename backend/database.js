import sqlite3 from 'sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbPath = path.resolve(__dirname, 'analytics.db');
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error('Failed to connect to the SQLite database:', err.message);
  } else {
    console.log('Connected to the SQLite database at:', dbPath);
  }
});

// Helper functions to wrap sqlite3 queries in promises
const runQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this); // exposes lastID and changes
    });
  });
};

const allQuery = (sql, params = []) => {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
};

// Initialize the database tables
export const initDb = async () => {
  const createTableQuery = `
    CREATE TABLE IF NOT EXISTS logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      timestamp TEXT NOT NULL,
      ip TEXT,
      country TEXT,
      city TEXT,
      browser TEXT,
      os TEXT,
      device TEXT,
      user_agent TEXT,
      referrer TEXT,
      session_id TEXT NOT NULL
    );
  `;
  await runQuery(createTableQuery);
  console.log('Database initialized: "logs" table is ready.');
};

// Insert a log entry
export const insertLog = async (log) => {
  const sql = `
    INSERT INTO logs (timestamp, ip, country, city, browser, os, device, user_agent, referrer, session_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  const params = [
    log.timestamp || new Date().toISOString(),
    log.ip,
    log.country || 'Unknown',
    log.city || 'Unknown',
    log.browser || 'Unknown',
    log.os || 'Unknown',
    log.device || 'Unknown',
    log.user_agent || 'Unknown',
    log.referrer || 'Direct',
    log.session_id
  ];
  return runQuery(sql, params);
};

// Get all log entries sorted by timestamp descending
export const getAllLogs = async () => {
  const sql = `SELECT * FROM logs ORDER BY datetime(timestamp) DESC, id DESC`;
  return allQuery(sql);
};

// Clear all log entries
export const clearAllLogs = async () => {
  const sql = `DELETE FROM logs`;
  return runQuery(sql);
};

export default db;
