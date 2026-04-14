import fs from 'fs';
import path from 'path';
import Database from 'better-sqlite3';

async function buildStatic() {
  console.log('Starting static data export for Cloudflare Pages...');
  
  if (!fs.existsSync('bible.sqlite')) {
    console.error('bible.sqlite not found! Please run seed-db.ts first.');
    process.exit(1);
  }

  const db = new Database('bible.sqlite', { readonly: true });
  const outDir = path.join(process.cwd(), 'public', 'data');

  // Ensure directories exist
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  console.log('Exporting books.json...');
  const books = db.prepare(`
    SELECT b.*, 
           MIN(v.global_ordinal) as start_ordinal,
           COUNT(v.id) as verse_count
    FROM books b
    LEFT JOIN verses v ON b.id = v.book_id
    GROUP BY b.id
    ORDER BY b.ordinal
  `).all();
  fs.writeFileSync(path.join(outDir, 'books.json'), JSON.stringify(books));

  console.log('Exporting chapters.json...');
  const chapters = db.prepare(`
    SELECT book_id, chapter, 
           MIN(global_ordinal) as start_ordinal,
           COUNT(id) as verse_count
    FROM verses
    GROUP BY book_id, chapter
    ORDER BY book_id, chapter
  `).all();
  fs.writeFileSync(path.join(outDir, 'chapters.json'), JSON.stringify(chapters));

  console.log('Exporting cross-references.json...');
  const refs = db.prepare("SELECT from_verse_id as source, to_verse_id as target, strength FROM cross_references").all();
  fs.writeFileSync(path.join(outDir, 'cross-references.json'), JSON.stringify(refs));

  console.log('Exporting ordinal-to-verse.json...');
  const ordinals = db.prepare(`
    SELECT v.global_ordinal, b.name as book_name, v.chapter, v.verse
    FROM verses v
    JOIN books b ON v.book_id = b.id
    ORDER BY v.global_ordinal
  `).all();
  
  // Create an array where index = global_ordinal
  const ordinalArray = new Array(ordinals.length);
  for (const row of ordinals as any[]) {
    ordinalArray[row.global_ordinal] = { b: row.book_name, c: row.chapter, v: row.verse };
  }
  fs.writeFileSync(path.join(outDir, 'ordinal-to-verse.json'), JSON.stringify(ordinalArray));

  console.log('Exporting chapter files (this might take a few seconds)...');
  const chapterDir = path.join(outDir, 'chapter');
  if (!fs.existsSync(chapterDir)) {
    fs.mkdirSync(chapterDir, { recursive: true });
  }

  for (const book of books as any[]) {
    const bookDir = path.join(chapterDir, book.name);
    if (!fs.existsSync(bookDir)) {
      fs.mkdirSync(bookDir, { recursive: true });
    }
    
    const bookChapters = chapters.filter((c: any) => c.book_id === book.id);
    for (const chap of bookChapters as any[]) {
      const verses = db.prepare(`
        SELECT v.*, b.name as book_name 
        FROM verses v 
        JOIN books b ON v.book_id = b.id 
        WHERE v.book_id = ? AND v.chapter = ? 
        ORDER BY v.verse ASC
      `).all(book.id, chap.chapter);
      
      fs.writeFileSync(path.join(bookDir, `${chap.chapter}.json`), JSON.stringify(verses));
    }
  }

  console.log('Static data export complete! All files are in /public/data');
  db.close();
}

buildStatic().catch(console.error);
