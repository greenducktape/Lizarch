import fs from 'fs';
import https from 'https';
import AdmZip from 'adm-zip';
import Database from 'better-sqlite3';

const BIBLE_JSON_URL = 'https://raw.githubusercontent.com/thiagobodruk/bible/master/json/en_kjv.json';
const CROSS_REF_ZIP_URL = 'https://a.openbible.info/data/cross-references.zip';

const openBibleToName: Record<string, string> = {
  'Gen': 'Genesis', 'Exod': 'Exodus', 'Lev': 'Leviticus', 'Num': 'Numbers', 'Deut': 'Deuteronomy',
  'Josh': 'Joshua', 'Judg': 'Judges', 'Ruth': 'Ruth', '1Sam': '1 Samuel', '2Sam': '2 Samuel',
  '1Kgs': '1 Kings', '2Kgs': '2 Kings', '1Chr': '1 Chronicles', '2Chr': '2 Chronicles',
  'Ezra': 'Ezra', 'Neh': 'Nehemiah', 'Esth': 'Esther', 'Job': 'Job', 'Ps': 'Psalms',
  'Prov': 'Proverbs', 'Eccl': 'Ecclesiastes', 'Song': 'Song of Solomon', 'Isa': 'Isaiah',
  'Jer': 'Jeremiah', 'Lam': 'Lamentations', 'Ezek': 'Ezekiel', 'Dan': 'Daniel',
  'Hos': 'Hosea', 'Joel': 'Joel', 'Amos': 'Amos', 'Obad': 'Obadiah', 'Jonah': 'Jonah',
  'Mic': 'Micah', 'Nah': 'Nahum', 'Hab': 'Habakkuk', 'Zeph': 'Zephaniah', 'Hag': 'Haggai',
  'Zech': 'Zechariah', 'Mal': 'Malachi', 'Matt': 'Matthew', 'Mark': 'Mark', 'Luke': 'Luke',
  'John': 'John', 'Acts': 'Acts', 'Rom': 'Romans', '1Cor': '1 Corinthians', '2Cor': '2 Corinthians',
  'Gal': 'Galatians', 'Eph': 'Ephesians', 'Phil': 'Philippians', 'Col': 'Colossians',
  '1Thess': '1 Thessalonians', '2Thess': '2 Thessalonians', '1Tim': '1 Timothy',
  '2Tim': '2 Timothy', 'Titus': 'Titus', 'Phlm': 'Philemon', 'Heb': 'Hebrews',
  'Jas': 'James', '1Pet': '1 Peter', '2Pet': '2 Peter', '1John': '1 John',
  '2John': '2 John', '3John': '3 John', 'Jude': 'Jude', 'Rev': 'Revelation'
};

async function download(url: string): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        return download(res.headers.location!).then(resolve).catch(reject);
      }
      if (res.statusCode !== 200) {
        return reject(new Error(`Failed to download ${url}: ${res.statusCode}`));
      }
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => resolve(Buffer.concat(chunks)));
      res.on('error', reject);
    }).on('error', reject);
  });
}

