import React, { useState, useEffect } from 'react';
import { BookOpen, ChevronLeft, ChevronRight, Search } from 'lucide-react';

interface Verse {
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

interface BibleReaderProps {
  leftRef: { book: string, chapter: number, verse: number } | null;
  rightRef: { book: string, chapter: number, verse: number } | null;
  onClose: () => void;
}

export default function BibleReader({ leftRef, rightRef, onClose }: BibleReaderProps) {
  const [leftVerses, setLeftVerses] = useState<Verse[]>([]);
  const [rightVerses, setRightVerses] = useState<Verse[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    async function fetchData() {
      if (!leftRef && !rightRef) return;
      setLoading(true);

      try {
        if (leftRef) {
          const res = await fetch(`/api/chapter?book=${leftRef.book}&chapter=${leftRef.chapter}`);
          const data = await res.json();
          setLeftVerses(data);
        }
        if (rightRef) {
          const res = await fetch(`/api/chapter?book=${rightRef.book}&chapter=${rightRef.chapter}`);
          const data = await res.json();
          setRightVerses(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, [leftRef, rightRef]);

  const ReaderPanel = ({ verses, highlightVerse, title }: { verses: Verse[], highlightVerse?: number, title: string }) => {
    const safeTitle = title.replace(/\s+/g, '-');

    useEffect(() => {
      if (highlightVerse && verses.length > 0) {
        const timer = setTimeout(() => {
          const el = document.getElementById(`verse-${safeTitle}-${highlightVerse}`);
          if (el) {
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        }, 100);
        return () => clearTimeout(timer);
      }
    }, [verses, highlightVerse, safeTitle]);

    return (
      <div className="flex-1 flex flex-col h-full overflow-hidden bg-slate-50 dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 last:border-0">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex justify-between items-center sticky top-0 z-10">
          <h3 className="font-serif text-lg font-medium text-slate-900 dark:text-slate-100">{title}</h3>
          <div className="flex gap-2">
              <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><ChevronLeft size={16} /></button>
              <button className="p-1 hover:bg-slate-100 dark:hover:bg-slate-800 rounded"><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {verses.map((v) => (
            <div 
              key={v.verse} 
              id={`verse-${safeTitle}-${v.verse}`}
              className={`leading-relaxed transition-colors duration-300 p-2 rounded ${
                v.verse === highlightVerse 
                  ? 'bg-amber-100 dark:bg-amber-900/30 text-slate-900 dark:text-slate-100 ring-1 ring-amber-500/50' 
                  : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800/50'
              }`}
            >
              <span className="text-xs font-mono text-slate-400 mr-2 select-none">{v.verse}</span>
              <span className="font-serif text-lg">{v.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!leftRef && !rightRef) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="bg-white dark:bg-slate-950 w-full max-w-6xl h-[80vh] rounded-2xl shadow-2xl flex flex-col overflow-hidden border border-slate-800">
        {/* Header */}
        <div className="h-14 border-b border-slate-800 flex items-center justify-between px-6 bg-slate-950 text-white">
          <div className="flex items-center gap-2">
            <BookOpen size={18} className="text-emerald-400" />
            <span className="font-medium tracking-wide">Scripture Comparison</span>
          </div>
          <button 
            onClick={onClose}
            className="px-3 py-1 text-xs uppercase tracking-wider font-medium hover:bg-white/10 rounded transition-colors"
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden relative">
            {loading && (
                <div className="absolute inset-0 bg-white/80 dark:bg-slate-950/80 flex items-center justify-center z-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-emerald-500"></div>
                </div>
            )}
            
            {leftRef && (
                <ReaderPanel 
                    verses={leftVerses} 
                    highlightVerse={leftRef.verse} 
                    title={`${leftRef.book} ${leftRef.chapter}`} 
                />
            )}
            
            {rightRef && (
                <ReaderPanel 
                    verses={rightVerses} 
                    highlightVerse={rightRef.verse} 
                    title={`${rightRef.book} ${rightRef.chapter}`} 
                />
            )}
        </div>
      </div>
    </div>
  );
}
