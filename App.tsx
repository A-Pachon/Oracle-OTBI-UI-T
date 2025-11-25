import React, { useState, useEffect, useRef } from 'react';
import SqlEditor from './components/SqlEditor';
import ResultsTable from './components/ResultsTable';
import SettingsModal from './components/SettingsModal';
import SavedQueriesModal from './components/SavedQueriesModal';
import { executeSoapQuery } from './services/soapService';
import { generateSqlFromPrompt, explainError } from './services/geminiService';
import { initDB, getConnections, updateAllConnections, getSavedQueries, saveQuery, deleteSavedQuery } from './services/dbService';
import { ConnectionConfig, TabView, SqlTab, SavedQuery } from './types';
import { DEFAULT_SOAP_TEMPLATE, DEFAULT_URL } from './constants';
import { Settings, Sparkles, Database, ChevronDown, Plus, X, FolderOpen, Save, Loader2 } from 'lucide-react';

const ACTIVE_CONN_KEY = 'duckoracle_active_id';
const DRAFT_QUERY_KEY = 'duckoracle_draft';

// Utility for ID gen
const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const App: React.FC = () => {
  // --- Global App State ---
  const [isDbReady, setIsDbReady] = useState(false);

  // --- Connections State ---
  const [savedConnections, setSavedConnections] = useState<ConnectionConfig[]>([]);
  const [activeConnectionId, setActiveConnectionId] = useState<string>('');
  
  // --- Tabs State ---
  const [tabs, setTabs] = useState<SqlTab[]>([
    { id: 'tab-1', name: 'Query 1', query: '', rowLimit: 100, result: null, error: null, isLoading: false, view: TabView.TABLE }
  ]);
  const [activeTabId, setActiveTabId] = useState<string>('tab-1');
  
  // --- Layout State (Resizer) ---
  const [editorHeight, setEditorHeight] = useState(350);
  const isResizing = useRef(false);

  // --- Saved Queries State ---
  const [savedQueries, setSavedQueries] = useState<SavedQuery[]>([]);
  const [isSavedQueriesOpen, setIsSavedQueriesOpen] = useState(false);

  // --- UI State ---
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState("");
  const [isAiGenerating, setIsAiGenerating] = useState(false);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [isConnDropdownOpen, setIsConnDropdownOpen] = useState(false);

  const activeConfig = savedConnections.find(c => c.id === activeConnectionId) || {
    id: 'temp', name: 'Temporary', url: DEFAULT_URL, username: '', password: '', soapTemplate: DEFAULT_SOAP_TEMPLATE
  };

  // Helper to update active tab
  const updateActiveTab = (updates: Partial<SqlTab>) => {
      setTabs(prev => prev.map(t => t.id === activeTabId ? { ...t, ...updates } : t));
  };
  const activeTab = tabs.find(t => t.id === activeTabId) || tabs[0];

  // --- Init Database & Startup Logic ---
  useEffect(() => {
    const loadData = async () => {
      try {
        await initDB();
        
        // Load Connections
        const conns = await getConnections();
        setSavedConnections(conns);

        let initialConnId = '';

        // Load Active Connection Preference
        const storedActive = localStorage.getItem(ACTIVE_CONN_KEY);
        if (storedActive && conns.find(c => c.id === storedActive)) {
          initialConnId = storedActive;
        } else if (conns.length > 0) {
          initialConnId = conns[0].id;
        }

        if (initialConnId) {
            setActiveConnectionId(initialConnId);
        } else {
            // If no connection is active or exists, open Settings immediately
            setIsSettingsOpen(true);
        }

        // Load Saved Queries
        const queries = await getSavedQueries();
        setSavedQueries(queries);

        // Load Draft Query (Last autosave)
        const draft = localStorage.getItem(DRAFT_QUERY_KEY);
        if (draft) {
             setTabs(prev => prev.map(t => t.id === 'tab-1' ? { ...t, query: draft } : t));
        }
        
        setIsDbReady(true);
      } catch (err) {
        console.error("Failed to load DB", err);
        alert("Critical Error: Failed to initialize database.");
      }
    };
    loadData();
  }, []);

  // --- Auto-Save Draft ---
  useEffect(() => {
    if (activeTabId === 'tab-1') { // Only auto-save the first tab for simplicity as "Draft"
        const handler = setTimeout(() => {
            localStorage.setItem(DRAFT_QUERY_KEY, activeTab.query);
        }, 1000);
        return () => clearTimeout(handler);
    }
  }, [activeTab.query, activeTabId]);

  // --- Resizer Logic ---
  const startResizing = (e: React.MouseEvent) => {
    isResizing.current = true;
    e.preventDefault();
    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'row-resize';
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isResizing.current) return;
    // Calculate new height based on mouse Y relative to window/container
    // Offset by header heights (approx 12 + 9 + 10 units * 4px = ~124px + sidebar offset)
    // Simpler: Just rely on mouse position relative to top of screen minus header
    const HEADER_HEIGHT = 135; // Approx header + tabs + toolbar height
    const newHeight = e.clientY - HEADER_HEIGHT;
    
    // Constraints
    if (newHeight > 100 && newHeight < window.innerHeight - 200) {
        setEditorHeight(newHeight);
    }
  };

  const stopResizing = () => {
    isResizing.current = false;
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('mouseup', stopResizing);
    document.body.style.cursor = 'default';
  };


  const handleSaveConnections = async (newConns: ConnectionConfig[]) => {
      setSavedConnections(newConns);
      await updateAllConnections(newConns);
  };

  const handleSelectConnection = (id: string) => {
      setActiveConnectionId(id);
      localStorage.setItem(ACTIVE_CONN_KEY, id);
      setIsConnDropdownOpen(false);
  };

  // --- Tab Management ---
  const handleNewTab = () => {
      const newId = generateId();
      setTabs([...tabs, { 
          id: newId, 
          name: `Query ${tabs.length + 1}`, 
          query: '', 
          rowLimit: 100, 
          result: null, 
          error: null, 
          isLoading: false, 
          view: TabView.TABLE 
        }]);
      setActiveTabId(newId);
  };

  const handleCloseTab = (e: React.MouseEvent, id: string) => {
      e.stopPropagation();
      if (tabs.length === 1) return; // Don't close last tab
      const newTabs = tabs.filter(t => t.id !== id);
      setTabs(newTabs);
      if (id === activeTabId) {
          setActiveTabId(newTabs[newTabs.length - 1].id);
      }
  };

  // --- Execution ---
  const handleRun = async () => {
    if (!activeConfig.username) {
      setIsSettingsOpen(true);
      return;
    }

    updateActiveTab({ isLoading: true, error: null });
    
    try {
      const data = await executeSoapQuery(activeTab.query, activeConfig, activeTab.rowLimit);
      
      updateActiveTab({ 
          result: data, 
          isLoading: false,
          view: activeTab.view === TabView.RAW_XML ? TabView.RAW_XML : TabView.TABLE
      });
    } catch (err: any) {
      updateActiveTab({ 
          error: err.message || "Unknown error occurred", 
          result: null, 
          isLoading: false 
      });
    }
  };

  // --- AI ---
  const handleAiGenerate = async () => {
    if (!aiPrompt.trim()) return;
    setIsAiGenerating(true);
    try {
      const sql = await generateSqlFromPrompt(aiPrompt);
      updateActiveTab({ query: sql });
      setAiPanelOpen(false);
    } catch (e) {
      alert("Failed to generate SQL.");
    } finally {
      setIsAiGenerating(false);
    }
  };

  const handleExplainError = async () => {
      if(!activeTab.error) return;
      updateActiveTab({ isLoading: true });
      try {
          const explanation = await explainError(activeTab.error, activeTab.query);
          alert(`AI Explanation:\n\n${explanation}`);
      } catch(e) {
          alert("Could not explain error.");
      } finally {
          updateActiveTab({ isLoading: false });
      }
  };

  // --- Saved Queries ---
  const handleSaveQuery = async (newQ: SavedQuery) => {
      await saveQuery(newQ); // DB
      const updated = await getSavedQueries(); // Refresh from DB
      setSavedQueries(updated);
  };

  const handleDeleteQuery = async (id: string) => {
      await deleteSavedQuery(id); // DB
      const updated = await getSavedQueries(); // Refresh from DB
      setSavedQueries(updated);
  };

  const handleLoadQuery = (sql: string) => {
      updateActiveTab({ query: sql });
  };

  if (!isDbReady) {
    return (
      <div className="flex h-screen w-full bg-[#111] items-center justify-center text-gray-400 flex-col gap-4">
        <Loader2 size={40} className="animate-spin text-[#eab308]" />
        <div className="font-mono text-sm">Initializing Local SQLite Database...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen w-full bg-[#111] text-gray-200 font-sans">
      {/* Sidebar (Vertical Toolbar) */}
      <div className="w-16 flex flex-col items-center py-4 bg-[#181818] border-r border-gray-800 gap-6 z-20">
        <div className="w-10 h-10 bg-[#eab308] rounded-lg flex items-center justify-center text-black font-bold text-xl shadow-lg shadow-yellow-500/20">
          D
        </div>
        
        <div className="flex flex-col gap-4 w-full items-center">
            <button 
                onClick={() => setIsSettingsOpen(true)}
                className={`p-3 rounded-lg transition-all tooltip ${(!activeConfig.username) ? 'text-red-400 bg-red-900/20 animate-pulse' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="Manage Connections"
            >
                <Settings size={24} />
            </button>
            
            <button 
                onClick={() => setAiPanelOpen(!aiPanelOpen)}
                className={`p-3 rounded-lg transition-all ${aiPanelOpen ? 'text-[#eab308] bg-white/10' : 'text-gray-400 hover:text-white hover:bg-white/10'}`}
                title="AI Assistant"
            >
                <Sparkles size={24} />
            </button>

            <button 
                onClick={() => setIsSavedQueriesOpen(true)}
                className={`p-3 rounded-lg transition-all text-gray-400 hover:text-white hover:bg-white/10`}
                title="Query Library"
            >
                <FolderOpen size={24} />
            </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden relative">
        
        {/* Header Bar */}
        <div className="h-12 bg-[#1e1e1e] border-b border-gray-700 flex items-center px-4 justify-between select-none shadow-md z-10 shrink-0">
            {/* Connection Dropdown */}
            <div className="relative">
                <button 
                    onClick={() => setIsConnDropdownOpen(!isConnDropdownOpen)}
                    className="flex items-center gap-2 text-sm bg-[#2a2a2a] hover:bg-[#333] px-3 py-1.5 rounded border border-gray-700 transition-colors"
                >
                    <Database size={14} className={activeConfig.id ? "text-[#eab308]" : "text-gray-500"}/>
                    <span className="font-medium text-gray-200">{activeConfig.name || "Select Connection"}</span>
                    <ChevronDown size={14} className="text-gray-500"/>
                </button>

                {isConnDropdownOpen && (
                    <>
                        <div className="fixed inset-0 z-10" onClick={() => setIsConnDropdownOpen(false)}></div>
                        <div className="absolute top-full left-0 mt-1 w-64 bg-[#2a2a2a] border border-gray-600 rounded-lg shadow-xl z-20 overflow-hidden">
                            <div className="max-h-60 overflow-y-auto py-1">
                                {savedConnections.length === 0 ? (
                                    <div className="px-4 py-3 text-xs text-gray-500 text-center">No saved connections</div>
                                ) : (
                                    savedConnections.map(conn => (
                                        <button 
                                            key={conn.id}
                                            onClick={() => handleSelectConnection(conn.id)}
                                            className={`w-full text-left px-4 py-2 text-sm flex items-center gap-2 hover:bg-[#333]
                                                ${activeConnectionId === conn.id ? 'text-[#eab308] bg-[#333]/50' : 'text-gray-300'}
                                            `}
                                        >
                                            <div className="w-2 h-2 rounded-full bg-current"></div>
                                            <div className="flex-1 truncate">{conn.name}</div>
                                        </button>
                                    ))
                                )}
                            </div>
                            <div className="border-t border-gray-600 p-2 bg-[#252525]">
                                <button 
                                    onClick={() => { setIsConnDropdownOpen(false); setIsSettingsOpen(true); }}
                                    className="w-full text-xs text-center text-gray-400 hover:text-white hover:underline"
                                >
                                    Manage Connections...
                                </button>
                            </div>
                        </div>
                    </>
                )}
            </div>

            <div className="flex items-center gap-4">
                 <div className="text-xs text-gray-500">
                    Host: <span className="text-gray-300">{new URL(activeConfig.url || 'http://localhost').hostname}</span>
                </div>
            </div>
        </div>
        
        {/* Tab Bar */}
        <div className="h-9 bg-[#111] border-b border-gray-700 flex items-center px-2 gap-1 overflow-x-auto shrink-0">
            {tabs.map(tab => (
                <div 
                    key={tab.id}
                    onClick={() => setActiveTabId(tab.id)}
                    className={`
                        group flex items-center gap-2 px-3 py-1.5 text-xs font-medium rounded-t-lg cursor-pointer border-t border-x border-transparent mt-1 select-none min-w-[100px] max-w-[200px]
                        ${activeTabId === tab.id 
                            ? 'bg-[#1e1e1e] border-gray-700 text-[#eab308] border-b-[#1e1e1e] translate-y-[1px]' 
                            : 'text-gray-500 hover:text-gray-300 hover:bg-[#1e1e1e]/50'}
                    `}
                >
                    <span className="truncate flex-1">{tab.name}</span>
                    <button 
                        onClick={(e) => handleCloseTab(e, tab.id)}
                        className={`p-0.5 rounded hover:bg-white/20 opacity-0 group-hover:opacity-100 ${tabs.length === 1 ? 'hidden' : ''}`}
                    >
                        <X size={10}/>
                    </button>
                </div>
            ))}
            <button onClick={handleNewTab} className="p-1 text-gray-500 hover:text-gray-200 hover:bg-[#333] rounded">
                <Plus size={14}/>
            </button>
        </div>

        {/* Toolbar (Below Tabs) */}
        <div className="h-10 bg-[#1e1e1e] border-b border-gray-700 flex items-center px-4 justify-between shrink-0">
             <div className="flex items-center gap-4">
                <div className="flex items-center gap-2 text-xs text-gray-400">
                    <span>Limit Rows:</span>
                    <input 
                        type="number" 
                        min="1"
                        max="50000"
                        className="bg-[#2a2a2a] border border-gray-600 rounded w-20 px-2 py-1 text-white focus:border-[#eab308] outline-none text-right"
                        value={activeTab.rowLimit}
                        onChange={(e) => updateActiveTab({ rowLimit: parseInt(e.target.value) || 100 })}
                    />
                </div>
                <div className="w-[1px] h-4 bg-gray-700 mx-2"></div>
                <button 
                    onClick={() => setIsSavedQueriesOpen(true)} 
                    className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-white/5"
                >
                    <FolderOpen size={14}/> Open...
                </button>
                <button 
                    onClick={() => setIsSavedQueriesOpen(true)}
                    className="flex items-center gap-1.5 text-xs text-gray-300 hover:text-white px-2 py-1 rounded hover:bg-white/5"
                >
                    <Save size={14}/> Save
                </button>
             </div>
        </div>

        {/* AI Prompt Panel (Floating) */}
        {aiPanelOpen && (
            <div className="absolute top-28 left-4 right-4 z-30 bg-[#252525] border border-gray-600 rounded-lg shadow-2xl p-4 flex gap-2 animate-in fade-in slide-in-from-top-4">
                <div className="flex-1">
                    <input 
                        type="text"
                        className="w-full bg-[#111] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#eab308] outline-none placeholder-gray-600"
                        placeholder="Ask Gemini: 'Show me total invoice amount by customer for 2024'..."
                        value={aiPrompt}
                        onChange={(e) => setAiPrompt(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                        autoFocus
                    />
                </div>
                <button 
                    onClick={handleAiGenerate}
                    disabled={isAiGenerating}
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded font-medium disabled:opacity-50 shadow-lg"
                >
                    {isAiGenerating ? 'Generating...' : 'Generate SQL'}
                </button>
            </div>
        )}

        {/* Workspace: Editor (Top) & Results (Bottom) */}
        <div className="flex-1 flex flex-col min-h-0">
            {/* Editor Area (Resizable) */}
            <div 
                className="flex-none relative z-0"
                style={{ height: editorHeight }}
            >
                <SqlEditor 
                    value={activeTab.query} 
                    onChange={(val) => updateActiveTab({ query: val })} 
                    onRun={handleRun}
                    isLoading={activeTab.isLoading} 
                />
            </div>
            
            {/* Resizer Handle */}
            <div 
                onMouseDown={startResizing}
                className="h-1 bg-[#333] cursor-row-resize hover:bg-[#eab308] hover:h-1.5 transition-all shrink-0 z-10 w-full"
                title="Drag to resize"
            ></div>

            {/* Results Area */}
            <div className="flex-1 relative z-0 min-h-0 overflow-hidden">
                <ResultsTable 
                    result={activeTab.result} 
                    error={activeTab.error} 
                    onExplainError={handleExplainError}
                    view={activeTab.view}
                    setView={(v) => updateActiveTab({ view: v })}
                />
            </div>
        </div>
      </div>

      <SettingsModal 
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        savedConnections={savedConnections}
        activeConnectionId={activeConnectionId}
        onSaveConnections={handleSaveConnections}
        onSelectConnection={handleSelectConnection}
      />

      <SavedQueriesModal 
        isOpen={isSavedQueriesOpen}
        onClose={() => setIsSavedQueriesOpen(false)}
        savedQueries={savedQueries}
        currentQuery={activeTab.query}
        onSaveQuery={handleSaveQuery}
        onDeleteQuery={handleDeleteQuery}
        onLoadQuery={handleLoadQuery}
      />
    </div>
  );
};

export default App;