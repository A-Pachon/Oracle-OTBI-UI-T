import React, { useState, useEffect, useRef } from 'react';
import { QueryResult, TabView } from '../types';
import { Download, ChevronDown, FileJson, FileSpreadsheet, Code, FileText, Search, X } from 'lucide-react';
import { exportToCSV, exportToJSON, exportToMarkdown, exportToXLSX, downloadFile } from '../services/exportService';

interface ResultsTableProps {
  result: QueryResult | null;
  error: string | null;
  onExplainError?: () => void;
  view: TabView;
  setView: (v: TabView) => void;
}

const ResultsTable: React.FC<ResultsTableProps> = ({ result, error, onExplainError, view, setView }) => {
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  // Refs to scroll to columns
  const headerRefs = useRef<Record<string, HTMLTableCellElement | null>>({});

  // Logic to scroll to the matching column
  useEffect(() => {
    if (!searchTerm || !result) return;
    
    // Find the first column that matches the search term
    const matchingCol = result.columns.find(col => 
        col.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (matchingCol && headerRefs.current[matchingCol]) {
        headerRefs.current[matchingCol]?.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'nearest', 
            inline: 'center' 
        });
    }
  }, [searchTerm, result]);

  const highlightText = (text: string, highlight: string) => {
    if (!highlight.trim()) {
      return <span>{text}</span>;
    }
    const regex = new RegExp(`(${highlight})`, 'gi');
    const parts = text.split(regex);
    return (
      <span>
        {parts.map((part, i) =>
          regex.test(part) ? (
            <span key={i} className="bg-[#eab308] text-black rounded px-0.5 shadow-sm font-bold">{part}</span>
          ) : (
            <span key={i}>{part}</span>
          )
        )}
      </span>
    );
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-red-400 p-8 text-center bg-[#1e1e1e]">
        <div className="bg-red-500/10 border border-red-500/50 p-6 rounded-lg max-w-2xl">
          <h3 className="text-lg font-bold mb-2">Query Execution Failed</h3>
          <p className="font-mono text-sm whitespace-pre-wrap break-all">{error}</p>
          {onExplainError && (
             <button 
                onClick={onExplainError}
                className="mt-4 px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
             >
                Ask AI to Explain This Error
             </button>
          )}
        </div>
      </div>
    );
  }

  if (!result) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500 bg-[#1e1e1e]">
        <p>No results yet. Run a query to see data.</p>
      </div>
    );
  }

  const handleExport = (type: 'csv' | 'xlsx' | 'json' | 'xml' | 'md') => {
      setShowExportMenu(false);
      switch(type) {
          case 'csv': exportToCSV(result); break;
          case 'xlsx': exportToXLSX(result); break;
          case 'json': exportToJSON(result); break;
          case 'md': exportToMarkdown(result); break;
          case 'xml': 
            if (result.rawXml) downloadFile(result.rawXml, 'export.xml', 'text/xml');
            break;
      }
  }

  // Filter Logic
  const filteredRows = result.rows.filter(row => {
    if (!searchTerm) return true;
    const lowerTerm = searchTerm.toLowerCase();
    
    // Check if any column value matches
    const valueMatch = Object.values(row).some(val => 
        String(val).toLowerCase().includes(lowerTerm)
    );
    
    // Check if any column name matches
    const columnMatch = result.columns.some(col => 
        col.toLowerCase().includes(lowerTerm)
    );

    return valueMatch || columnMatch;
  });

  return (
    <div className="flex flex-col h-full bg-[#1e1e1e]">
      <div className="flex items-center justify-between px-4 py-2 border-b border-gray-700 bg-[#252525]">
        <div className="flex gap-4 items-center">
            <div className="flex gap-4 border-r border-gray-600 pr-4">
                <button 
                    onClick={() => setView(TabView.TABLE)}
                    className={`text-sm pb-1 font-medium ${view === TabView.TABLE ? 'text-[#eab308] border-b-2 border-[#eab308]' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Table View
                </button>
                <button 
                    onClick={() => setView(TabView.RAW_XML)}
                    className={`text-sm pb-1 font-medium ${view === TabView.RAW_XML ? 'text-[#eab308] border-b-2 border-[#eab308]' : 'text-gray-400 hover:text-gray-200'}`}
                >
                    Raw XML
                </button>
            </div>
            
            {/* Search Bar */}
            {view === TabView.TABLE && (
                <div className="relative">
                    <Search size={14} className="absolute left-2 top-1.5 text-gray-500" />
                    <input 
                        type="text"
                        placeholder="Search results or columns..."
                        className="bg-[#1e1e1e] border border-gray-600 rounded-full pl-8 pr-8 py-1 text-xs text-gray-200 focus:border-[#eab308] outline-none w-48 focus:w-64 transition-all"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                    {searchTerm && (
                        <button 
                            onClick={() => setSearchTerm('')}
                            className="absolute right-2 top-1.5 text-gray-500 hover:text-white"
                        >
                            <X size={14} />
                        </button>
                    )}
                </div>
            )}
        </div>
        
        <div className="flex items-center gap-4">
            <div className="text-xs text-gray-500 font-mono">
                {searchTerm ? `${filteredRows.length} / ` : ''} {result.rows.length} rows • {result.executionTimeMs}ms
            </div>

            <div className="relative">
                <button 
                    onClick={() => setShowExportMenu(!showExportMenu)}
                    className="flex items-center gap-1 text-xs bg-[#333] hover:bg-[#444] text-white px-3 py-1.5 rounded transition-colors"
                >
                    <Download size={14} /> Export <ChevronDown size={14}/>
                </button>
                
                {showExportMenu && (
                    <div className="absolute right-0 top-full mt-1 w-48 bg-[#2a2a2a] border border-gray-600 rounded shadow-xl z-20 flex flex-col py-1">
                        <button onClick={() => handleExport('xlsx')} className="text-left px-4 py-2 text-sm text-gray-200 hover:bg-[#eab308] hover:text-black flex items-center gap-2">
                            <FileSpreadsheet size={14}/> Excel (.xlsx)
                        </button>
                        <button onClick={() => handleExport('csv')} className="text-left px-4 py-2 text-sm text-gray-200 hover:bg-[#eab308] hover:text-black flex items-center gap-2">
                            <FileText size={14}/> CSV
                        </button>
                        <button onClick={() => handleExport('json')} className="text-left px-4 py-2 text-sm text-gray-200 hover:bg-[#eab308] hover:text-black flex items-center gap-2">
                            <FileJson size={14}/> JSON
                        </button>
                        <button onClick={() => handleExport('xml')} className="text-left px-4 py-2 text-sm text-gray-200 hover:bg-[#eab308] hover:text-black flex items-center gap-2">
                            <Code size={14}/> Raw XML
                        </button>
                        <button onClick={() => handleExport('md')} className="text-left px-4 py-2 text-sm text-gray-200 hover:bg-[#eab308] hover:text-black flex items-center gap-2">
                            <FileText size={14}/> Markdown
                        </button>
                    </div>
                )}
            </div>
            {/* Backdrop for menu */}
            {showExportMenu && <div className="fixed inset-0 z-10" onClick={() => setShowExportMenu(false)}></div>}
        </div>
      </div>
      
      <div className="flex-1 overflow-auto relative">
        {view === TabView.TABLE ? (
            <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-[#2a2a2a] sticky top-0 z-10 shadow-sm">
                <tr>
                <th className="p-3 w-12 text-center text-gray-500 font-normal border-r border-gray-700 bg-[#2a2a2a]">#</th>
                {result.columns.map((col) => (
                    <th 
                        key={col} 
                        ref={(el) => { headerRefs.current[col] = el; }}
                        className="p-3 font-semibold text-gray-200 border-r border-gray-700 whitespace-nowrap min-w-[100px] bg-[#2a2a2a]"
                    >
                        {highlightText(col, searchTerm)}
                    </th>
                ))}
                </tr>
            </thead>
            <tbody className="divide-y divide-gray-800 text-gray-300">
                {filteredRows.length > 0 ? filteredRows.map((row, idx) => (
                <tr key={idx} className="hover:bg-white/5 transition-colors group">
                    <td className="p-2 text-center text-gray-600 border-r border-gray-700 text-xs bg-[#1e1e1e] group-hover:bg-[#252525] sticky left-0">{idx + 1}</td>
                    {result.columns.map((col) => (
                    <td key={col} className="p-2 border-r border-gray-700 whitespace-nowrap overflow-hidden text-ellipsis max-w-xs" title={row[col]}>
                        {highlightText(row[col] || '', searchTerm)}
                    </td>
                    ))}
                </tr>
                )) : (
                    <tr>
                        <td colSpan={result.columns.length + 1} className="p-8 text-center text-gray-500 italic">
                            No rows match your search.
                        </td>
                    </tr>
                )}
            </tbody>
            </table>
        ) : (
            <pre className="p-4 text-xs font-mono text-green-400 whitespace-pre-wrap selection:bg-green-900 selection:text-white">
                {result.rawXml}
            </pre>
        )}
      </div>
    </div>
  );
};

export default ResultsTable;