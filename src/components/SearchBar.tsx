import React, { useState } from 'react';
import { Search, X } from 'lucide-react';

interface SearchBarProps {
  onSearch: (query: string) => void;
  theme: 'light' | 'dark';
}

export default function SearchBar({ onSearch, theme }: SearchBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim()) {
      onSearch(query.trim());
      setIsOpen(false);
    }
  };

  return (
    <div className="relative flex items-center">
      {isOpen ? (
        <form 
          onSubmit={handleSubmit}
          className={`flex items-center rounded-full border px-3 py-1 transition-all w-64 ${
            theme === 'light' 
              ? 'bg-white border-slate-300 text-slate-900' 
              : 'bg-slate-900 border-slate-700 text-slate-100'
          }`}
        >
          <Search size={16} className={theme === 'light' ? 'text-slate-400' : 'text-slate-500'} />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. Lucas 5:16"
            className="bg-transparent border-none outline-none flex-1 ml-2 text-sm placeholder:text-slate-500"
            autoFocus
          />
          <button 
            type="button" 
            onClick={() => setIsOpen(false)}
            className={`p-1 rounded-full hover:bg-slate-200 dark:hover:bg-slate-800 ${
              theme === 'light' ? 'text-slate-500' : 'text-slate-400'
            }`}
          >
            <X size={14} />
          </button>
        </form>
      ) : (
        <button
          onClick={() => setIsOpen(true)}
          className={`p-2 rounded-full transition-all duration-300 ${
            theme === 'light' ? 'hover:bg-slate-200 text-slate-600' : 'hover:bg-slate-800 text-slate-400'
          }`}
          title="Search Reference"
        >
          <Search size={20} strokeWidth={1.5} />
        </button>
      )}
    </div>
  );
}
