import Database from "better-sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In Vercel, the file might be in a different location relative to the function
// We'll try a few common locations
const dbName = 'bible.sqlite';

function getDbPath() {
  // 1. Try relative to this file (works in local dev if file is in backend/)
  let candidate = path.join(__dirname, '..', dbName);
  
  // 2. If not found, try root (works in local dev if file is in root)
  // In local dev: __dirname is /path/to/project/backend
  // We want /path/to/project/bible.sqlite
  
  // 3. Vercel specific handling
  // On Vercel, process.cwd() is usually the root of the project
  const cwdPath = path.join(process.cwd(), dbName);
  
  // Check if we are in a Vercel environment (rudimentary check)
  if (process.env.VERCEL) {
      return path.join(process.cwd(), dbName);
  }
  
  return path.resolve(__dirname, '..', dbName);
}

let dbInstance: Database.Database | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  console.log('Initializing DB at:', dbPath);
  
  try {
    dbInstance = new Database(dbPath, { readonly: true });
    // dbInstance.pragma('journal_mode = WAL'); // Cannot set WAL in readonly mode
  } catch (error) {
    console.error(`Failed to open database at ${dbPath}:`, error);
    // Fallback for Vercel: sometimes files are moved to specific paths
    // Try one more location if the first failed?
    throw error;
  }

  return dbInstance;
}