async function seed() {
  console.log('Downloading Bible JSON...');
  const bibleBuffer = await download(BIBLE_JSON_URL);
  let bibleString = bibleBuffer.toString('utf8');
  if (bibleString.charCodeAt(0) === 0xFEFF) {
    bibleString = bibleString.slice(1);
  }
  const bibleData = JSON.parse(bibleString);

  console.log('Downloading Cross References...');
  const zipBuffer = await download(CROSS_REF_ZIP_URL);
  const zip = new AdmZip(zipBuffer);
  const entry = zip.getEntries().find(e => e.entryName.endsWith('.txt'));
  if (!entry) throw new Error('Could not find cross_references.txt in zip');
  const crossRefText = zip.readAsText(entry);

  console.log('Initializing Database...');
  if (fs.existsSync('bible.sqlite')) {
    fs.unlinkSync('bible.sqlite');
  }
  const db = new Database('bible.sqlite');

  db.exec(`
    CREATE TABLE IF NOT EXISTS books (
      id INTEGER PRIMARY KEY,
      name TEXT,
      testament TEXT,
      chapter_count INTEGER,
      ordinal INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS verses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER,
      chapter INTEGER,
      verse INTEGER,
      text TEXT,
      global_ordinal INTEGER
    );
    
    CREATE TABLE IF NOT EXISTS cross_references (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      from_verse_id INTEGER,
      to_verse_id INTEGER,
      strength INTEGER
    );
  `);

  const insertBook = db.prepare("INSERT INTO books (name, testament, chapter_count, ordinal) VALUES (?, ?, ?, ?)");
  const insertVerse = db.prepare("INSERT INTO verses (book_id, chapter, verse, text, global_ordinal) VALUES (?, ?, ?, ?, ?)");
  
  // Fast inserts
  db.exec("BEGIN TRANSACTION");

  console.log('Inserting Books and Verses...');
  let globalOrdinal = 0;
  const verseMap = new Map<string, number>(); // "Genesis.1.1" -> global_ordinal

  bibleData.forEach((book: any, bookIndex: number) => {
    const testament = bookIndex < 39 ? 'OT' : 'NT';
    // Handle edge case where Psalms might be named differently in some JSONs, but thiagobodruk uses standard names
    let bookName = book.name;
    if (bookName === 'Psalm') bookName = 'Psalms'; // Normalize
    
    insertBook.run(bookName, testament, book.chapters.length, bookIndex + 1);
    const bookId = bookIndex + 1;

    book.chapters.forEach((chapter: string[], chapterIndex: number) => {
      const chapterNum = chapterIndex + 1;
      chapter.forEach((verseText: string, verseIndex: number) => {
        const verseNum = verseIndex + 1;
        insertVerse.run(bookId, chapterNum, verseNum, verseText, globalOrdinal);
        verseMap.set(`${bookName}.${chapterNum}.${verseNum}`, globalOrdinal);
        globalOrdinal++;
      });
    });
  });

  console.log('Inserting Cross References...');
  const insertRef = db.prepare("INSERT INTO cross_references (from_verse_id, to_verse_id, strength) VALUES (?, ?, ?)");
  
  const lines = crossRefText.split('\n');
  let refCount = 0;
  for (const line of lines) {
    if (!line || line.startsWith('From Verse')) continue;
    
    const parts = line.split('\t');
    if (parts.length < 3) continue;
    
    const fromStr = parts[0].split('-')[0]; // Handle ranges by taking the first verse
    const toStr = parts[1].split('-')[0];
    const votes = parseInt(parts[2], 10);

    // Filter out weak references to keep the DB size manageable and visualization clean
    // OpenBible has ~340k references. Let's keep those with > 1 vote.
    // Actually, let's keep everything for the DB, but we can filter in the UI.
    // To keep the SQLite DB small, maybe we only insert > 0 votes.
    if (votes <= 0) continue;

    const parseRef = (str: string) => {
      const parts = str.split('.');
      if (parts.length !== 3) return null;
      const bookName = openBibleToName[parts[0]];
      if (!bookName) return null;
      return `${bookName}.${parts[1]}.${parts[2]}`;
    };

    const fromKey = parseRef(fromStr);
    const toKey = parseRef(toStr);

    if (fromKey && toKey) {
      const fromId = verseMap.get(fromKey);
      const toId = verseMap.get(toKey);
      
      if (fromId !== undefined && toId !== undefined && fromId !== toId) {
        insertRef.run(fromId, toId, votes);
        refCount++;
      }
    }
  }

  db.exec("COMMIT");
  
  // Create indexes for fast querying
  db.exec("CREATE INDEX idx_verses_book_chapter ON verses(book_id, chapter)");
  db.exec("CREATE INDEX idx_refs_from ON cross_references(from_verse_id)");
  
  console.log(`Done! Inserted ${globalOrdinal} verses and ${refCount} cross-references.`);
  db.close();
}

seed().catch(console.error);
