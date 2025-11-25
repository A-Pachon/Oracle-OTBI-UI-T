import React, { useState, useEffect, useRef, useCallback } from 'react';
import { AlignLeft, Search, ArrowUp, ArrowDown, X } from 'lucide-react';

// Declare globals
declare const Prism: any;
declare const sqlFormatter: any;

interface SqlEditorProps {
  value: string;
  onChange: (val: string) => void;
  onRun: () => void;
  isLoading: boolean;
}

interface SearchMatch {
  start: number;
  end: number;
}

const SqlEditor: React.FC<SqlEditorProps> = ({ value, onChange, onRun, isLoading }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);
  const highlightsRef = useRef<HTMLDivElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  
  const [highlightedCode, setHighlightedCode] = useState('');
  
  // Search State
  const [showSearch, setShowSearch] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [currentMatchIdx, setCurrentMatchIdx] = useState(0);
  const [matches, setMatches] = useState<SearchMatch[]>([]);
  
  // Selection Highlight State
  const [selectionWord, setSelectionWord] = useState('');

  // --- Scroll Sync ---
  const handleScroll = () => {
    if (textareaRef.current && preRef.current && lineNumbersRef.current && highlightsRef.current) {
      const { scrollTop, scrollLeft } = textareaRef.current;
      preRef.current.scrollTop = scrollTop;
      preRef.current.scrollLeft = scrollLeft;
      highlightsRef.current.scrollTop = scrollTop;
      highlightsRef.current.scrollLeft = scrollLeft;
      lineNumbersRef.current.scrollTop = scrollTop;
    }
  };

  // --- Syntax Highlighting (Prism) ---
  useEffect(() => {
    if (typeof Prism !== 'undefined') {
      const html = Prism.highlight(value, Prism.languages.sql, 'sql');
      setHighlightedCode(html + (value.endsWith('\n') ? '<br>' : ''));
    } else {
      setHighlightedCode(value);
    }
  }, [value]);

  // --- Search Logic ---
  useEffect(() => {
    if (!searchText) {
      setMatches([]);
      setCurrentMatchIdx(0);
      return;
    }

    const newMatches: SearchMatch[] = [];
    const regex = new RegExp(searchText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let match;
    while ((match = regex.exec(value)) !== null) {
      newMatches.push({ start: match.index, end: match.index + match[0].length });
    }
    setMatches(newMatches);
    // If user typed, reset to first match or keep roughly same position? Reset for simplicity
    if (newMatches.length > 0) {
        // Find closest match to current cursor? Or just 0.
        setCurrentMatchIdx(0);
    }
  }, [searchText, value]);

  const jumpToMatch = (index: number) => {
      if (matches.length === 0) return;
      const safeIndex = (index + matches.length) % matches.length;
      setCurrentMatchIdx(safeIndex);
      
      const match = matches[safeIndex];
      if (textareaRef.current) {
          textareaRef.current.focus();
          textareaRef.current.setSelectionRange(match.start, match.end);
          // Blur and focus to force scroll if needed, or calculate scroll
          // Native behavior usually scrolls on selection change if focused
          // Force scroll attempt:
          const textBefore = value.substring(0, match.start);
          const lines = textBefore.split('\n').length;
          const lineHeight = 21; // Approx 1.5 * 14px
          const targetTop = (lines - 1) * lineHeight;
          
          // Smooth scroll centering
          const containerHeight = textareaRef.current.clientHeight;
          textareaRef.current.scrollTop = Math.max(0, targetTop - containerHeight / 2);
      }
  };

  // --- Selection Logic ---
  const handleSelect = () => {
      if (!textareaRef.current) return;
      const { selectionStart, selectionEnd, value } = textareaRef.current;
      if (selectionStart !== selectionEnd) {
          const selectedText = value.substring(selectionStart, selectionEnd);
          // Only highlight if it looks like a single word
          if (/^[\w]+$/.test(selectedText)) {
              setSelectionWord(selectedText);
          } else {
              setSelectionWord('');
          }
      } else {
          setSelectionWord('');
      }
  };

  // --- HTML Generation for Highlights Layer ---
  const generateHighlightsHtml = useCallback(() => {
      // We need to wrap occurrences of `searchText` (yellow) and `selectionWord` (gray) in spans
      // Note: `searchText` takes precedence visually or we process them sequentially.
      
      let html = value
          .replace(/&/g, "&amp;")
          .replace(/</g, "&lt;")
          .replace(/>/g, "&gt;");

      const highlight = (term: string, className: string) => {
          if (!term) return;
          // Escape regex special chars
          const esc = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
          const regex = new RegExp(`(${esc})`, 'gi');
          html = html.replace(regex, `<span class="${className}">$1</span>`);
      };

      // Apply Selection Highlight first (Background)
      if (selectionWord && selectionWord.length > 2 && selectionWord !== searchText) {
          highlight(selectionWord, 'highlight-selection');
      }

      // Apply Search Highlight (Foreground/Important)
      if (showSearch && searchText) {
          highlight(searchText, 'highlight-match');
      }
      
      // Preserve newlines for alignment
      return html + (value.endsWith('\n') ? '<br>' : '');
  }, [value, searchText, showSearch, selectionWord]);

  // --- Keyboard Handlers ---
  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Run Query
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault();
      onRun();
    }
    
    // Open Search
    if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
      e.preventDefault();
      setShowSearch(true);
      // Wait for render then focus search input
      setTimeout(() => document.getElementById('sql-search-input')?.focus(), 50);
    }
    
    // Tab Indentation
    if (e.key === 'Tab') {
      e.preventDefault();
      const start = e.currentTarget.selectionStart;
      const end = e.currentTarget.selectionEnd;
      const val = e.currentTarget.value;
      const newVal = val.substring(0, start) + '  ' + val.substring(end);
      onChange(newVal);
      setTimeout(() => {
        if (textareaRef.current) {
            textareaRef.current.selectionStart = textareaRef.current.selectionEnd = start + 2;
        }
      }, 0);
    }
  };

  const handleFormat = () => {
      if (typeof sqlFormatter !== 'undefined') {
          try {
              const formatted = sqlFormatter.format(value, {
                language: 'sql',
                tabWidth: 2,
                keywordCase: 'upper',
              });
              onChange(formatted);
          } catch(e) {
              console.error("Formatting failed", e);
          }
      } else {
          alert("SQL Formatter library not loaded.");
      }
  }

  const lineCount = value.split('\n').length;
  const lineNumbers = Array.from({ length: lineCount }, (_, i) => i + 1).join('\n');

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e] border-b border-gray-700 relative group">
      
      {/* Floating Toolbar */}
      <div className="absolute top-2 right-4 z-20 flex gap-2">
           {/* Search Toggle */}
           <button
             onClick={() => { setShowSearch(!showSearch); if(!showSearch) setTimeout(() => document.getElementById('sql-search-input')?.focus(), 50); }}
             className={`px-2 py-1.5 rounded shadow text-xs font-semibold flex items-center gap-2 transition-colors ${showSearch ? 'bg-[#eab308] text-black' : 'bg-[#333] hover:bg-[#444] text-gray-300'}`}
             title="Find (Ctrl+F)"
           >
              <Search size={12} />
           </button>

           <button
             onClick={handleFormat}
             className="px-3 py-1.5 bg-[#333] hover:bg-[#444] text-gray-300 rounded shadow text-xs font-semibold flex items-center gap-2"
             title="Format SQL"
           >
              <AlignLeft size={12} /> Format
           </button>

           <div className="flex items-center gap-2">
                <button
                    onClick={onRun}
                    disabled={isLoading}
                    className={`px-4 py-1.5 rounded shadow-lg text-xs font-bold uppercase tracking-wider transition-all flex items-center gap-2
                        ${isLoading 
                        ? 'bg-gray-700 text-gray-400 cursor-wait' 
                        : 'bg-[#eab308] hover:bg-white hover:text-black text-black'
                        }`}
                >
                    {isLoading ? 'Running...' : 'Run'} <span className="text-[9px] opacity-70 hidden sm:inline">(Ctrl+Enter)</span>
                </button>
           </div>
      </div>

      {/* Search Widget */}
      {showSearch && (
          <div className="absolute top-12 right-4 z-30 bg-[#252525] border border-gray-600 rounded-lg shadow-xl p-1.5 flex items-center gap-2 animate-in fade-in slide-in-from-top-2">
              <input 
                id="sql-search-input"
                type="text" 
                className="bg-[#111] border border-gray-600 rounded px-2 py-1 text-xs text-white focus:border-[#eab308] outline-none w-40"
                placeholder="Find..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        jumpToMatch(e.shiftKey ? currentMatchIdx - 1 : currentMatchIdx + 1);
                    }
                    if (e.key === 'Escape') {
                        setShowSearch(false);
                        textareaRef.current?.focus();
                    }
                }}
              />
              <div className="text-[10px] text-gray-500 font-mono w-12 text-center">
                  {matches.length > 0 ? `${currentMatchIdx + 1}/${matches.length}` : '0/0'}
              </div>
              <div className="flex gap-0.5">
                <button onClick={() => jumpToMatch(currentMatchIdx - 1)} className="p-1 hover:bg-[#333] rounded text-gray-300"><ArrowUp size={12}/></button>
                <button onClick={() => jumpToMatch(currentMatchIdx + 1)} className="p-1 hover:bg-[#333] rounded text-gray-300"><ArrowDown size={12}/></button>
              </div>
              <div className="w-[1px] h-4 bg-gray-600 mx-1"></div>
              <button onClick={() => { setShowSearch(false); textareaRef.current?.focus(); }} className="p-1 hover:bg-red-900/50 hover:text-red-400 rounded text-gray-400"><X size={12}/></button>
          </div>
      )}

      <div className="flex-1 relative font-mono text-sm overflow-hidden mt-1">
        
        {/* Line Numbers */}
        <div ref={lineNumbersRef} className="line-numbers text-gray-600 select-none">
          {lineNumbers}
        </div>

        {/* Editor Container */}
        <div className="editor-container">
            {/* Layer 1: Highlights (Selection & Search) */}
            <div 
                ref={highlightsRef}
                className="editor-layer editor-highlights"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: generateHighlightsHtml() }}
            />

            {/* Layer 2: Syntax Highlighting */}
            <pre 
                ref={preRef}
                className="editor-layer editor-pre"
                aria-hidden="true"
                dangerouslySetInnerHTML={{ __html: highlightedCode }}
            />
            
            {/* Layer 3: Input */}
            <textarea
                ref={textareaRef}
                className="editor-layer editor-textarea"
                value={value}
                onChange={(e) => onChange(e.target.value)}
                onScroll={handleScroll}
                onKeyDown={handleKeyDown}
                onSelect={handleSelect}
                onDoubleClick={handleSelect}
                spellCheck={false}
                autoCapitalize="off"
                autoComplete="off"
            />
        </div>
      </div>
    </div>
  );
};

export default SqlEditor;