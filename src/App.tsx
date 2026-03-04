import React, { useEffect, useState, useMemo } from 'react';
import ArcDiagram from './components/ArcDiagramCanvas';
import BibleReader from './components/BibleReader';
import { Info, Book, Filter, Moon, Sun, Palette, Menu, X } from 'lucide-react';
import { PALETTES, ColorPalette } from './constants';
import { PROPHECIES, Prophecy } from './data/prophecies';

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
  description?: string; // Added for prophecies
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

  // Theme & Palette State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activePaletteId, setActivePaletteId] = useState<string>(PALETTES[0].id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activePalette = useMemo(() => {
    return PALETTES.find(p => p.id === activePaletteId) || PALETTES[0];
  }, [activePaletteId]);

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

  // Helper to convert "Book Chapter:Verse" to ordinal
  const getOrdinalFromRef = (ref: string): number | null => {
    if (!books.length || !chapters.length) return null;
    
    // Parse "Book Chapter:Verse" (e.g., "1 Kings 13:2" or "Isaiah 7:14")
    // Regex to handle books with numbers (1 Kings) vs standard (Isaiah)
    const match = ref.match(/^((?:\d\s)?[A-Za-z]+)\s(\d+):(\d+)$/);
    if (!match) return null;

    const [_, bookName, chapterStr, verseStr] = match;
    const chapterNum = parseInt(chapterStr);
    const verseNum = parseInt(verseStr);

    const book = books.find(b => b.name === bookName);
    if (!book) return null;

    const chapter = chapters.find(c => c.book_id === book.id && c.chapter === chapterNum);
    if (!chapter) return null;

    return chapter.start_ordinal + verseNum - 1; // 0-indexed ordinal, verses are 1-indexed
  };

  const filteredRefs = useMemo(() => {
    const isProphecyMode = connectionType === 'MESSIANIC' || connectionType === 'PROPHECY_ALL';
    
    // 1. Determine Base Dataset
    let baseRefs: CrossRef[] = [];

    if (isProphecyMode) {
      if (!books.length) return [];
      baseRefs = PROPHECIES
        .filter(p => connectionType === 'PROPHECY_ALL' || p.type === 'MESSIANIC')
        .map((p) => {
          const sourceOrdinal = getOrdinalFromRef(p.source);
          const targetOrdinal = getOrdinalFromRef(p.target);
          
          if (sourceOrdinal === null || targetOrdinal === null) return null;

          return {
            source: sourceOrdinal,
            target: targetOrdinal,
            strength: 5, // Max strength for prophecies
            description: p.description
          } as CrossRef;
        })
        .filter((r): r is CrossRef => r !== null);
    } else {
      baseRefs = refs;
    }

    // 2. Apply Filters
    const book = selectedBook !== 'ALL' ? books.find(b => b.name === selectedBook) : null;
    const start = book ? book.start_ordinal : 0;
    const end = book ? book.start_ordinal + book.verse_count : 0;

    return baseRefs.filter(r => {
      // Book Filter (Common to both)
      if (book) {
        const sourceInBook = r.source >= start && r.source < end;
        const targetInBook = r.target >= start && r.target < end;
        if (!sourceInBook && !targetInBook) return false;
      }

      // Standard Filters (Only apply to standard refs)
      if (!isProphecyMode) {
        // Strength
        if (r.strength < minStrength) return false;
        
        // Connection Type (OT-OT, etc.)
        if (connectionType !== 'ALL') {
          const sourceBook = books.find(b => r.source >= b.start_ordinal && r.source < b.start_ordinal + b.verse_count);
          const targetBook = books.find(b => r.target >= b.start_ordinal && r.target < b.start_ordinal + b.verse_count);
          
          if (sourceBook && targetBook) {
            const type = `${sourceBook.testament}-${targetBook.testament}`;
            const normalizedType = (type === 'NT-OT' || type === 'OT-NT') ? 'OT-NT' : type;
            if (connectionType !== normalizedType) return false;
          }
        }
      }

      return true; 
    });
  }, [refs, minStrength, selectedBook, connectionType, books, chapters]);

  const isProphecyMode = connectionType === 'MESSIANIC' || connectionType === 'PROPHECY_ALL';

  return (
    <div className={`min-h-screen font-sans transition-colors duration-300 ${theme === 'light' ? 'bg-slate-100 text-slate-800 selection:bg-emerald-500/20' : 'bg-slate-950 text-slate-200 selection:bg-emerald-500/30'}`}>
      {/* Header */}
      <header className={`border-b fixed top-0 w-full z-40 transition-colors duration-300 ${theme === 'light' ? 'bg-white/80 border-slate-200 backdrop-blur' : 'bg-slate-950/90 border-slate-800 backdrop-blur-md'}`}>
        <div className="flex flex-col md:flex-row md:items-center justify-between px-4 md:px-6 py-3 md:h-16">
          <div className="flex items-center justify-between w-full md:w-auto">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-emerald-500/20">
                <Book className="text-white" size={18} />
              </div>
              <h1 className={`font-bold text-xl tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Biblical<span className="text-emerald-500 font-light">Arcs</span></h1>
            </div>
            
            <div className="flex items-center gap-2 md:hidden">
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-slate-400'}`}
              >
                {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
              </button>
              <button 
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className={`p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-600' : 'bg-slate-900 text-slate-400'}`}
              >
                {mobileMenuOpen ? <X size={18} /> : <Menu size={18} />}
              </button>
            </div>
          </div>
          
          {/* Desktop Filters / Mobile Menu */}
          <div className={`${mobileMenuOpen ? 'flex' : 'hidden'} md:flex flex-col md:flex-row items-stretch md:items-center gap-4 mt-4 md:mt-0 pb-4 md:pb-0`}>
            
            {/* View / Connection Type Filter */}
            <div className={`flex items-center gap-2 p-1 rounded-lg border transition-colors ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>
              <Filter size={14} className={`ml-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`} />
              <select 
                value={connectionType} 
                onChange={(e) => setConnectionType(e.target.value)}
                className={`text-xs rounded px-2 py-1 outline-none border-none cursor-pointer w-full md:w-auto transition-colors ${theme === 'light' ? 'bg-white text-slate-700' : 'bg-slate-800 text-slate-200'}`}
              >
                <optgroup label="Cross-References">
                  <option value="ALL">All References</option>
                  <option value="OT-OT">Old Testament Only</option>
                  <option value="NT-NT">New Testament Only</option>
                  <option value="OT-NT">OT ↔ NT Connections</option>
                </optgroup>
                <optgroup label="Prophecies">
                  <option value="MESSIANIC">Messianic Prophecies</option>
                  <option value="PROPHECY_ALL">All Prophecies</option>
                </optgroup>
              </select>
            </div>

            <div className={`flex items-center gap-2 p-1 rounded-lg border transition-colors ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>
              <Palette size={14} className={`ml-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`} />
              <select 
                value={activePaletteId} 
                onChange={(e) => setActivePaletteId(e.target.value)}
                className={`text-xs rounded px-2 py-1 outline-none border-none cursor-pointer w-full md:w-auto transition-colors ${theme === 'light' ? 'bg-white text-slate-700' : 'bg-slate-800 text-slate-200'}`}
              >
                {PALETTES.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>

            <div className={`flex items-center gap-2 p-1 rounded-lg border transition-colors ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>
              <span className={`text-xs font-medium px-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Book</span>
              <select 
                value={selectedBook} 
                onChange={(e) => setSelectedBook(e.target.value)}
                className={`text-xs rounded px-2 py-1 outline-none border-none cursor-pointer w-full md:w-auto transition-colors ${theme === 'light' ? 'bg-white text-slate-700' : 'bg-slate-800 text-slate-200'}`}
              >
                <option value="ALL">All Books</option>
                {books.map(b => (
                  <option key={b.id} value={b.name}>{b.name}</option>
                ))}
              </select>
            </div>

            {!isProphecyMode && (
              <div className={`flex items-center gap-2 p-1 rounded-lg border transition-colors ${theme === 'light' ? 'bg-slate-100 border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>
                <span className={`text-xs font-medium px-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>Min Strength</span>
                <input 
                  type="range" 
                  min="1" 
                  max="5" 
                  value={minStrength} 
                  onChange={(e) => setMinStrength(parseInt(e.target.value))}
                  className={`w-24 accent-emerald-500 h-1 rounded-lg appearance-none cursor-pointer ${theme === 'light' ? 'bg-slate-300' : 'bg-slate-700'}`}
                />
                <span className="text-xs font-mono w-4 text-center">{minStrength}</span>
              </div>
            )}

            <div className={`hidden md:block h-6 w-px ${theme === 'light' ? 'bg-slate-300' : 'bg-slate-800'}`}></div>

            <button
              onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
              className={`hidden md:block p-2 rounded-lg transition-colors ${theme === 'light' ? 'bg-slate-100 hover:bg-slate-200 text-slate-600' : 'bg-slate-900 hover:bg-slate-800 text-slate-400'}`}
              title={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
            >
              {theme === 'light' ? <Moon size={16} /> : <Sun size={16} />}
            </button>
          </div>
        </div>
      </header>

      {/* Main Visualization Area */}
      <main className="pt-20 md:pt-24 pb-6 md:pb-12 px-4 md:px-6 h-[100dvh] flex flex-col">
        <div className="flex-1 flex flex-col gap-4">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-2 gap-2">
            <div>
              <h2 className={`text-xl md:text-2xl font-light ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                {connectionType === 'MESSIANIC' ? 'Messianic Prophecies' : 
                 connectionType === 'PROPHECY_ALL' ? 'Biblical Prophecies' : 
                 'Cross-Reference Network'}
              </h2>
              <p className={`text-xs md:text-sm mt-1 ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>
                Visualizing {filteredRefs.length.toLocaleString()} connections 
                {!isProphecyMode && minStrength > 1 && <span className="text-emerald-500 ml-1">(Strength &ge; {minStrength})</span>}
              </p>
            </div>
            
            <div className={`flex gap-2 text-xs font-mono ${theme === 'light' ? 'text-slate-500' : 'text-slate-500'}`}>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${theme === 'light' ? 'bg-slate-400' : 'bg-slate-500'}`}></span> OT
              </div>
              <div className="flex items-center gap-2">
                <span className={`w-3 h-3 rounded-full ${theme === 'light' ? 'bg-slate-300' : 'bg-slate-400'}`}></span> NT
              </div>
            </div>
          </div>

          {loading ? (
            <div className={`flex-1 rounded-xl border flex items-center justify-center ${theme === 'light' ? 'bg-slate-50 border-slate-200' : 'bg-slate-900/50 border-slate-800'}`}>
              <div className="flex flex-col items-center gap-4">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-emerald-500"></div>
                <p className={`animate-pulse ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Loading dataset...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-[400px] md:min-h-[500px] flex flex-col">
              <ArcDiagram 
                books={books} 
                chapters={chapters}
                references={filteredRefs} 
                onSelectReference={handleSelectReference}
                selectedBook={selectedBook}
                className="flex-1"
                palette={activePalette}
                theme={theme}
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
          theme={theme}
        />
      )}
    </div>
  );
}
