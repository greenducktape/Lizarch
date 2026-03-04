import React, { useEffect, useState, useMemo } from 'react';
import { Analytics } from '@vercel/analytics/react';
import ArcDiagram from './components/ArcDiagram';
import BibleReader from './components/BibleReader';
import { Info, Book, Filter } from 'lucide-react';

interface BookData {
  id: number;
  name: string;
  testament: string;
  chapter_count: number;
  ordinal: number;
  start_ordinal: number;
  verse_count: number;
}

interface ChapterData {
  book_id: number;
  chapter: number;
  start_ordinal: number;
  verse_count: number;
}

interface CrossRef {
  source: number;
  target: number;
  strength: number;
}

export default function App() {
  const [books, setBooks] = useState<BookData[]>([]);
  const [chapters, setChapters] = useState<ChapterData[]>([]);
  const [refs, setRefs] = useState<CrossRef[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Reader State
  const [readerOpen, setReaderOpen] = useState(false);
  const [leftRef, setLeftRef] = useState<{book: string, chapter: number, verse: number} | null>(null);
  const [rightRef, setRightRef] = useState<{book: string, chapter: number, verse: number} | null>(null);

  // Filter State
  const [minStrength, setMinStrength] = useState(5);
  const [selectedBook, setSelectedBook] = useState<string>('ALL');
  const [connectionType, setConnectionType] = useState<string>('ALL');

  useEffect(() => {
    async function init() {
      try {
        // Health check
        const healthRes = await fetch('/api/health');
        const healthData = await healthRes.json();
        console.log("API Health Check:", healthData);

        const [booksRes, chaptersRes, refsRes] = await Promise.all([
          fetch('/api/books'),
          fetch('/api/chapters'),
          fetch('/api/cross-references')
        ]);
        
        if (!booksRes.ok || !chaptersRes.ok || !refsRes.ok) {
          const booksText = await booksRes.text();
          const refsText = await refsRes.text();
          console.error("API Error Response:", { 
            booksStatus: booksRes.status, 
            booksText: booksText.substring(0, 100),
            chaptersStatus: chaptersRes.status,
            refsStatus: refsRes.status,
            refsText: refsText.substring(0, 100)
          });
          throw new Error(`API returned ${booksRes.status}/${chaptersRes.status}/${refsRes.status}`);
        }

        const booksData = await booksRes.json();
        const chaptersData = await chaptersRes.json();
        const refsData = await refsRes.json();
        
        setBooks(booksData);
        setChapters(chaptersData);
        setRefs(refsData);
      } catch (e) {
        console.error("Failed to load data:", e);
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  const handleSelectReference = async (sourceOrdinal: number, targetOrdinal: number) => {
    try {
      const [sourceRes, targetRes] = await Promise.all([
        fetch(`/api/verse-by-ordinal?ordinal=${sourceOrdinal}`),
        fetch(`/api/verse-by-ordinal?ordinal=${targetOrdinal}`)
      ]);
      
      if (sourceRes.ok && targetRes.ok) {
        const sourceData = await sourceRes.json();
        const targetData = await targetRes.json();
        
        setLeftRef({ book: sourceData.book_name, chapter: sourceData.chapter, verse: sourceData.verse });
        setRightRef({ book: targetData.book_name, chapter: targetData.chapter, verse: targetData.verse });
        setReaderOpen(true);
      }
    } catch (e) {
      console.error("Failed to fetch verses by ordinal:", e);
    }
  };

  const filteredRefs = useMemo(() => {
    const book = selectedBook !== 'ALL' ? books.find(b => b.name === selectedBook) : null;
    const start = book ? book.start_ordinal : 0;
    const end = book ? book.start_ordinal + book.verse_count : 0;

    return refs.filter(r => {
      if (r.strength < minStrength) return false;
      
      if (book) {
        const sourceInBook = r.source >= start && r.source < end;
        const targetInBook = r.target >= start && r.target < end;
        if (!sourceInBook && !targetInBook) return false;
      }
      
      if (connectionType !== 'ALL') {
        const sourceBook = books.find(b => r.source >= b.start_ordinal && r.source < b.start_ordinal + b.verse_count);
        const targetBook = books.find(b => r.target >= b.start_ordinal && r.target < b.start_ordinal + b.verse_count);
        
        if (sourceBook && targetBook) {
          const type = `${sourceBook.testament}-${targetBook.testament}`;
          const normalizedType = (type === 'NT-OT' || type === 'OT-NT') ? 'OT-NT' : type;
          if (connectionType !== normalizedType) return false;
        }
      }

      return true; 
    });
  }, [refs, minStrength, selectedBook, connectionType, books]);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-emerald-500/30">
      {/* Header */}
      <header className="h-16 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950/50 backdrop-blur fixed top-0 w-full z-40">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Book className="text-white" size={18} />
          </div>
          <h1 className="font-bold text-xl tracking-tight text-white">Biblical<span className="text-emerald-400 font-light">Arcs</span></h1>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
            <span className="text-xs font-medium text-slate-500 px-2">Type</span>
            <select 
              value={connectionType} 
              onChange={(e) => setConnectionType(e.target.value)}
              className="bg-slate-800 text-xs text-slate-200 rounded px-2 py-1 outline-none border-none cursor-pointer"
            >
              <option value="ALL">All Connections</option>
              <option value="OT-OT">OT ↔ OT</option>
              <option value="NT-NT">NT ↔ NT</option>
              <option value="OT-NT">OT ↔ NT</option>
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
            <span className="text-xs font-medium text-slate-500 px-2">Book</span>
            <select 
              value={selectedBook} 
              onChange={(e) => setSelectedBook(e.target.value)}
              className="bg-slate-800 text-xs text-slate-200 rounded px-2 py-1 outline-none border-none cursor-pointer"
            >
              <option value="ALL">All Books</option>
              {books.map(b => (
                <option key={b.id} value={b.name}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 bg-slate-900/50 p-1 rounded-lg border border-slate-800">
            <span className="text-xs font-medium text-slate-500 px-2">Min Strength</span>
            <input 
              type="range" 
              min="1" 
              max="5" 
              value={minStrength} 
              onChange={(e) => setMinStrength(parseInt(e.target.value))}
              className="w-24 accent-emerald-500 h-1 bg-slate-700 rounded-lg appearance-none cursor-pointer"
            />
            <span className="text-xs font-mono w-4 text-center">{minStrength}</span>
          </div>

          <div className="h-6 w-px bg-slate-800"></div>

          <div className="text-xs text-slate-500 font-mono">
            v1.0.0
          </div>
        </div>
      </header>

      {/* Main Visualization Area */}
      <main className="pt-24 pb-12 px-6 h-screen flex flex-col">
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex justify-between items-end mb-2">
            <div>
              <h2 className="text-2xl font-light text-white">Cross-Reference Network</h2>
              <p className="text-slate-500 text-sm mt-1">
                Visualizing {filteredRefs.length.toLocaleString()} connections 
                {minStrength > 1 && <span className="text-emerald-500 ml-1">(Strength &ge; {minStrength})</span>}
              </p>
            </div>
            
            <div className="flex gap-2 text-xs font-mono text-slate-500">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-500"></span> Old Testament
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-slate-400"></span> New Testament
              </div>
            </div>
          </div>

          {loading ? (
            <div className="flex-1 bg-slate-900/50 rounded-xl border border-slate-800 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                <p className="text-slate-400 animate-pulse">Loading dataset...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-[500px] flex flex-col">
              <ArcDiagram 
                books={books} 
                chapters={chapters}
                references={filteredRefs} 
                onSelectReference={handleSelectReference}
                selectedBook={selectedBook}
                className="flex-1"
              />
            </div>
          )}
        </div>
      </main>

      {/* Reader Modal */}
      {readerOpen && (
        <BibleReader 
          leftRef={leftRef} 
          rightRef={rightRef} 
          onClose={() => setReaderOpen(false)} 
        />
      )}
      <Analytics />
    </div>
  );
}
