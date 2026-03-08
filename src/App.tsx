import React, { useEffect, useState, useMemo } from 'react';
import ArcDiagram from './components/ArcDiagramCanvas';
import BibleReader from './components/BibleReader';
import SearchBar from './components/SearchBar';
import { Info, Book, Filter, Moon, Sun, Palette, Menu, X, Search } from 'lucide-react';
import { PALETTES, ColorPalette } from './constants';
import { PROPHECIES, Prophecy } from './data/prophecies';
import { parseBibleReference } from './utils/referenceParser';

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
  const [selectedChapter, setSelectedChapter] = useState<string>('ALL');
  const [connectionType, setConnectionType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Theme & Palette State
  const [theme, setTheme] = useState<'dark' | 'light'>('dark');
  const [activePaletteId, setActivePaletteId] = useState<string>('minimal');
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
    
    // Parse "Book Chapter:Verse" (e.g., "1 Kings 13:2", "Isaiah 7:14", "Song of Solomon 1:1")
    // Use a robust regex that captures everything before the last space-digit-colon-digit sequence
    const match = ref.match(/^(.+)\s(\d+):(\d+)$/);
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

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    const parsed = parseBibleReference(query, books);
    if (parsed) {
      setSelectedBook(parsed.book);
      setSelectedChapter(parsed.chapter ? parsed.chapter.toString() : 'ALL');
      // If verse is specified, we might want to highlight it, but for now we just filter to the chapter
      // and let the user see connections for that chapter.
    } else {
      // If not parsed, maybe reset or show error
      setSearchQuery('');
    }
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
    let start = book ? book.start_ordinal : 0;
    let end = book ? book.start_ordinal + book.verse_count : 0;

    if (book && selectedChapter !== 'ALL') {
      const chapterNum = parseInt(selectedChapter);
      const chapter = chapters.find(c => c.book_id === book.id && c.chapter === chapterNum);
      if (chapter) {
        start = chapter.start_ordinal;
        end = chapter.start_ordinal + chapter.verse_count;
        
        // If there's a specific verse in the search query, we could narrow it down further
        if (searchQuery) {
          const parsed = parseBibleReference(searchQuery, books);
          if (parsed && parsed.verse) {
             start = chapter.start_ordinal + parsed.verse - 1;
             end = start + 1;
          }
        }
      }
    }

    return baseRefs.filter(r => {
      // Book/Chapter/Verse Filter (Common to both)
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
  }, [refs, minStrength, selectedBook, selectedChapter, connectionType, books, chapters, searchQuery]);

  const isProphecyMode = connectionType === 'MESSIANIC' || connectionType === 'PROPHECY_ALL';

  return (
    <div className={`min-h-screen font-sans transition-colors duration-500 ${theme === 'light' ? 'bg-[#FDFBF7] text-slate-800 selection:bg-emerald-200' : 'bg-[#0A0A0A] text-slate-300 selection:bg-emerald-900'}`}>
      {/* Header */}
      <header className={`fixed top-0 w-full z-40 transition-all duration-500 ${theme === 'light' ? 'bg-[#FDFBF7]/80' : 'bg-[#0A0A0A]/80'} backdrop-blur-md`}>
        <div className="max-w-7xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-transform hover:scale-105 ${theme === 'light' ? 'bg-slate-900 text-white' : 'bg-white text-black'}`}>
              <Book size={20} strokeWidth={1.5} />
            </div>
            <div>
              <h1 className={`font-serif text-2xl tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
                Beautiful<span className="italic text-emerald-600">BibleData</span>
              </h1>
            </div>
          </div>
          
          <div className="flex items-center gap-6">
            {/* Desktop Controls */}
            <div className="hidden md:flex items-center gap-4">
              <div className="group relative">
                <select 
                  value={connectionType} 
                  onChange={(e) => setConnectionType(e.target.value)}
                  className={`appearance-none bg-transparent pl-2 pr-8 py-1 text-sm font-medium cursor-pointer outline-none transition-colors ${theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <optgroup label="Cross-References">
                    <option value="ALL">All Connections</option>
                    <option value="OT-OT">Old Testament Only</option>
                    <option value="NT-NT">New Testament Only</option>
                    <option value="OT-NT">OT ↔ NT Links</option>
                  </optgroup>
                  <optgroup label="Prophecies">
                    <option value="MESSIANIC">Messianic Prophecies</option>
                    <option value="PROPHECY_ALL">All Prophecies</option>
                  </optgroup>
                </select>
                <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
              </div>

              <div className="h-4 w-px bg-current opacity-10"></div>

              <div className="group relative">
                <select 
                  value={selectedBook} 
                  onChange={(e) => {
                    setSelectedBook(e.target.value);
                    setSelectedChapter('ALL');
                    setSearchQuery('');
                  }}
                  className={`appearance-none bg-transparent pl-2 pr-8 py-1 text-sm font-medium cursor-pointer outline-none transition-colors ${theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
                >
                  <option value="ALL">Entire Bible</option>
                  {books.map(b => (
                    <option key={b.id} value={b.name}>{b.name}</option>
                  ))}
                </select>
                <Book size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
              </div>

              {selectedBook !== 'ALL' && (
                <>
                  <div className="h-4 w-px bg-current opacity-10"></div>
                  <div className="group relative">
                    <select 
                      value={selectedChapter} 
                      onChange={(e) => {
                        setSelectedChapter(e.target.value);
                        setSearchQuery('');
                      }}
                      className={`appearance-none bg-transparent pl-2 pr-8 py-1 text-sm font-medium cursor-pointer outline-none transition-colors ${theme === 'light' ? 'text-slate-600 hover:text-slate-900' : 'text-slate-400 hover:text-slate-200'}`}
                    >
                      <option value="ALL">All Chapters</option>
                      {Array.from({ length: books.find(b => b.name === selectedBook)?.chapter_count || 0 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>Chapter {i + 1}</option>
                      ))}
                    </select>
                    <Book size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                  </div>
                </>
              )}

              <div className="h-4 w-px bg-current opacity-10"></div>

              <SearchBar onSearch={handleSearch} theme={theme} />

              <div className="h-4 w-px bg-current opacity-10"></div>

              {/* Desktop Palette Selector */}
              <div className="relative group">
                <button className={`p-2 rounded-full transition-all duration-300 ${theme === 'light' ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-800 text-slate-400'}`}>
                  <Palette size={20} strokeWidth={1.5} />
                </button>
                <div className={`absolute right-0 top-full mt-2 w-48 py-2 rounded-lg shadow-xl border hidden group-hover:block z-50 ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-slate-800'}`}>
                  {PALETTES.map(p => (
                    <button
                      key={p.id}
                      onClick={() => setActivePaletteId(p.id)}
                      className={`block w-full text-left px-4 py-2 text-sm flex items-center gap-2 ${theme === 'light' ? 'hover:bg-slate-50 text-slate-700' : 'hover:bg-slate-800 text-slate-300'} ${activePaletteId === p.id ? (theme === 'light' ? 'bg-slate-50 font-medium' : 'bg-slate-800 font-medium') : ''}`}
                    >
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.colors.gospels }}></div>
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>

              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={`p-2 rounded-full transition-all duration-300 ${theme === 'light' ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-800 text-slate-400'}`}
              >
                {theme === 'light' ? <Moon size={20} strokeWidth={1.5} /> : <Sun size={20} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Mobile Menu Toggle */}
            <button 
              className={`md:hidden p-2 rounded-full transition-colors ${theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'}`}
              onClick={() => setMobileMenuOpen(true)}
            >
              <Menu size={24} />
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)}></div>
          <div className={`absolute right-0 top-0 h-full w-80 shadow-2xl p-6 flex flex-col gap-6 transition-transform duration-300 overflow-y-auto ${theme === 'light' ? 'bg-white' : 'bg-slate-950'}`}>
            <div className="flex items-center justify-between">
              <h2 className={`text-lg font-serif font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>Settings</h2>
              <button onClick={() => setMobileMenuOpen(false)} className={`p-2 rounded-full ${theme === 'light' ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'}`}>
                  <X size={24} />
              </button>
            </div>
            
            <div className="space-y-6">
              {/* Connection Type */}
              <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Connection Type</label>
                  <div className="relative">
                    <select 
                        value={connectionType} 
                        onChange={(e) => setConnectionType(e.target.value)}
                        className={`w-full p-3 rounded-lg border appearance-none outline-none focus:ring-2 focus:ring-emerald-500/50 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-200'}`}
                    >
                        <optgroup label="Cross-References">
                          <option value="ALL">All Connections</option>
                          <option value="OT-OT">Old Testament Only</option>
                          <option value="NT-NT">New Testament Only</option>
                          <option value="OT-NT">OT ↔ NT Links</option>
                        </optgroup>
                        <optgroup label="Prophecies">
                          <option value="MESSIANIC">Messianic Prophecies</option>
                          <option value="PROPHECY_ALL">All Prophecies</option>
                        </optgroup>
                    </select>
                    <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                  </div>
              </div>

              {/* Book Selection */}
              <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Focus Book</label>
                  <div className="relative">
                    <select 
                        value={selectedBook} 
                        onChange={(e) => {
                          setSelectedBook(e.target.value);
                          setSelectedChapter('ALL');
                          setSearchQuery('');
                        }}
                        className={`w-full p-3 rounded-lg border appearance-none outline-none focus:ring-2 focus:ring-emerald-500/50 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-200'}`}
                    >
                        <option value="ALL">Entire Bible</option>
                        {books.map(b => (
                          <option key={b.id} value={b.name}>{b.name}</option>
                        ))}
                    </select>
                    <Book size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                  </div>
              </div>

              {/* Chapter Selection */}
              {selectedBook !== 'ALL' && (
                <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Chapter</label>
                    <div className="relative">
                      <select 
                          value={selectedChapter} 
                          onChange={(e) => {
                            setSelectedChapter(e.target.value);
                            setSearchQuery('');
                          }}
                          className={`w-full p-3 rounded-lg border appearance-none outline-none focus:ring-2 focus:ring-emerald-500/50 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-200'}`}
                      >
                          <option value="ALL">All Chapters</option>
                          {Array.from({ length: books.find(b => b.name === selectedBook)?.chapter_count || 0 }).map((_, i) => (
                            <option key={i + 1} value={i + 1}>Chapter {i + 1}</option>
                          ))}
                      </select>
                      <Book size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                    </div>
                </div>
              )}

              {/* Search */}
              <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Search Reference</label>
                  <div className="relative">
                    <form onSubmit={(e) => {
                      e.preventDefault();
                      const input = e.currentTarget.elements.namedItem('search') as HTMLInputElement;
                      if (input.value) {
                        handleSearch(input.value);
                        setMobileMenuOpen(false);
                      }
                    }}>
                      <input 
                        name="search"
                        type="text"
                        placeholder="e.g. Lucas 5:16"
                        className={`w-full p-3 pl-10 rounded-lg border outline-none focus:ring-2 focus:ring-emerald-500/50 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-200'}`}
                      />
                      <button type="submit" className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-emerald-500">
                        <Search size={16} />
                      </button>
                    </form>
                  </div>
              </div>

              {/* Palette Selection */}
              <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Color Palette</label>
                  <div className="grid grid-cols-1 gap-2">
                      {PALETTES.map(p => (
                          <button
                              key={p.id}
                              onClick={() => setActivePaletteId(p.id)}
                              className={`p-3 rounded-lg border transition-all flex items-center gap-3 ${activePaletteId === p.id ? 'ring-2 ring-emerald-500 border-transparent' : (theme === 'light' ? 'border-slate-200 hover:border-emerald-300 bg-slate-50' : 'border-slate-800 hover:border-emerald-700 bg-slate-900')}`}
                          >
                              <div className="flex gap-1">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.colors.pentateuch }}></div>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.colors.gospels }}></div>
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: p.colors.epistles }}></div>
                              </div>
                              <span className={`text-sm font-medium ${theme === 'light' ? 'text-slate-700' : 'text-slate-300'}`}>{p.name}</span>
                          </button>
                      ))}
                  </div>
              </div>

              {/* Classification Legend (Mobile) */}
              <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Classification</label>
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                    {[
                      { label: 'Pentateuch', color: activePalette.colors.pentateuch },
                      { label: 'Poetry', color: activePalette.colors.poetry },
                      { label: 'Prophets', color: activePalette.colors.prophets },
                      { label: 'Gospels', color: activePalette.colors.gospels },
                      { label: 'Epistles', color: activePalette.colors.epistles },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className={`text-[10px] font-medium ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
              </div>

              {/* Theme Toggle */}
              <div className={`pt-6 border-t ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
                  <button
                      onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                      className={`w-full flex items-center justify-center gap-2 p-3 rounded-lg transition-colors ${theme === 'light' ? 'bg-slate-100 text-slate-700 hover:bg-slate-200' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'}`}
                  >
                      {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
                      <span>{theme === 'light' ? 'Switch to Dark Mode' : 'Switch to Light Mode'}</span>
                  </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Visualization Area */}
      <main className="pt-24 pb-8 px-4 md:px-8 h-screen flex flex-col max-w-[1600px] mx-auto">
        <div className="flex-1 flex flex-col relative">
          
          
          <div className="absolute top-4 right-0 z-10 flex flex-col items-end pointer-events-none">
             <div className={`text-xs font-mono tracking-widest uppercase mb-1 ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`}>
                {filteredRefs.length.toLocaleString()} Arcs
             </div>
             {!isProphecyMode && minStrength > 1 && (
               <div className="text-[10px] text-emerald-500 font-medium">
                 Strength &ge; {minStrength}
               </div>
             )}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className={`font-serif italic text-lg ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>Weaving the threads...</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 w-full h-full min-h-[500px] relative group">
              <div className={`absolute inset-0 transition-opacity duration-1000 ${theme === 'light' ? 'bg-gradient-to-b from-transparent to-[#FDFBF7]/50' : 'bg-gradient-to-b from-transparent to-[#0A0A0A]/50'} pointer-events-none`}></div>
              <ArcDiagram 
                books={books} 
                chapters={chapters}
                references={filteredRefs} 
                onSelectReference={handleSelectReference}
                selectedBook={selectedBook}
                className="w-full h-full"
                palette={activePalette}
                theme={theme}
              />
              
              {/* Legend Overlay */}
              <div className="absolute bottom-6 left-6 hidden md:flex flex-col gap-2 z-10">
                <div className={`text-[10px] font-bold uppercase tracking-widest mb-1 ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`}>Classification</div>
                <div className="flex flex-wrap gap-4">
                  {[
                    { label: 'Pentateuch', color: activePalette.colors.pentateuch },
                    { label: 'Poetry', color: activePalette.colors.poetry },
                    { label: 'Prophets', color: activePalette.colors.prophets },
                    { label: 'Gospels', color: activePalette.colors.gospels },
                    { label: 'Epistles', color: activePalette.colors.epistles },
                  ].map(item => (
                    <div key={item.label} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                      <span className={`text-[10px] font-medium ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Minimal Reader Modal */}
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
