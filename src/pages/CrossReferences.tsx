import React, { useEffect, useState, useMemo } from 'react';
import { useOutletContext } from 'react-router-dom';
import ArcDiagram from '../components/ArcDiagramCanvas';
import BibleReader from '../components/BibleReader';
import SearchBar from '../components/SearchBar';
import { Info, Book, Filter, Moon, Sun, Palette, Menu, X, Search, Settings2 } from 'lucide-react';
import { PALETTES, ColorPalette } from '../constants';
import { PROPHECIES, Prophecy } from '../data/prophecies';
import { parseBibleReference, englishToSpanishBookMap } from '../utils/referenceParser';

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

export default function CrossReferences() {
  const { isSidebarOpen } = useOutletContext<any>();
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
  const [theme, setTheme] = useState<'dark' | 'light'>('light');
  const [language, setLanguage] = useState<'en' | 'es'>('en');
  const [activePaletteId, setActivePaletteId] = useState<string>('sunset');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const activePalette = useMemo(() => {
    return PALETTES.find(p => p.id === activePaletteId) || PALETTES[0];
  }, [activePaletteId]);

  useEffect(() => {
    async function init() {
      try {
        // Health check
        const healthRes = await fetch('/data/books.json'); // Just a dummy check now
        const healthData = await healthRes.json();
        console.log("Static Data Health Check:", !!healthData);

        const [booksRes, chaptersRes, refsRes] = await Promise.all([
          fetch('/data/books.json'),
          fetch('/data/chapters.json'),
          fetch('/data/cross-references.json')
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
      // Fetch the ordinal mapping first
      const mappingRes = await fetch('/data/ordinal-to-verse.json');
      const mapping = await mappingRes.json();

      const sourceInfo = mapping[sourceOrdinal];
      const targetInfo = mapping[targetOrdinal];

      if (sourceInfo && targetInfo) {
        setLeftRef({ book: sourceInfo.b, chapter: sourceInfo.c, verse: sourceInfo.v });
        setRightRef({ book: targetInfo.b, chapter: targetInfo.c, verse: targetInfo.v });
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
    // Use a robust regex that captures the first book, chapter, and verse, ignoring ranges or multiple references
    const match = ref.match(/^(.+?)\s(\d+):(\d+)/);
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

  // Helper to convert ordinal to "Book Chapter:Verse"
  const getRefFromOrdinal = (ordinal: number): string | null => {
    if (!books.length || !chapters.length) return null;
    
    // Find the book
    const book = books.find(b => ordinal >= b.start_ordinal && ordinal < b.start_ordinal + b.verse_count);
    if (!book) return null;

    // Find the chapter
    const chapter = chapters.find(c => c.book_id === book.id && ordinal >= c.start_ordinal && ordinal < c.start_ordinal + c.verse_count);
    if (!chapter) return null;

    const verseNum = ordinal - chapter.start_ordinal + 1;
    const bookName = language === 'es' ? (englishToSpanishBookMap[book.name] || book.name) : book.name;
    return `${bookName} ${chapter.chapter}:${verseNum}`;
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

  const selectOptionClass = theme === 'light' 
    ? '[&>option]:bg-white [&>option]:text-slate-900 [&>optgroup]:bg-white [&>optgroup]:text-slate-900' 
    : '[&>option]:bg-slate-900 [&>option]:text-slate-200 [&>optgroup]:bg-slate-900 [&>optgroup]:text-slate-200';

  return (
    <div className={`h-screen flex flex-col font-sans transition-colors duration-500 overflow-hidden ${theme === 'light' ? 'bg-[#FDFBF7] text-slate-800 selection:bg-emerald-200' : 'bg-[#0A0A0A] text-slate-300 selection:bg-emerald-900'}`}>
      {/* Header */}
      <header className={`shrink-0 z-40 transition-all duration-500 ${theme === 'light' ? 'bg-[#FDFBF7]/90' : 'bg-[#0A0A0A]/90'} backdrop-blur-md border-b ${theme === 'light' ? 'border-slate-200' : 'border-slate-800'}`}>
        <div className={`w-full py-3 sm:py-4 flex flex-row items-center justify-between gap-2 sm:gap-4 pr-3 sm:pr-6 ${isSidebarOpen ? 'pl-4 sm:pl-6' : 'pl-14 sm:pl-16'}`}>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <h1 className={`font-serif text-lg sm:text-xl tracking-tight truncate max-w-[150px] sm:max-w-none ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>
              {language === 'es' ? 'Referencias Cruzadas' : 'Cross References'}
            </h1>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-4 justify-end">
            {/* Desktop Controls */}
            <div className="hidden lg:flex items-center gap-3 flex-wrap justify-end">
              <div className="group relative">
                <select 
                  value={connectionType} 
                  onChange={(e) => setConnectionType(e.target.value)}
                  className={`appearance-none bg-transparent ${selectOptionClass} pl-2 pr-8 py-1.5 text-sm font-medium cursor-pointer outline-none transition-colors border rounded-lg ${theme === 'light' ? 'border-slate-200 text-slate-700 hover:border-slate-300' : 'border-slate-800 text-slate-300 hover:border-slate-700'}`}
                >
                  <optgroup label={language === 'es' ? 'Referencias Cruzadas' : 'Cross-References'}>
                    <option value="ALL">{language === 'es' ? 'Todas las Conexiones' : 'All Connections'}</option>
                    <option value="OT-OT">{language === 'es' ? 'Solo Antiguo Testamento' : 'Old Testament Only'}</option>
                    <option value="NT-NT">{language === 'es' ? 'Solo Nuevo Testamento' : 'New Testament Only'}</option>
                    <option value="OT-NT">{language === 'es' ? 'Enlaces AT ↔ NT' : 'OT ↔ NT Links'}</option>
                  </optgroup>
                  <optgroup label={language === 'es' ? 'Profecías' : 'Prophecies'}>
                    <option value="MESSIANIC">{language === 'es' ? 'Profecías Mesiánicas' : 'Messianic Prophecies'}</option>
                    <option value="PROPHECY_ALL">{language === 'es' ? 'Todas las Profecías' : 'All Prophecies'}</option>
                  </optgroup>
                </select>
                <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
              </div>

              {!isProphecyMode && (
                <div className="group relative flex items-center gap-2">
                  <span className={`text-xs font-medium uppercase tracking-wider ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{language === 'es' ? 'Fuerza:' : 'Strength:'}</span>
                  <select 
                    value={minStrength} 
                    onChange={(e) => setMinStrength(Number(e.target.value))}
                    className={`appearance-none bg-transparent ${selectOptionClass} pl-2 pr-6 py-1.5 text-sm font-medium cursor-pointer outline-none transition-colors border rounded-lg ${theme === 'light' ? 'border-slate-200 text-slate-700 hover:border-slate-300' : 'border-slate-800 text-slate-300 hover:border-slate-700'}`}
                  >
                    {[1, 2, 3, 4, 5, 10, 20, 50, 100].map(level => (
                      <option key={level} value={level}>{level}+</option>
                    ))}
                  </select>
                  <Filter size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                </div>
              )}

              <div className="group relative">
                <select 
                  value={selectedBook} 
                  onChange={(e) => {
                    setSelectedBook(e.target.value);
                    setSelectedChapter('ALL');
                    setSearchQuery('');
                  }}
                  className={`appearance-none bg-transparent ${selectOptionClass} pl-2 pr-8 py-1.5 text-sm font-medium cursor-pointer outline-none transition-colors border rounded-lg ${theme === 'light' ? 'border-slate-200 text-slate-700 hover:border-slate-300' : 'border-slate-800 text-slate-300 hover:border-slate-700'}`}
                >
                  <option value="ALL">{language === 'es' ? 'Toda la Biblia' : 'Entire Bible'}</option>
                  {books.map(b => (
                    <option key={b.id} value={b.name}>{language === 'es' ? (englishToSpanishBookMap[b.name] || b.name) : b.name}</option>
                  ))}
                </select>
                <Book size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
              </div>

              {selectedBook !== 'ALL' && (
                <>
                  <div className="group relative">
                    <select 
                      value={selectedChapter} 
                      onChange={(e) => {
                        setSelectedChapter(e.target.value);
                        setSearchQuery('');
                      }}
                      className={`appearance-none bg-transparent ${selectOptionClass} pl-2 pr-8 py-1.5 text-sm font-medium cursor-pointer outline-none transition-colors border rounded-lg ${theme === 'light' ? 'border-slate-200 text-slate-700 hover:border-slate-300' : 'border-slate-800 text-slate-300 hover:border-slate-700'}`}
                    >
                      <option value="ALL">{language === 'es' ? 'Todos los Capítulos' : 'All Chapters'}</option>
                      {Array.from({ length: books.find(b => b.name === selectedBook)?.chapter_count || 0 }).map((_, i) => (
                        <option key={i + 1} value={i + 1}>{language === 'es' ? 'Capítulo' : 'Chapter'} {i + 1}</option>
                      ))}
                    </select>
                    <Book size={12} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                  </div>
                  
                  {selectedChapter !== 'ALL' && (
                    <button 
                      onClick={() => {
                        setLeftRef({ book: selectedBook, chapter: parseInt(selectedChapter), verse: 1 });
                        setRightRef(null);
                        setReaderOpen(true);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${theme === 'light' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'}`}
                    >
                      {language === 'es' ? 'Leer' : 'Read'}
                    </button>
                  )}
                </>
              )}

              <SearchBar onSearch={handleSearch} theme={theme} />

              {/* Desktop Palette Selector */}
              <div className="relative group">
                <button className={`p-2 rounded-full transition-all duration-300 ${theme === 'light' ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-800 text-slate-400'}`} title="Color Palette">
                  <Palette size={20} strokeWidth={1.5} />
                </button>
                <div className="absolute right-0 top-full pt-2 hidden group-hover:block z-50">
                  <div className={`w-48 py-2 rounded-lg shadow-xl border ${theme === 'light' ? 'bg-white border-slate-100' : 'bg-slate-900 border-slate-800'}`}>
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
              </div>

              <button
                onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                className={`p-2 rounded-full transition-all duration-300 font-bold text-sm flex items-center justify-center w-9 h-9 ${theme === 'light' ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-800 text-slate-400'}`}
                title={language === 'en' ? 'Switch to Spanish' : 'Cambiar a Inglés'}
              >
                {language === 'en' ? 'EN' : 'ES'}
              </button>

              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={`p-2 rounded-full transition-all duration-300 ${theme === 'light' ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-800 text-slate-400'}`}
                title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              >
                {theme === 'light' ? <Moon size={20} strokeWidth={1.5} /> : <Sun size={20} strokeWidth={1.5} />}
              </button>
            </div>

            {/* Mobile Controls */}
            <div className="flex lg:hidden items-center gap-1 ml-auto">
              <button
                onClick={() => setLanguage(language === 'en' ? 'es' : 'en')}
                className={`p-2 rounded-full transition-all duration-300 font-bold text-xs flex items-center justify-center w-8 h-8 ${theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'}`}
                title={language === 'en' ? 'Switch to Spanish' : 'Cambiar a Inglés'}
              >
                {language === 'en' ? 'EN' : 'ES'}
              </button>
              <button
                onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                className={`p-2 rounded-full transition-all duration-300 ${theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'}`}
                title={theme === 'light' ? 'Dark Mode' : 'Light Mode'}
              >
                {theme === 'light' ? <Moon size={20} strokeWidth={1.5} /> : <Sun size={20} strokeWidth={1.5} />}
              </button>
              <button 
                className={`p-2 rounded-full transition-colors ${theme === 'light' ? 'text-slate-600 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'}`}
                onClick={() => setMobileMenuOpen(true)}
              >
                <Settings2 size={20} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Mobile Menu Overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 lg:hidden flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={() => setMobileMenuOpen(false)}></div>
          <div className={`relative w-full max-h-[85vh] rounded-t-3xl shadow-2xl flex flex-col transition-transform duration-300 overflow-hidden ${theme === 'light' ? 'bg-white' : 'bg-slate-950'}`}>
            <div className="p-4 border-b flex items-center justify-between shrink-0" style={{ borderColor: theme === 'light' ? '#e2e8f0' : '#1e293b' }}>
              <h2 className={`text-lg font-serif font-bold ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{language === 'es' ? 'Ajustes' : 'Settings'}</h2>
              <button onClick={() => setMobileMenuOpen(false)} className={`p-2 rounded-full ${theme === 'light' ? 'text-slate-500 hover:bg-slate-100' : 'text-slate-400 hover:bg-slate-800'}`}>
                  <X size={24} />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-6">
              {/* Connection Type */}
              <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Connection Type</label>
                  <div className="relative">
                    <select 
                        value={connectionType} 
                        onChange={(e) => setConnectionType(e.target.value)}
                        className={`w-full p-3 rounded-lg border appearance-none ${selectOptionClass} outline-none focus:ring-2 focus:ring-emerald-500/50 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-200'}`}
                    >
                        <optgroup label={language === 'es' ? 'Referencias Cruzadas' : 'Cross-References'}>
                          <option value="ALL">{language === 'es' ? 'Todas las Conexiones' : 'All Connections'}</option>
                          <option value="OT-OT">{language === 'es' ? 'Solo Antiguo Testamento' : 'Old Testament Only'}</option>
                          <option value="NT-NT">{language === 'es' ? 'Solo Nuevo Testamento' : 'New Testament Only'}</option>
                          <option value="OT-NT">{language === 'es' ? 'Enlaces AT ↔ NT' : 'OT ↔ NT Links'}</option>
                        </optgroup>
                        <optgroup label={language === 'es' ? 'Profecías' : 'Prophecies'}>
                          <option value="MESSIANIC">{language === 'es' ? 'Profecías Mesiánicas' : 'Messianic Prophecies'}</option>
                          <option value="PROPHECY_ALL">{language === 'es' ? 'Todas las Profecías' : 'All Prophecies'}</option>
                        </optgroup>
                    </select>
                    <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                  </div>
              </div>

              {/* Connection Strength */}
              {!isProphecyMode && (
                <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{language === 'es' ? 'Fuerza Mínima' : 'Minimum Strength'}</label>
                    <div className="relative">
                      <select 
                          value={minStrength} 
                          onChange={(e) => setMinStrength(Number(e.target.value))}
                          className={`w-full p-3 rounded-lg border appearance-none ${selectOptionClass} outline-none focus:ring-2 focus:ring-emerald-500/50 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-200'}`}
                      >
                          {[1, 2, 3, 4, 5, 10, 20, 50, 100].map(level => (
                            <option key={level} value={level}>{language === 'es' ? 'Nivel' : 'Level'} {level}+</option>
                          ))}
                      </select>
                      <Filter size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                    </div>
                </div>
              )}

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
                        className={`w-full p-3 rounded-lg border appearance-none ${selectOptionClass} outline-none focus:ring-2 focus:ring-emerald-500/50 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-200'}`}
                    >
                        <option value="ALL">{language === 'es' ? 'Toda la Biblia' : 'Entire Bible'}</option>
                        {books.map(b => (
                          <option key={b.id} value={b.name}>{language === 'es' ? (englishToSpanishBookMap[b.name] || b.name) : b.name}</option>
                        ))}
                    </select>
                    <Book size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                  </div>
              </div>

              {/* Chapter Selection */}
              {selectedBook !== 'ALL' && (
                <div>
                    <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>Chapter</label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <select 
                            value={selectedChapter} 
                            onChange={(e) => {
                              setSelectedChapter(e.target.value);
                              setSearchQuery('');
                            }}
                            className={`w-full p-3 rounded-lg border appearance-none ${selectOptionClass} outline-none focus:ring-2 focus:ring-emerald-500/50 ${theme === 'light' ? 'bg-slate-50 border-slate-200 text-slate-700' : 'bg-slate-900 border-slate-800 text-slate-200'}`}
                        >
                            <option value="ALL">{language === 'es' ? 'Todos los Capítulos' : 'All Chapters'}</option>
                            {Array.from({ length: books.find(b => b.name === selectedBook)?.chapter_count || 0 }).map((_, i) => (
                              <option key={i + 1} value={i + 1}>{language === 'es' ? 'Capítulo' : 'Chapter'} {i + 1}</option>
                            ))}
                        </select>
                        <Book size={16} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none opacity-50" />
                      </div>
                      
                      {selectedChapter !== 'ALL' && (
                        <button 
                          onClick={() => {
                            setLeftRef({ book: selectedBook, chapter: parseInt(selectedChapter), verse: 1 });
                            setRightRef(null);
                            setReaderOpen(true);
                            setMobileMenuOpen(false);
                          }}
                          className={`px-4 rounded-lg font-medium transition-colors ${theme === 'light' ? 'bg-emerald-100 text-emerald-800 hover:bg-emerald-200' : 'bg-emerald-900/30 text-emerald-400 hover:bg-emerald-900/50'}`}
                        >
                          {language === 'es' ? 'Leer' : 'Read'}
                        </button>
                      )}
                    </div>
                </div>
              )}

              {/* Search */}
              <div>
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{language === 'es' ? 'Buscar Referencia' : 'Search Reference'}</label>
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
                  <label className={`block text-xs font-bold uppercase tracking-wider mb-2 ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{language === 'es' ? 'Paleta de colores' : 'Color Palette'}</label>
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
                  <div className="grid grid-cols-2 gap-3 p-4 rounded-lg border bg-slate-50/50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-800">
                    {[
                      { label: language === 'es' ? 'Pentateuco' : 'Pentateuch', color: activePalette.colors.pentateuch },
                      { label: language === 'es' ? 'Poesía' : 'Poetry', color: activePalette.colors.poetry },
                      { label: language === 'es' ? 'Profetas' : 'Prophets', color: activePalette.colors.prophets },
                      { label: language === 'es' ? 'Evangelios' : 'Gospels', color: activePalette.colors.gospels },
                      { label: language === 'es' ? 'Epístolas' : 'Epistles', color: activePalette.colors.epistles },
                    ].map(item => (
                      <div key={item.label} className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                        <span className={`text-[10px] font-medium ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</span>
                      </div>
                    ))}
                  </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* Main Visualization Area */}
      <main className="flex-1 w-full pt-4 pb-8 px-4 md:px-8 flex flex-col max-w-[1600px] mx-auto overflow-hidden">
        <div className="flex-1 flex flex-col relative">
          
          
          <div className="absolute top-4 right-0 z-10 flex flex-col items-end pointer-events-none">
             <div className={`text-xs font-mono tracking-widest uppercase mb-1 ${theme === 'light' ? 'text-slate-400' : 'text-slate-600'}`}>
                {filteredRefs.length.toLocaleString()} {language === 'es' ? 'Arcos' : 'Arcs'}
             </div>
             {!isProphecyMode && minStrength > 1 && (
               <div className="text-[10px] text-emerald-500 font-medium">
                 {language === 'es' ? 'Fuerza' : 'Strength'} &ge; {minStrength}
               </div>
             )}
          </div>

          {loading ? (
            <div className="flex-1 flex items-center justify-center">
              <div className="flex flex-col items-center gap-6">
                <div className="w-16 h-16 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin"></div>
                <p className={`font-serif italic text-lg ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>{language === 'es' ? 'Tejiendo los hilos...' : 'Weaving the threads...'}</p>
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
            </div>
          )}
          
          {/* Legend Footer */}
          {!loading && (
            <div className={`mt-4 flex flex-col md:flex-row items-center justify-between gap-4 px-2`}>
              <div className="flex flex-wrap justify-center md:justify-start gap-4">
                {[
                  { label: language === 'es' ? 'Pentateuco' : 'Pentateuch', color: activePalette.colors.pentateuch },
                  { label: language === 'es' ? 'Poesía' : 'Poetry', color: activePalette.colors.poetry },
                  { label: language === 'es' ? 'Profetas' : 'Prophets', color: activePalette.colors.prophets },
                  { label: language === 'es' ? 'Evangelios' : 'Gospels', color: activePalette.colors.gospels },
                  { label: language === 'es' ? 'Epístolas' : 'Epistles', color: activePalette.colors.epistles },
                ].map(item => (
                  <div key={item.label} className="flex items-center gap-2">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></div>
                    <span className={`text-[10px] md:text-xs font-medium ${theme === 'light' ? 'text-slate-500' : 'text-slate-400'}`}>{item.label}</span>
                  </div>
                ))}
              </div>
              <div className={`text-[10px] md:text-xs font-medium ${theme === 'light' ? 'text-slate-400' : 'text-slate-500'}`}>
                {language === 'es' ? 'Desplazar/Pellizcar para Zoom • Arrastrar para Mover' : 'Scroll/Pinch to Zoom • Drag to Pan'}
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
          books={books}
          chapters={chapters}
          refs={refs}
          setLeftRef={setLeftRef}
          setRightRef={setRightRef}
          getRefFromOrdinal={getRefFromOrdinal}
          language={language}
          setLanguage={setLanguage}
        />
      )}
    </div>
  );
}
