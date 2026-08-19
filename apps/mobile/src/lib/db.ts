import * as SQLite from 'expo-sqlite';

export async function openDatabase() {
  const db = await SQLite.openDatabaseAsync('fleet-manage.db');
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export async function queueRequest(endpoint: string, payload: any) {
  const db = await openDatabase();
  await db.runAsync('INSERT INTO offline_queue (endpoint, payload) VALUES (?, ?)', [
    endpoint,
    JSON.stringify(payload)
  ]);
}

export async function processQueue() {
  // Logic to read from offline_queue and push to Supabase when network is restored
}
