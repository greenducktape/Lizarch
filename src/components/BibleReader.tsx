import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, X, Settings2 } from 'lucide-react';
import { englishToSpanishBookMap } from '../utils/referenceParser';

interface Verse {
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
  text_es?: string;
  global_ordinal: number;
}

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
  description?: string;
}

interface BibleReaderProps {
  leftRef: { book: string, chapter: number, verse: number } | null;
  rightRef: { book: string, chapter: number, verse: number } | null;
  onClose: () => void;
  theme: 'dark' | 'light';
  books: BookData[];
  chapters: ChapterData[];
  refs: CrossRef[];
  setLeftRef: (ref: { book: string, chapter: number, verse: number } | null) => void;
  setRightRef: (ref: { book: string, chapter: number, verse: number } | null) => void;
  getRefFromOrdinal: (ordinal: number) => string | null;
  language: 'en' | 'es';
  setLanguage: (lang: 'en' | 'es') => void;
}

const themeClasses = {
  dark: 'bg-[#121212] text-[#E0E0E0] border-[#2A2A2A]',
  cream: 'bg-[#FDFBF7] text-[#2C2C2C] border-[#EAE5D9]',
  white: 'bg-white text-[#1A1A1A] border-gray-200'
};

const headerClasses = {
  dark: 'bg-[#121212]/95 border-[#2A2A2A]',
  cream: 'bg-[#FDFBF7]/95 border-[#EAE5D9]',
  white: 'bg-white/95 border-gray-200'
};

const highlightClasses = {
  dark: 'bg-[#2A2A2A] shadow-sm ring-1 ring-[#3A3A3A]',
  cream: 'bg-[#F4EFE6] shadow-sm ring-1 ring-[#EAE5D9]',
  white: 'bg-gray-100 shadow-sm ring-1 ring-gray-200'
};

const fontClasses = {
  serif: 'font-serif',
  sans: 'font-sans'
};

const sizeClasses = {
  small: 'text-base',
  medium: 'text-lg md:text-xl',
  large: 'text-xl md:text-2xl'
};

const getStrengthColor = (strength: number) => {
  if (strength >= 10) return 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.6)]';
  if (strength >= 8) return 'bg-orange-500 shadow-[0_0_8px_rgba(249,115,22,0.6)]';
  if (strength >= 6) return 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.6)]';
  if (strength >= 4) return 'bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]';
  if (strength >= 2) return 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]';
  return 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]';
};

interface ReaderPanelProps {
  verses: Verse[];
  highlightVerse?: number;
  title: string;
  side: 'left' | 'right';
  currentRef: { book: string, chapter: number, verse: number };
  isLoading: boolean;
  readerTheme: 'dark' | 'cream' | 'white';
  fontFamily: 'serif' | 'sans';
  fontSize: 'small' | 'medium' | 'large';
  refs: CrossRef[];
  books: BookData[];
  handleNavigate: (side: 'left' | 'right', direction: 'prev' | 'next') => void;
  handleJump: (side: 'left' | 'right', book: string, chapter: number) => void;
  handleClose: (side: 'left' | 'right') => void;
  handleDotClick: (targetOrdinal: number, sourceVerse: number, side: 'left' | 'right') => void;
  getRefFromOrdinal: (ordinal: number) => string | null;
  language: 'en' | 'es';
}

