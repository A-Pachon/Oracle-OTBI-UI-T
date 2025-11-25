import { ConnectionConfig, SavedQuery } from '../types';

declare const initSqlJs: any;

const DB_NAME = 'DuckOracleDB';
const STORE_NAME = 'sqlite_store';
const KEY_NAME = 'sqlite_binary';

let db: any = null;

// --- Persistence Helpers (IndexedDB) ---

const saveToDisk = async () => {
  if (!db) return;
  const binaryArray = db.export();
  
  return new Promise<void>((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event: any) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: any) => {
      const dbInstance = event.target.result;
      const transaction = dbInstance.transaction(STORE_NAME, 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      store.put(binaryArray, KEY_NAME);
      
      transaction.oncomplete = () => resolve();
      transaction.onerror = () => reject('Failed to save DB to disk');
    };

    request.onerror = () => reject('Failed to open IndexedDB');
  });
};

const loadFromDisk = async (): Promise<Uint8Array | null> => {
  return new Promise((resolve) => {
    const request = indexedDB.open(DB_NAME, 1);
    
    request.onupgradeneeded = (event: any) => {
      const dbInstance = event.target.result;
      if (!dbInstance.objectStoreNames.contains(STORE_NAME)) {
        dbInstance.createObjectStore(STORE_NAME);
      }
    };

    request.onsuccess = (event: any) => {
      const dbInstance = event.target.result;
      const transaction = dbInstance.transaction(STORE_NAME, 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const getRequest = store.get(KEY_NAME);

      getRequest.onsuccess = () => resolve(getRequest.result || null);
      getRequest.onerror = () => resolve(null); // Return null if not found
    };

    request.onerror = () => resolve(null);
  });
};

// --- Main Service ---

export const initDB = async () => {
  if (db) return;

  try {
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });

    const savedBinary = await loadFromDisk();

    if (savedBinary) {
      db = new SQL.Database(savedBinary);
    } else {
      db = new SQL.Database();
      // Initialize Schema
      db.run(`
        CREATE TABLE IF NOT EXISTS connections (
          id TEXT PRIMARY KEY, 
          name TEXT, 
          url TEXT, 
          username TEXT, 
          password TEXT, 
          soapTemplate TEXT, 
          corsProxy TEXT
        );
        CREATE TABLE IF NOT EXISTS saved_queries (
          id TEXT PRIMARY KEY, 
          name TEXT, 
          description TEXT, 
          query TEXT
        );
      `);
      await saveToDisk();
    }
    console.log("SQLite Database Initialized");
  } catch (err) {
    console.error("Failed to initialize SQLite", err);
    throw err;
  }
};

// --- DB Sync / Blob Methods ---

export const getDatabaseBlob = (): Blob | null => {
    if (!db) return null;
    const binary = db.export();
    return new Blob([binary], { type: 'application/x-sqlite3' });
}

export const overwriteDatabase = async (blob: Blob) => {
    const buffer = await blob.arrayBuffer();
    const u8 = new Uint8Array(buffer);
    
    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.8.0/${file}`
    });
    
    // Replace DB instance
    if (db) db.close();
    db = new SQL.Database(u8);
    
    // Save new state to IndexedDB immediately
    await saveToDisk();
    console.log("Database overwritten successfully.");
}

// --- Connections CRUD ---

export const getConnections = async (): Promise<ConnectionConfig[]> => {
  if (!db) await initDB();
  // Safe check if table exists (in case of restore from old DB)
  try {
      const stmt = db.prepare("SELECT * FROM connections");
      const result: ConnectionConfig[] = [];
      while (stmt.step()) {
        result.push(stmt.getAsObject() as ConnectionConfig);
      }
      stmt.free();
      return result;
  } catch (e) {
      // Create tables if missing
      db.run(`
        CREATE TABLE IF NOT EXISTS connections (
          id TEXT PRIMARY KEY, name TEXT, url TEXT, username TEXT, password TEXT, soapTemplate TEXT, corsProxy TEXT
        );
      `);
      return [];
  }
};

export const saveConnection = async (conn: ConnectionConfig) => {
  if (!db) await initDB();
  db.run(`
    INSERT OR REPLACE INTO connections (id, name, url, username, password, soapTemplate, corsProxy)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `, [conn.id, conn.name, conn.url, conn.username, conn.password, conn.soapTemplate, conn.corsProxy]);
  await saveToDisk();
};

export const deleteConnection = async (id: string) => {
  if (!db) await initDB();
  db.run("DELETE FROM connections WHERE id = ?", [id]);
  await saveToDisk();
};

export const updateAllConnections = async (conns: ConnectionConfig[]) => {
  if (!db) await initDB();
  db.run("DELETE FROM connections");
  
  conns.forEach(c => {
    db.run(`
      INSERT INTO connections (id, name, url, username, password, soapTemplate, corsProxy)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [c.id, c.name, c.url, c.username, c.password, c.soapTemplate, c.corsProxy]);
  });
  
  await saveToDisk();
};


// --- Saved Queries CRUD ---

export const getSavedQueries = async (): Promise<SavedQuery[]> => {
  if (!db) await initDB();
  try {
      const stmt = db.prepare("SELECT * FROM saved_queries");
      const result: SavedQuery[] = [];
      while (stmt.step()) {
        result.push(stmt.getAsObject() as SavedQuery);
      }
      stmt.free();
      return result;
  } catch(e) {
      db.run(`
        CREATE TABLE IF NOT EXISTS saved_queries (
          id TEXT PRIMARY KEY, name TEXT, description TEXT, query TEXT
        );
      `);
      return [];
  }
};

export const saveQuery = async (query: SavedQuery) => {
  if (!db) await initDB();
  db.run(`
    INSERT OR REPLACE INTO saved_queries (id, name, description, query)
    VALUES (?, ?, ?, ?)
  `, [query.id, query.name, query.description, query.query]);
  await saveToDisk();
};

export const deleteSavedQuery = async (id: string) => {
  if (!db) await initDB();
  db.run("DELETE FROM saved_queries WHERE id = ?", [id]);
  await saveToDisk();
};
