
import Database from 'better-sqlite3';

try {
  const db = new Database('bible.sqlite', { readonly: true });
  const count = db.prepare('SELECT count(*) as c FROM verses').get();
  console.log('Verses count:', count);
  const books = db.prepare('SELECT count(*) as c FROM books').get();
  console.log('Books count:', books);
  console.log('Integrity check passed (basic read)');
} catch (e) {
  console.error('Integrity check failed:', e);
  process.exit(1);
}