const ReaderPanel = ({ 
  verses, highlightVerse, title, side, currentRef, isLoading,
  readerTheme, fontFamily, fontSize, refs, books, handleNavigate, handleJump, handleClose, handleDotClick, getRefFromOrdinal, language
}: ReaderPanelProps) => {
  const safeTitle = title.replace(/\s+/g, '-');

  useEffect(() => {
    // Small delay to ensure the DOM is updated and the verse is rendered
    if (highlightVerse && verses.length > 0 && !isLoading) {
      const timer = setTimeout(() => {
        const el = document.getElementById(`verse-${side}-${safeTitle}-${highlightVerse}`);
        if (el) {
          // Use 'auto' (instant) instead of 'smooth' to avoid confusing long scrolls
          el.scrollIntoView({ behavior: 'auto', block: 'center' });
        }
      }, 50);
      return () => clearTimeout(timer);
    }
  }, [verses, highlightVerse, safeTitle, side, isLoading]);

  const selectOptionClass = readerTheme === 'dark' 
    ? '[&>option]:bg-slate-900 [&>option]:text-slate-200' 
    : '[&>option]:bg-white [&>option]:text-slate-900';

  return (
    <div className={`flex-1 flex flex-col h-full overflow-hidden border-r last:border-0 ${themeClasses[readerTheme]} relative`}>
      <div className={`p-3 sm:p-4 md:p-6 border-b flex justify-between items-center sticky top-0 z-20 backdrop-blur-sm flex-nowrap gap-2 sm:gap-4 ${headerClasses[readerTheme]}`}>
        <div className="flex items-center gap-1 sm:gap-2 min-w-0">
          <select 
            value={currentRef.book}
            onChange={(e) => handleJump(side, e.target.value, 1)}
            className={`appearance-none bg-transparent ${selectOptionClass} font-serif text-lg sm:text-xl tracking-tight font-medium cursor-pointer outline-none hover:opacity-80 transition-opacity max-w-[100px] sm:max-w-[180px] md:max-w-none truncate`}
          >
            {books.map(b => (
              <option key={b.id} value={b.name} className="text-base font-sans">{language === 'es' ? (englishToSpanishBookMap[b.name] || b.name) : b.name}</option>
            ))}
          </select>
          <select
            value={currentRef.chapter}
            onChange={(e) => handleJump(side, currentRef.book, Number(e.target.value))}
            className={`appearance-none bg-transparent ${selectOptionClass} font-serif text-lg sm:text-xl tracking-tight font-medium cursor-pointer outline-none hover:opacity-80 transition-opacity`}
          >
            {Array.from({ length: books.find(b => b.name === currentRef.book)?.chapter_count || 0 }).map((_, i) => (
              <option key={i + 1} value={i + 1} className="text-base font-sans">{i + 1}</option>
            ))}
          </select>
        </div>
        <div className="flex gap-2 items-center">
            <button onClick={() => handleNavigate(side, 'prev')} className={`p-1.5 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10`}><ChevronLeft size={18} /></button>
            <button onClick={() => handleNavigate(side, 'next')} className={`p-1.5 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10`}><ChevronRight size={18} /></button>
            <button onClick={() => handleClose(side)} className={`ml-2 p-1.5 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10`}>
              <X size={18} />
            </button>
        </div>
      </div>
      
      {isLoading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-inherit/50 backdrop-blur-sm mt-16">
           <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
        </div>
      )}

      <div className={`flex-1 overflow-y-auto p-6 md:p-10 space-y-8 transition-opacity duration-300 ${isLoading ? 'opacity-30' : 'opacity-100'}`}>
        {verses.map((v) => {
          const ordinal = v.global_ordinal;
          const crossRefs = ordinal !== undefined ? refs.filter(r => r.source === ordinal || r.target === ordinal) : [];
          const hasRefs = crossRefs.length > 0;
          
          return (
            <div 
              key={v.verse} 
              id={`verse-${side}-${safeTitle}-${v.verse}`}
              className={`relative leading-relaxed transition-all duration-500 p-5 rounded-xl ${
                v.verse === highlightVerse ? highlightClasses[readerTheme] : ''
              }`}
            >
              <div className="flex items-start">
                <span className={`text-xs font-mono tracking-widest mt-1.5 mr-4 select-none opacity-40`}>{v.verse}</span>
                <div className="flex-1">
                  <span className={`${fontClasses[fontFamily]} ${sizeClasses[fontSize]}`}>
                    {language === 'es' && v.text_es ? v.text_es : v.text}
                  </span>
                  
                  {hasRefs && (
                    <div className="mt-4 flex flex-wrap gap-2 items-center">
                      {crossRefs.sort((a, b) => b.strength - a.strength).map((ref, idx) => {
                        const targetOrdinal = ref.source === ordinal ? ref.target : ref.source;
                        const targetRefStr = getRefFromOrdinal(targetOrdinal);
                        return (
                          <button 
                            key={idx}
                            onClick={() => handleDotClick(targetOrdinal, v.verse, side)}
                            className={`w-3 h-3 rounded-full transition-transform hover:scale-150 cursor-pointer ${getStrengthColor(ref.strength)}`}
                            title={ref.description ? `${ref.description} (${language === 'es' ? 'Fuerza' : 'Strength'}: ${ref.strength})` : `${targetRefStr || (language === 'es' ? 'Referencia cruzada' : 'Cross-reference')} (${language === 'es' ? 'Fuerza' : 'Strength'}: ${ref.strength})`}
                          />
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default function BibleReader({ 
  leftRef, rightRef, onClose, theme: appTheme, books, chapters, refs, setLeftRef, setRightRef, getRefFromOrdinal, language, setLanguage
}: BibleReaderProps) {
  const [leftVerses, setLeftVerses] = useState<Verse[]>([]);
  const [rightVerses, setRightVerses] = useState<Verse[]>([]);
  const [leftLoading, setLeftLoading] = useState(false);
  const [rightLoading, setRightLoading] = useState(false);

  // Reader Settings
  const [readerTheme, setReaderTheme] = useState<'dark' | 'cream' | 'white'>(() => {
    const saved = localStorage.getItem('readerTheme');
    return (saved as any) || (appTheme === 'light' ? 'cream' : 'dark');
  });
  const [fontSize, setFontSize] = useState<'small' | 'medium' | 'large'>(() => {
    const saved = localStorage.getItem('readerFontSize');
    return (saved as any) || 'medium';
  });
  const [fontFamily, setFontFamily] = useState<'serif' | 'sans'>(() => {
    const saved = localStorage.getItem('readerFontFamily');
    return (saved as any) || 'serif';
  });
  const [showSettings, setShowSettings] = useState(false);

  useEffect(() => {
    localStorage.setItem('readerTheme', readerTheme);
  }, [readerTheme]);

  useEffect(() => {
    localStorage.setItem('readerFontSize', fontSize);
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem('readerFontFamily', fontFamily);
  }, [fontFamily]);

  // Fetch Left Chapter
  useEffect(() => {
    if (!leftRef) return;
    let isMounted = true;
    async function fetchLeft() {
      setLeftLoading(true);
      try {
        const res = await fetch(`/data/chapter/${leftRef!.book}/${leftRef!.chapter}.json`);
        const data = await res.json();
        if (isMounted) setLeftVerses(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setLeftLoading(false);
      }
    }
    fetchLeft();
    return () => { isMounted = false; };
  }, [leftRef?.book, leftRef?.chapter]);

  // Fetch Right Chapter
  useEffect(() => {
    if (!rightRef) return;
    let isMounted = true;
    async function fetchRight() {
      setRightLoading(true);
      try {
        const res = await fetch(`/data/chapter/${rightRef!.book}/${rightRef!.chapter}.json`);
        const data = await res.json();
        if (isMounted) setRightVerses(data);
      } catch (e) {
        console.error(e);
      } finally {
        if (isMounted) setRightLoading(false);
      }
    }
    fetchRight();
    return () => { isMounted = false; };
  }, [rightRef?.book, rightRef?.chapter]);

  const handleNavigate = (side: 'left' | 'right', direction: 'prev' | 'next') => {
    const currentRef = side === 'left' ? leftRef : rightRef;
    if (!currentRef) return;

    const book = books.find(b => b.name === currentRef.book);
    if (!book) return;

    let newChapter = currentRef.chapter + (direction === 'next' ? 1 : -1);
    let newBookName = currentRef.book;

    if (newChapter > book.chapter_count) {
      const nextBook = books.find(b => b.id === book.id + 1);
      if (nextBook) {
        newBookName = nextBook.name;
        newChapter = 1;
      } else {
        return; // End of Bible
      }
    } else if (newChapter < 1) {
      const prevBook = books.find(b => b.id === book.id - 1);
      if (prevBook) {
        newBookName = prevBook.name;
        newChapter = prevBook.chapter_count;
      } else {
        return; // Beginning of Bible
      }
    }

    const newRef = { book: newBookName, chapter: newChapter, verse: 1 };
    if (side === 'left') setLeftRef(newRef);
    else setRightRef(newRef);
  };

  const handleJump = (side: 'left' | 'right', book: string, chapter: number) => {
    const newRef = { book, chapter, verse: 1 };
    if (side === 'left') setLeftRef(newRef);
    else setRightRef(newRef);
  };

  const handleDotClick = async (targetOrdinal: number, sourceVerse: number, side: 'left' | 'right') => {
    try {
      const mappingRes = await fetch('/data/ordinal-to-verse.json');
      const mapping = await mappingRes.json();
      const data = mapping[targetOrdinal];
      
      if (data) {
        const newRef = { book: data.b, chapter: data.c, verse: data.v };
        if (side === 'left') {
          setRightRef(newRef);
          setLeftRef(leftRef ? { ...leftRef, verse: sourceVerse } : null);
        } else {
          setLeftRef(newRef);
          setRightRef(rightRef ? { ...rightRef, verse: sourceVerse } : null);
        }
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleClosePanel = (side: 'left' | 'right') => {
    if (side === 'left') setLeftRef(null);
    else setRightRef(null);
  };

  if (!leftRef && !rightRef) {
    // If both are closed, close the modal
    setTimeout(onClose, 0);
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 md:p-6 bg-black/70 backdrop-blur-md transition-opacity duration-500">
      <div className={`w-full max-w-[1400px] h-[95vh] md:h-[90vh] rounded-2xl md:rounded-3xl shadow-2xl flex flex-col overflow-hidden border ${themeClasses[readerTheme]}`}>
        {/* Header */}
        <div className={`h-16 border-b flex items-center justify-between px-4 md:px-6 ${headerClasses[readerTheme]}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center bg-black/5 dark:bg-white/10`}>
                <BookOpen size={14} strokeWidth={1.5} />
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Settings Toggle */}
            <div className="relative">
              <button 
                onClick={() => setShowSettings(!showSettings)}
                className={`p-2 rounded-full transition-colors hover:bg-black/5 dark:hover:bg-white/10`}
                title="Reader Settings"
              >
                <Settings2 size={18} />
              </button>

              {showSettings && (
                <div className={`absolute right-0 top-full mt-2 w-64 p-4 rounded-xl shadow-xl border z-50 ${themeClasses[readerTheme]}`}>
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-60">{language === 'es' ? 'Tema' : 'Theme'}</label>
                      <div className="flex gap-2">
                        <button onClick={() => setReaderTheme('white')} className={`flex-1 py-1.5 rounded border ${readerTheme === 'white' ? 'ring-2 ring-emerald-500' : ''} bg-white text-black text-sm`}>{language === 'es' ? 'Blanco' : 'White'}</button>
                        <button onClick={() => setReaderTheme('cream')} className={`flex-1 py-1.5 rounded border ${readerTheme === 'cream' ? 'ring-2 ring-emerald-500' : ''} bg-[#FDFBF7] text-black text-sm`}>{language === 'es' ? 'Crema' : 'Cream'}</button>
                        <button onClick={() => setReaderTheme('dark')} className={`flex-1 py-1.5 rounded border ${readerTheme === 'dark' ? 'ring-2 ring-emerald-500' : ''} bg-[#121212] text-white text-sm`}>{language === 'es' ? 'Oscuro' : 'Dark'}</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-60">{language === 'es' ? 'Tamaño de fuente' : 'Font Size'}</label>
                      <div className="flex gap-2">
                        <button onClick={() => setFontSize('small')} className={`flex-1 py-1.5 rounded border ${fontSize === 'small' ? 'bg-black/10 dark:bg-white/20' : 'border-black/10 dark:border-white/10'} text-sm`}>A</button>
                        <button onClick={() => setFontSize('medium')} className={`flex-1 py-1.5 rounded border ${fontSize === 'medium' ? 'bg-black/10 dark:bg-white/20' : 'border-black/10 dark:border-white/10'} text-base`}>A</button>
                        <button onClick={() => setFontSize('large')} className={`flex-1 py-1.5 rounded border ${fontSize === 'large' ? 'bg-black/10 dark:bg-white/20' : 'border-black/10 dark:border-white/10'} text-lg`}>A</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-60">{language === 'es' ? 'Tipo de fuente' : 'Font Family'}</label>
                      <div className="flex gap-2">
                        <button onClick={() => setFontFamily('serif')} className={`flex-1 py-1.5 rounded border font-serif ${fontFamily === 'serif' ? 'bg-black/10 dark:bg-white/20' : 'border-black/10 dark:border-white/10'} text-sm`}>Serif</button>
                        <button onClick={() => setFontFamily('sans')} className={`flex-1 py-1.5 rounded border font-sans ${fontFamily === 'sans' ? 'bg-black/10 dark:bg-white/20' : 'border-black/10 dark:border-white/10'} text-sm`}>Sans</button>
                      </div>
                    </div>
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wider mb-2 opacity-60">{language === 'es' ? 'Idioma' : 'Language'}</label>
                      <div className="flex flex-col gap-2">
                        <button onClick={() => setLanguage('en')} className={`w-full py-1.5 rounded border ${language === 'en' ? 'bg-black/10 dark:bg-white/20' : 'border-black/10 dark:border-white/10'} text-sm`}>English: KJV</button>
                        <button onClick={() => setLanguage('es')} className={`w-full py-1.5 rounded border ${language === 'es' ? 'bg-black/10 dark:bg-white/20' : 'border-black/10 dark:border-white/10'} text-sm`}>Español: Reina Valera 1909</button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <button 
              onClick={onClose}
              className={`px-4 py-1.5 text-xs uppercase tracking-widest font-medium rounded-full transition-all duration-300 hover:bg-black/5 dark:hover:bg-white/10`}
            >
              {language === 'es' ? 'Cerrar' : 'Close'}
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-row overflow-x-auto md:overflow-hidden snap-x snap-mandatory relative hide-scrollbar">
            {leftRef && (
                <div className={`w-full shrink-0 snap-center h-full ${rightRef ? 'md:w-1/2' : 'md:w-full'}`}>
                  <ReaderPanel 
                      verses={leftVerses} 
                      highlightVerse={leftRef.verse} 
                      title={language === 'es' ? `${englishToSpanishBookMap[leftRef.book] || leftRef.book} ${leftRef.chapter}` : `${leftRef.book} ${leftRef.chapter}`} 
                      side="left"
                      currentRef={leftRef}
                      isLoading={leftLoading}
                      readerTheme={readerTheme}
                      fontFamily={fontFamily}
                      fontSize={fontSize}
                      refs={refs}
                      books={books}
                      handleNavigate={handleNavigate}
                      handleJump={handleJump}
                      handleClose={handleClosePanel}
                      handleDotClick={handleDotClick}
                      getRefFromOrdinal={getRefFromOrdinal}
                      language={language}
                  />
                </div>
            )}
            
            {rightRef && (
                <div className={`w-full shrink-0 snap-center h-full ${leftRef ? 'md:w-1/2' : 'md:w-full'}`}>
                  <ReaderPanel 
                      verses={rightVerses} 
                      highlightVerse={rightRef.verse} 
                      title={language === 'es' ? `${englishToSpanishBookMap[rightRef.book] || rightRef.book} ${rightRef.chapter}` : `${rightRef.book} ${rightRef.chapter}`} 
                      side="right"
                      currentRef={rightRef}
                      isLoading={rightLoading}
                      readerTheme={readerTheme}
                      fontFamily={fontFamily}
                      fontSize={fontSize}
                      refs={refs}
                      books={books}
                      handleNavigate={handleNavigate}
                      handleJump={handleJump}
                      handleClose={handleClosePanel}
                      handleDotClick={handleDotClick}
                      getRefFromOrdinal={getRefFromOrdinal}
                      language={language}
                  />
                </div>
            )}
        </div>

        {/* Mobile Swipe Indicator */}
        {leftRef && rightRef && (
          <div className="md:hidden absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-2 px-3 py-1.5 rounded-full bg-black/20 backdrop-blur-md pointer-events-none z-50">
            <div className="w-1.5 h-1.5 rounded-full bg-white/80"></div>
            <div className="w-1.5 h-1.5 rounded-full bg-white/40"></div>
            <span className="text-[10px] font-medium text-white ml-1 uppercase tracking-wider">{language === 'es' ? 'Deslizar' : 'Swipe'}</span>
          </div>
        )}
      </div>
    </div>
  );
}
