import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dbName = 'bible.sqlite';

function getDbPath() {
  const candidates = [
    path.resolve(__dirname, '..', dbName),
    path.resolve(process.cwd(), dbName),
    path.resolve(process.cwd(), 'api', dbName),
    path.resolve('/var/task', dbName),
    path.resolve('/var/task/api', dbName),
  ];

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  throw new Error(`Unable to find ${dbName}. Checked: ${candidates.join(', ')}`);
}

let dbInstance: Database.Database | null = null;

export function getDb() {
  if (dbInstance) return dbInstance;

  const dbPath = getDbPath();
  console.log('Initializing DB at:', dbPath);
  
  try {
    dbInstance = new Database(dbPath, { readonly: true });
  } catch (error) {
    console.error(`Failed to open database at ${dbPath}:`, error);
    throw error;
  }

  return dbInstance;
}
