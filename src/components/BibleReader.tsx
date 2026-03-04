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
  theme: 'dark' | 'light';
}

export default function BibleReader({ leftRef, rightRef, onClose, theme }: BibleReaderProps) {
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
      <div className={`flex-1 flex flex-col h-full overflow-hidden border-r last:border-0 ${theme === 'light' ? 'bg-[#FDFBF7] border-slate-100' : 'bg-[#0A0A0A] border-slate-900'}`}>
        <div className={`p-6 border-b flex justify-between items-center sticky top-0 z-10 backdrop-blur-sm ${theme === 'light' ? 'border-slate-100 bg-[#FDFBF7]/90' : 'border-slate-900 bg-[#0A0A0A]/90'}`}>
          <h3 className={`font-serif text-xl tracking-tight ${theme === 'light' ? 'text-slate-900' : 'text-slate-100'}`}>{title}</h3>
          <div className="flex gap-2">
              <button className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-slate-900 text-slate-600 hover:text-slate-400'}`}><ChevronLeft size={16} /></button>
              <button className={`p-1.5 rounded-full transition-colors ${theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-600' : 'hover:bg-slate-900 text-slate-600 hover:text-slate-400'}`}><ChevronRight size={16} /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-8 space-y-6">
          {verses.map((v) => (
            <div 
              key={v.verse} 
              id={`verse-${safeTitle}-${v.verse}`}
              className={`leading-loose transition-all duration-500 p-4 rounded-lg ${
                v.verse === highlightVerse 
                  ? (theme === 'light' ? 'bg-emerald-50/50 text-slate-900 shadow-sm ring-1 ring-emerald-100' : 'bg-emerald-900/10 text-slate-100 shadow-sm ring-1 ring-emerald-900/30')
                  : (theme === 'light' ? 'text-slate-600' : 'text-slate-400')
              }`}
            >
              <span className={`text-[10px] font-mono tracking-widest mr-3 select-none opacity-30 ${theme === 'light' ? 'text-slate-900' : 'text-white'}`}>{v.verse}</span>
              <span className="font-serif text-lg md:text-xl">{v.text}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (!leftRef && !rightRef) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 md:p-8 bg-black/60 backdrop-blur-md transition-opacity duration-500">
      <div className={`w-full max-w-7xl h-[85vh] rounded-3xl shadow-2xl flex flex-col overflow-hidden border ${theme === 'light' ? 'bg-white border-white/20 shadow-slate-200/50' : 'bg-[#0A0A0A] border-white/5 shadow-black/50'}`}>
        {/* Header */}
        <div className={`h-16 border-b flex items-center justify-between px-6 md:px-8 ${theme === 'light' ? 'border-slate-100 bg-white text-slate-900' : 'border-slate-900 bg-[#0A0A0A] text-white'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${theme === 'light' ? 'bg-slate-100 text-slate-900' : 'bg-slate-900 text-white'}`}>
                <BookOpen size={14} strokeWidth={1.5} />
            </div>
            <span className="font-serif text-lg tracking-tight">Scripture Comparison</span>
          </div>
          <button 
            onClick={onClose}
            className={`px-4 py-1.5 text-xs uppercase tracking-widest font-medium rounded-full transition-all duration-300 ${theme === 'light' ? 'hover:bg-slate-100 text-slate-400 hover:text-slate-900' : 'hover:bg-slate-900 text-slate-500 hover:text-white'}`}
          >
            Close
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden relative">
            {loading && (
                <div className={`absolute inset-0 flex items-center justify-center z-20 ${theme === 'light' ? 'bg-white/80' : 'bg-slate-950/80'}`}>
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
