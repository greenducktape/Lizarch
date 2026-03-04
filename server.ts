import express from "express";
import compression from "compression";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";

console.log("SERVER SCRIPT LOADING...");
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Initialize DB
const dbPath = path.join(__dirname, 'bible.sqlite');
const db = new Database(dbPath);
db.pragma('journal_mode = WAL');

console.log('Connected to SQLite database at', dbPath);

async function startServer() {
  const app = express();
  app.use(compression());
  const PORT = 3000;

  // API Routes
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok", env: process.env.NODE_ENV });
  });

  app.get("/api/books", (req, res) => {
    console.log("GET /api/books");
    try {
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
    } catch (e) {
      console.error("Error fetching books:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/chapters", (req, res) => {
    console.log("GET /api/chapters");
    try {
      const chapters = db.prepare(`
        SELECT book_id, chapter, 
               MIN(global_ordinal) as start_ordinal,
               COUNT(id) as verse_count
        FROM verses
        GROUP BY book_id, chapter
        ORDER BY book_id, chapter
      `).all();
      res.json(chapters);
    } catch (e) {
      console.error("Error fetching chapters:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/cross-references", (req, res) => {
    console.log("GET /api/cross-references");
    try {
      // Return all cross-references, compression middleware will gzip it
      const refs = db.prepare("SELECT from_verse_id as source, to_verse_id as target, strength FROM cross_references").all();
      res.json(refs);
    } catch (e) {
      console.error("Error fetching refs:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verse-by-ordinal", (req, res) => {
    const { ordinal } = req.query;
    if (ordinal === undefined) {
        return res.status(400).json({ error: "Missing ordinal parameter" });
    }
    
    try {
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
    } catch (e) {
      console.error("Error fetching verse by ordinal:", e);
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/verse", (req, res) => {
    const { book, chapter, verse } = req.query;
    if (!book || !chapter || !verse) {
        return res.status(400).json({ error: "Missing parameters" });
    }
    
    const bookRec = db.prepare("SELECT id FROM books WHERE name = ?").get(book) as any;
    if (!bookRec) return res.status(404).json({ error: "Book not found" });

    const v = db.prepare("SELECT * FROM verses WHERE book_id = ? AND chapter = ? AND verse = ?").get(bookRec.id, chapter, verse);
    
    if (v) {
        res.json(v);
    } else {
        res.status(404).json({ error: "Verse not found" });
    }
  });

  app.get("/api/chapter", (req, res) => {
    const { book, chapter } = req.query;
    try {
      const bookRec = db.prepare("SELECT id FROM books WHERE name = ?").get(book) as any;
      if (!bookRec) return res.status(404).json({ error: "Book not found" });

      const verses = db.prepare("SELECT * FROM verses WHERE book_id = ? AND chapter = ? ORDER BY verse ASC").all(bookRec.id, chapter);
      res.json(verses);
    } catch (e) {
      console.error("Error fetching chapter:", e);
      res.status(500).json({ error: e.message });
    }
  });

  // Debug catch-all for /api
  app.use("/api/*", (req, res) => {
    console.log(`Unmatched API request: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: "Not Found", path: req.originalUrl });
  });

  // Vite middleware or static files
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    // Production: serve from dist
    const distPath = path.resolve(__dirname, "dist");
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get("*", (req, res) => {
        res.sendFile(path.resolve(distPath, "index.html"));
      });
    } else {
      console.warn("Production mode but 'dist' directory not found. Did you run 'npm run build'?");
      // Fallback to Vite even in production if dist is missing (useful for some preview envs)
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: "spa",
      });
      app.use(vite.middlewares);
    }
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`>>> Server is listening on 0.0.0.0:${PORT}`);
    console.log(`>>> Environment: ${process.env.NODE_ENV}`);
  });
}

console.log("Calling startServer()...");
startServer().catch(err => {
  console.error("FATAL ERROR STARTING SERVER:", err);
});
