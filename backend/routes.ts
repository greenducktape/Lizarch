import { Router } from "express";
import { getDb } from "./db.js";

const router = Router();

router.get("/health", (req, res) => {
  res.json({ status: "ok", env: process.env.NODE_ENV });
});

router.get("/books", (req, res) => {
  console.log("GET /api/books");
  try {
    const db = getDb();
    const books = db.prepare(`
      SELECT b.*, 
             MIN(v.global_ordinal) as start_ordinal,
             COUNT(v.id) as verse_count
      FROM books b
      LEFT JOIN verses v ON b.id = v.book_id
      GROUP BY b.id
      ORDER BY b.ordinal
    `).all();
    res.json(books);
  } catch (e: any) {
    console.error("Error fetching books:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/chapters", (req, res) => {
  console.log("GET /api/chapters");
  try {
    const db = getDb();
    const chapters = db.prepare(`
      SELECT book_id, chapter, 
             MIN(global_ordinal) as start_ordinal,
             COUNT(id) as verse_count
      FROM verses
      GROUP BY book_id, chapter
      ORDER BY book_id, chapter
    `).all();
    res.json(chapters);
  } catch (e: any) {
    console.error("Error fetching chapters:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/cross-references", (req, res) => {
  console.log("GET /api/cross-references");
  try {
    const db = getDb();
    // Return all cross-references, compression middleware will gzip it
    const refs = db.prepare("SELECT from_verse_id as source, to_verse_id as target, strength FROM cross_references").all();
    res.json(refs);
  } catch (e: any) {
    console.error("Error fetching refs:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/verse-by-ordinal", (req, res) => {
  const { ordinal } = req.query;
  if (ordinal === undefined) {
      res.status(400).json({ error: "Missing ordinal parameter" });
      return;
  }
  
  try {
    const db = getDb();
    const v = db.prepare(`
      SELECT v.*, b.name as book_name 
      FROM verses v 
      JOIN books b ON v.book_id = b.id 
      WHERE v.global_ordinal = ?
    `).get(ordinal);
    
    if (v) {
        res.json(v);
    } else {
        res.status(404).json({ error: "Verse not found" });
    }
  } catch (e: any) {
    console.error("Error fetching verse by ordinal:", e);
    res.status(500).json({ error: e.message });
  }
});

router.get("/verse", (req, res) => {
  const { book, chapter, verse } = req.query;
  if (!book || !chapter || !verse) {
      res.status(400).json({ error: "Missing parameters" });
      return;
  }
  
  try {
    const db = getDb();
    const bookRec = db.prepare("SELECT id FROM books WHERE name = ?").get(book) as any;
    if (!bookRec) {
        res.status(404).json({ error: "Book not found" });
        return;
    }

    const v = db.prepare("SELECT * FROM verses WHERE book_id = ? AND chapter = ? AND verse = ?").get(bookRec.id, chapter, verse);
    
    if (v) {
        res.json(v);
    } else {
        res.status(404).json({ error: "Verse not found" });
    }
  } catch (e: any) {
      console.error("Error fetching verse:", e);
      res.status(500).json({ error: e.message });
  }
});

router.get("/chapter", (req, res) => {
  const { book, chapter } = req.query;
  try {
    const db = getDb();
    const bookRec = db.prepare("SELECT id FROM books WHERE name = ?").get(book) as any;
    if (!bookRec) {
        res.status(404).json({ error: "Book not found" });
        return;
    }

    const verses = db.prepare("SELECT * FROM verses WHERE book_id = ? AND chapter = ? ORDER BY verse ASC").all(bookRec.id, chapter);
    res.json(verses);
  } catch (e: any) {
    console.error("Error fetching chapter:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;
