
import React, { useState, useEffect } from 'react';
import { ConnectionConfig } from '../types';
import { DEFAULT_SOAP_TEMPLATE } from '../constants';
import { getDatabaseBlob, overwriteDatabase } from '../services/dbService';
import { uploadDatabaseToDrive, downloadDatabaseFromDrive } from '../services/driveService';
import { X, Plus, Trash2, Database, Check, Cloud, UploadCloud, DownloadCloud, Save } from 'lucide-react';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  savedConnections: ConnectionConfig[];
  activeConnectionId: string;
  onSaveConnections: (connections: ConnectionConfig[]) => void;
  onSelectConnection: (id: string) => void;
}

const emptyConfig: ConnectionConfig = {
    id: '',
    name: 'New Connection',
    url: '', // User enters base URL only
    username: '',
    password: '',
    soapTemplate: DEFAULT_SOAP_TEMPLATE,
    corsProxy: 'https://corsproxy.io'
};

const generateId = () => {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
        return crypto.randomUUID();
    }
    return Math.random().toString(36).substring(2) + Date.now().toString(36);
};

const SettingsModal: React.FC<SettingsModalProps> = ({ 
    isOpen, onClose, savedConnections, activeConnectionId, onSaveConnections, onSelectConnection 
}) => {
  
  const [connections, setConnections] = useState<ConnectionConfig[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editConfig, setEditConfig] = useState<ConnectionConfig>(emptyConfig);
  
  // Drive Settings
  const [googleClientId, setGoogleClientId] = useState('');
  
  // Sync Status
  const [syncStatus, setSyncStatus] = useState<string>('');
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setConnections(savedConnections);
      const initialId = activeConnectionId || (savedConnections.length > 0 ? savedConnections[0].id : null);
      setSelectedId(initialId);
      
      if (initialId) {
        const found = savedConnections.find(c => c.id === initialId);
        if (found) setEditConfig(found);
      } else {
        setEditConfig({ ...emptyConfig, id: generateId() });
      }

      // Load Client ID from local storage
      const storedClientId = localStorage.getItem('duckoracle_google_client_id');
      if (storedClientId) setGoogleClientId(storedClientId);
    }
  }, [isOpen, savedConnections, activeConnectionId]);

  if (!isOpen) return null;

  const handleSelect = (id: string) => {
      setSelectedId(id);
      const found = connections.find(c => c.id === id);
      if (found) setEditConfig({ ...found });
  };

  const handleNew = () => {
      const newId = generateId();
      const newConn: ConnectionConfig = { ...emptyConfig, id: newId, name: 'Untitled Connection' };
      setEditConfig(newConn);
      setSelectedId(null); 
  };

  const handleFieldChange = (field: keyof ConnectionConfig, value: string) => {
    setEditConfig(prev => ({ ...prev, [field]: value }));
  };

  const saveCurrent = () => {
      let newConns = [...connections];
      const index = newConns.findIndex(c => c.id === editConfig.id);
      
      if (index >= 0) {
          newConns[index] = editConfig;
      } else {
          newConns.push(editConfig);
      }
      
      setConnections(newConns);
      onSaveConnections(newConns);
      setSelectedId(editConfig.id);
      
      // Also save Google Client ID
      localStorage.setItem('duckoracle_google_client_id', googleClientId);

      if (newConns.length === 1) {
          onSelectConnection(editConfig.id);
      }
  };

  const deleteCurrent = () => {
      const newConns = connections.filter(c => c.id !== editConfig.id);
      setConnections(newConns);
      onSaveConnections(newConns);
      
      if (newConns.length > 0) {
          handleSelect(newConns[0].id);
      } else {
          handleNew();
      }
  };

  const setAsActive = () => {
      saveCurrent();
      onSelectConnection(editConfig.id);
      onClose();
  };

  // --- Drive Sync Handlers ---

  const handleDriveUpload = async () => {
      if (!googleClientId.trim()) {
          setSyncStatus('Error: Please enter a Google Client ID below.');
          return;
      }
      localStorage.setItem('duckoracle_google_client_id', googleClientId);

      setIsSyncing(true);
      setSyncStatus('Connecting to Google...');
      try {
          const blob = getDatabaseBlob();
          if (!blob) throw new Error("Could not export local database.");
          
          setSyncStatus('Uploading...');
          await uploadDatabaseToDrive(googleClientId, blob);
          setSyncStatus('Success! Database saved to Drive.');
          setTimeout(() => setSyncStatus(''), 3000);
      } catch (e: any) {
          console.error(e);
          setSyncStatus(`Error: ${e.message || e}`);
      } finally {
          setIsSyncing(false);
      }
  };

  const handleDriveDownload = async () => {
      if (!googleClientId.trim()) {
        setSyncStatus('Error: Please enter a Google Client ID below.');
        return;
      }
      localStorage.setItem('duckoracle_google_client_id', googleClientId);

      if(!confirm("This will overwrite your current connections and queries with the version from Google Drive. Continue?")) return;

      setIsSyncing(true);
      setSyncStatus('Downloading...');
      try {
          const blob = await downloadDatabaseFromDrive(googleClientId);
          setSyncStatus('Restoring...');
          await overwriteDatabase(blob);
          
          setSyncStatus('Success! Reloading...');
          setTimeout(() => window.location.reload(), 1000);
      } catch (e: any) {
          console.error(e);
          setSyncStatus(`Error: ${e.message || e}`);
          setIsSyncing(false);
      }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm">
      <div className="bg-[#1e1e1e] w-[950px] h-[650px] rounded-xl shadow-2xl border border-gray-700 flex overflow-hidden">
        
        {/* Sidebar */}
        <div className="w-1/3 bg-[#181818] border-r border-gray-700 flex flex-col">
            <div className="p-4 border-b border-gray-700 flex justify-between items-center">
                <h3 className="font-semibold text-gray-200">Connections</h3>
                <button onClick={handleNew} className="p-1 hover:bg-gray-700 rounded text-[#eab308]">
                    <Plus size={20}/>
                </button>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1">
                {connections.map(conn => (
                    <div 
                        key={conn.id}
                        onClick={() => handleSelect(conn.id)}
                        className={`p-3 rounded cursor-pointer flex items-center justify-between group
                            ${(selectedId === conn.id && editConfig.id === conn.id) ? 'bg-[#2a2a2a] border border-gray-600' : 'hover:bg-[#252525] border border-transparent'}
                        `}
                    >
                        <div className="flex items-center gap-3 overflow-hidden">
                            <Database size={16} className={activeConnectionId === conn.id ? "text-[#eab308]" : "text-gray-500"} />
                            <div className="truncate">
                                <div className="text-sm font-medium text-gray-200 truncate">{conn.name}</div>
                                <div className="text-xs text-gray-500 truncate">{conn.url ? new URL(conn.url.includes('http') ? conn.url : `https://${conn.url}`).hostname : 'New'}</div>
                            </div>
                        </div>
                        {activeConnectionId === conn.id && <Check size={14} className="text-[#eab308]" />}
                    </div>
                ))}
            </div>
        </div>

        {/* Main Form */}
        <div className="flex-1 flex flex-col bg-[#1e1e1e]">
             <div className="flex justify-between items-center p-4 border-b border-gray-700">
                <h2 className="text-lg font-semibold text-gray-100 flex items-center gap-2">
                    {editConfig.name || 'New Connection'}
                </h2>
                <button onClick={onClose} className="text-gray-400 hover:text-white">
                    <X size={20} />
                </button>
            </div>
            
            <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* Form Fields */}
                <div className="grid grid-cols-2 gap-4">
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Name</label>
                        <input type="text" className="w-full bg-[#252525] border border-gray-600 rounded p-2 text-white focus:border-[#eab308] outline-none" 
                            value={editConfig.name} onChange={(e) => handleFieldChange('name', e.target.value)} />
                    </div>
                    <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Oracle Instance URL (Base Domain)</label>
                        <input type="text" className="w-full bg-[#252525] border border-gray-600 rounded p-2 text-white focus:border-[#eab308] outline-none font-mono text-sm" 
                             placeholder="https://xxxx.fa.ocs.oraclecloud.com" value={editConfig.url} onChange={(e) => handleFieldChange('url', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Username</label>
                        <input type="text" className="w-full bg-[#252525] border border-gray-600 rounded p-2 text-white focus:border-[#eab308] outline-none" 
                            value={editConfig.username} onChange={(e) => handleFieldChange('username', e.target.value)} />
                    </div>
                    <div>
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Password</label>
                        <input type="password" className="w-full bg-[#252525] border border-gray-600 rounded p-2 text-white focus:border-[#eab308] outline-none" 
                            value={editConfig.password} onChange={(e) => handleFieldChange('password', e.target.value)} />
                    </div>
                     <div className="col-span-2">
                        <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">CORS Proxy</label>
                        <input type="text" className="w-full bg-[#252525] border border-gray-600 rounded p-2 text-white focus:border-[#eab308] outline-none font-mono text-sm" 
                            placeholder="https://corsproxy.io" value={editConfig.corsProxy || ''} onChange={(e) => handleFieldChange('corsProxy', e.target.value)} />
                    </div>
                </div>

                {/* Google Drive Sync Section */}
                <div className="border-t border-gray-700 pt-6 mt-6">
                    <h4 className="text-sm font-bold text-gray-200 flex items-center gap-2 mb-3">
                        <Cloud size={16} className="text-blue-400" /> Google Drive Sync
                    </h4>
                    
                    <div className="bg-[#111] border border-gray-700 rounded-lg p-4">
                        <div className="mb-4">
                            <label className="block text-xs font-semibold text-gray-500 uppercase mb-1">Google Client ID</label>
                            <input 
                                type="text" 
                                className="w-full bg-[#252525] border border-gray-600 rounded p-2 text-white focus:border-[#eab308] outline-none font-mono text-xs"
                                placeholder="ex: 123456-abcdef.apps.googleusercontent.com"
                                value={googleClientId}
                                onChange={(e) => setGoogleClientId(e.target.value)}
                            />
                            <p className="text-[10px] text-gray-500 mt-1">
                                Required: Create an OAuth Client ID in Google Cloud Console > APIs > Credentials. 
                                Add <code>{window.location.origin}</code> to Authorized JavaScript origins.
                            </p>
                        </div>

                        <div className="flex gap-3">
                             <button 
                                onClick={handleDriveUpload}
                                disabled={isSyncing}
                                className="flex-1 py-2 bg-[#252525] hover:bg-[#333] border border-gray-600 rounded text-sm text-gray-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                             >
                                <UploadCloud size={16} /> 
                                {isSyncing ? 'Syncing...' : 'Backup to Drive'}
                             </button>

                             <button 
                                onClick={handleDriveDownload}
                                disabled={isSyncing}
                                className="flex-1 py-2 bg-[#252525] hover:bg-[#333] border border-gray-600 rounded text-sm text-gray-200 flex items-center justify-center gap-2 transition-colors disabled:opacity-50"
                             >
                                <DownloadCloud size={16} />
                                {isSyncing ? 'Syncing...' : 'Restore from Drive'}
                             </button>
                        </div>
                        {syncStatus && (
                            <div className={`mt-3 text-xs font-mono p-2 rounded ${syncStatus.includes('Error') ? 'bg-red-900/30 text-red-400' : 'bg-green-900/30 text-green-400'}`}>
                                {syncStatus}
                            </div>
                        )}
                    </div>
                </div>
            </div>

            <div className="p-4 border-t border-gray-700 flex justify-between bg-[#181818]">
                <button 
                    onClick={deleteCurrent}
                    disabled={!connections.find(c => c.id === editConfig.id)}
                    className="px-4 py-2 text-red-500 hover:bg-red-900/20 rounded flex items-center gap-2 disabled:opacity-0"
                >
                    <Trash2 size={16}/> Delete
                </button>

                <div className="flex gap-2">
                    <button onClick={saveCurrent} className="px-4 py-2 text-gray-300 hover:bg-white/10 rounded flex items-center gap-2">
                        <Save size={16}/> Save
                    </button>
                    <button 
                        onClick={setAsActive} 
                        className="px-6 py-2 bg-[#eab308] text-black font-bold rounded hover:bg-[#ca9a04] transition-colors flex items-center gap-2"
                    >
                        <Check size={16} /> Connect
                    </button>
                </div>
            </div>
        </div>
      </div>
    </div>
  );
};

export default SettingsModal;
