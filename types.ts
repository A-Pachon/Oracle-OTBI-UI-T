export interface ConnectionConfig {
  id: string; // Unique ID for persistence
  name: string; // Display name (e.g., "Prod HCM", "Test ERP")
  url: string;
  username: string;
  password: string;
  soapTemplate: string; 
  corsProxy?: string; 
}

export interface QueryResult {
  columns: string[];
  rows: Record<string, string>[];
  rawXml?: string;
  executionTimeMs: number;
}

export interface HistoryItem {
  id: string;
  query: string;
  timestamp: number;
  status: 'success' | 'error';
}

export enum TabView {
  TABLE = 'TABLE',
  RAW_XML = 'RAW_XML',
}

export interface SqlTab {
  id: string;
  name: string;
  query: string;
  rowLimit: number;
  result: QueryResult | null;
  error: string | null;
  isLoading: boolean;
  view: TabView;
}

export interface SavedQuery {
  id: string;
  name: string;
  query: string;
  description?: string;
}

// Global declaration for Google Identity Services
declare global {
  interface Window {
    google: any;
  }
}