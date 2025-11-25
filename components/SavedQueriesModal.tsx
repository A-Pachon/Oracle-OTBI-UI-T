import React, { useState, useEffect } from 'react';
import { SavedQuery } from '../types';
import { X, Trash2, FolderOpen, Save, Copy } from 'lucide-react';

interface SavedQueriesModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedQueries: SavedQuery[];
  currentQuery: string;
  onSaveQuery: (newQuery: SavedQuery) => void;
  onDeleteQuery: (id: string) => void;
  onLoadQuery: (query: string) => void;
}

const generateId = () => Math.random().toString(36).substring(2) + Date.now().toString(36);

const SavedQueriesModal: React.FC<SavedQueriesModalProps> = ({
  isOpen, onClose, savedQueries, currentQuery, onSaveQuery, onDeleteQuery, onLoadQuery
}) => {
  const [mode, setMode] = useState<'LIST' | 'SAVE'>('LIST');
  const [saveName, setSaveName] = useState('');
  const [saveDesc, setSaveDesc] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    if (isOpen) {
      setMode('LIST');
      setSearchTerm('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleSave = () => {
    if (!saveName.trim()) return;
    onSaveQuery({
        id: generateId(),
        name: saveName,
        description: saveDesc,
        query: currentQuery
    });
    setSaveName('');
    setSaveDesc('');
    setMode('LIST');
  };

  const filteredQueries = savedQueries.filter(q => 
    q.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
    (q.description && q.description.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] w-[600px] max-h-[80vh] rounded-xl shadow-2xl border border-gray-700 flex flex-col overflow-hidden">
        
        <div className="flex justify-between items-center p-4 border-b border-gray-700 bg-[#252525]">
            <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                {mode === 'LIST' ? <><FolderOpen size={20}/> Query Library</> : <><Save size={20}/> Save Query</>}
            </h2>
            <button onClick={onClose} className="text-gray-400 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4">
            {mode === 'LIST' ? (
                <>
                    <div className="flex gap-2 mb-4">
                        <input 
                            type="text"
                            placeholder="Search saved queries..."
                            className="flex-1 bg-[#252525] border border-gray-600 rounded px-3 py-2 text-sm text-white focus:border-[#eab308] outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                        <button 
                            onClick={() => setMode('SAVE')}
                            className="bg-[#eab308] text-black px-4 py-2 rounded text-sm font-bold hover:bg-[#ca9a04] transition-colors flex items-center gap-2"
                        >
                            <Save size={14}/> Save Current
                        </button>
                    </div>

                    {savedQueries.length === 0 ? (
                        <div className="text-center text-gray-500 py-8">No saved queries yet.</div>
                    ) : (
                        <div className="space-y-2">
                            {filteredQueries.map(q => (
                                <div key={q.id} className="bg-[#2a2a2a] border border-gray-700 rounded p-3 hover:border-gray-500 transition-colors group">
                                    <div className="flex justify-between items-start mb-2">
                                        <div>
                                            <div className="font-semibold text-gray-200">{q.name}</div>
                                            {q.description && <div className="text-xs text-gray-500">{q.description}</div>}
                                        </div>
                                        <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                            <button 
                                                onClick={() => { onLoadQuery(q.query); onClose(); }}
                                                className="p-1.5 bg-blue-900/30 text-blue-400 rounded hover:bg-blue-900/50"
                                                title="Load into Editor"
                                            >
                                                <Copy size={14}/>
                                            </button>
                                            <button 
                                                onClick={() => onDeleteQuery(q.id)}
                                                className="p-1.5 bg-red-900/30 text-red-400 rounded hover:bg-red-900/50"
                                                title="Delete"
                                            >
                                                <Trash2 size={14}/>
                                            </button>
                                        </div>
                                    </div>
                                    <pre className="text-[10px] text-gray-400 font-mono bg-[#111] p-2 rounded overflow-hidden max-h-16 opacity-70">
                                        {q.query}
                                    </pre>
                                </div>
                            ))}
                        </div>
                    )}
                </>
            ) : (
                <div className="space-y-4">
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Query Name</label>
                        <input 
                            type="text"
                            className="w-full bg-[#252525] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#eab308] outline-none"
                            placeholder="e.g. Active Employees"
                            value={saveName}
                            onChange={(e) => setSaveName(e.target.value)}
                            autoFocus
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Description (Optional)</label>
                        <input 
                            type="text"
                            className="w-full bg-[#252525] border border-gray-600 rounded px-3 py-2 text-white focus:border-[#eab308] outline-none"
                            placeholder="Short description..."
                            value={saveDesc}
                            onChange={(e) => setSaveDesc(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">SQL Preview</label>
                        <pre className="text-xs text-gray-400 font-mono bg-[#111] p-3 rounded overflow-auto max-h-40 border border-gray-700">
                            {currentQuery}
                        </pre>
                    </div>
                    <div className="flex gap-2 pt-4">
                        <button 
                            onClick={() => setMode('LIST')}
                            className="flex-1 px-4 py-2 bg-gray-700 text-gray-300 rounded hover:bg-gray-600"
                        >
                            Cancel
                        </button>
                        <button 
                            onClick={handleSave}
                            disabled={!saveName.trim()}
                            className="flex-1 px-4 py-2 bg-[#eab308] text-black font-bold rounded hover:bg-[#ca9a04] disabled:opacity-50"
                        >
                            Save
                        </button>
                    </div>
                </div>
            )}
        </div>
      </div>
    </div>
  );
};

export default SavedQueriesModal;