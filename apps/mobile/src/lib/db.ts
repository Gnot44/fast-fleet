import * as SQLite from 'expo-sqlite';
import { supabase } from './supabase';

export async function openDatabase() {
  const db = await SQLite.openDatabaseAsync('fleet-manage.db');
  
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS offline_queue (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      endpoint TEXT NOT NULL,
      payload TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      retry_count INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  return db;
}

export async function queueRequest(endpoint: string, payload: any) {
  const db = await openDatabase();
  await db.runAsync(
    'INSERT INTO offline_queue (endpoint, payload, status) VALUES (?, ?, ?)',
    [endpoint, JSON.stringify(payload), 'pending']
  );
}

export async function getQueueCount(): Promise<number> {
  try {
    const db = await openDatabase();
    const result = await db.getFirstAsync<{ count: number }>(
      "SELECT count(*) as count FROM offline_queue WHERE status = 'pending'"
    );
    return result?.count || 0;
  } catch (e) {
    console.warn('Error reading queue count:', e);
    return 0;
  }
}

export async function processQueue(): Promise<{ processed: number; failed: number }> {
  let processed = 0;
  let failed = 0;

  try {
    const db = await openDatabase();
    const rows = await db.getAllAsync<{
      id: number;
      endpoint: string;
      payload: string;
      status: string;
      retry_count: number;
    }>("SELECT * FROM offline_queue WHERE status = 'pending' ORDER BY id ASC LIMIT 50");

    if (!rows || rows.length === 0) {
      return { processed: 0, failed: 0 };
    }

    for (const item of rows) {
      try {
        const payloadData = JSON.parse(item.payload);
        const targetTable = item.endpoint as any;

        // Perform insert to Supabase
        const { error } = await supabase.from(targetTable).insert(payloadData);

        if (!error) {
          // Success: delete processed item from offline queue
          await db.runAsync('DELETE FROM offline_queue WHERE id = ?', [item.id]);
          processed++;
        } else {
          console.warn(`Error syncing queued item #${item.id} to ${item.endpoint}:`, error.message);
          // Increment retry count
          await db.runAsync(
            "UPDATE offline_queue SET retry_count = retry_count + 1, status = CASE WHEN retry_count >= 5 THEN 'failed' ELSE 'pending' END WHERE id = ?",
            [item.id]
          );
          failed++;
        }
      } catch (itemErr) {
        console.warn(`Failed processing offline item #${item.id}:`, itemErr);
        await db.runAsync(
          "UPDATE offline_queue SET retry_count = retry_count + 1, status = 'failed' WHERE id = ?",
          [item.id]
        );
        failed++;
      }
    }
  } catch (err) {
    console.error('Error during offline queue sync:', err);
  }

  return { processed, failed };
}
