'use client';
import { useEffect, useRef, useState } from 'react';
import { MdSearch, MdClose } from 'react-icons/md';

/**
 * Search box that reports its value after a short pause, or at once on Enter.
 * It owns the text it shows; give it a new `key` to reset it.
 */
export default function SearchInput({ onSearch, placeholder = 'Search', label, delay = 350, className = '', initial = '' }) {
  const [text, setText] = useState(initial);
  const last = useRef(initial.trim());

  const emit = (value) => {
    const trimmed = value.trim();
    if (trimmed === last.current) return;
    last.current = trimmed;
    onSearch(trimmed);
  };

  useEffect(() => {
    const timer = setTimeout(() => emit(text), delay);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [text, delay]);

  return (
    <div className={`relative ${className}`}>
      <MdSearch className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={18} aria-hidden />
      <input
        type="search"
        className="input-ui pl-9 pr-9 [&::-webkit-search-cancel-button]:hidden"
        placeholder={placeholder}
        aria-label={label || placeholder}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') emit(text);
          if (e.key === 'Escape' && text) {
            e.stopPropagation();
            setText('');
          }
        }}
      />
      {text && (
        <button
          type="button"
          className="absolute right-1 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          onClick={() => {
            setText('');
            emit('');
          }}
          aria-label="Clear search"
        >
          <MdClose size={16} />
        </button>
      )}
    </div>
  );
}
