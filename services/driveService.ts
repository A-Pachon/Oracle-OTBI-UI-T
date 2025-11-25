
const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const DB_FILENAME = 'DuckOracle.sqlite';

let tokenClient: any = null;
let accessToken: string | null = null;

/**
 * Initializes the Google Identity Services Token Client
 */
export const initGoogleClient = (clientId: string, callback: (token: string) => void) => {
  if (typeof window.google === 'undefined') return;
  
  tokenClient = window.google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: SCOPES,
    callback: (response: any) => {
      if (response.error !== undefined) {
        throw response;
      }
      accessToken = response.access_token;
      callback(response.access_token);
    },
  });
};

/**
 * Triggers the Google Sign-In Popup
 */
export const signInToGoogle = (clientId: string): Promise<string> => {
  return new Promise((resolve, reject) => {
      if (!clientId) {
          reject("Client ID is missing. Please configure it in Settings.");
          return;
      }

      // Re-initialize if client ID changed or not set
      // We pass the clientId dynamically now
      initGoogleClient(clientId, (token) => resolve(token));
      
      // Small delay to ensure init finishes setting the variable (though init is synchronous usually in assigning the object)
      setTimeout(() => {
        if(tokenClient) {
            // Override callback to resolve this specific promise
            tokenClient.callback = (resp: any) => {
                if (resp.error) reject(resp.error);
                else {
                    accessToken = resp.access_token;
                    resolve(resp.access_token);
                }
            };
            // Request token
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            reject("Google Identity Services script not loaded.");
        }
      }, 50);
  });
};

/**
 * Helper for authenticated fetch
 */
const driveFetch = async (url: string, options: RequestInit = {}) => {
    if (!accessToken) throw new Error("Not signed in to Google Drive.");
    
    const headers = {
        ...options.headers,
        'Authorization': `Bearer ${accessToken}`,
    };
    
    const response = await fetch(url, { ...options, headers });
    if (!response.ok) {
        const txt = await response.text();
        throw new Error(`Drive API Error ${response.status}: ${txt}`);
    }
    return response;
};

/**
 * Find the database file ID in Drive
 */
export const findDatabaseFileId = async (): Promise<string | null> => {
    const query = `name = '${DB_FILENAME}' and trashed = false`;
    const url = `https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(query)}&fields=files(id, name)`;
    
    const res = await driveFetch(url);
    const data = await res.json();
    
    if (data.files && data.files.length > 0) {
        return data.files[0].id;
    }
    return null;
};

/**
 * Upload (Create or Update) the database file
 */
export const uploadDatabaseToDrive = async (clientId: string, blob: Blob): Promise<void> => {
    if (!accessToken) await signInToGoogle(clientId);

    const existingFileId = await findDatabaseFileId();

    const metadata = {
        name: DB_FILENAME,
        mimeType: 'application/x-sqlite3',
    };

    const form = new FormData();
    form.append('metadata', new Blob([JSON.stringify(metadata)], { type: 'application/json' }));
    form.append('file', blob);

    if (existingFileId) {
        // Update existing file (PATCH)
        const updateUrl = `https://www.googleapis.com/upload/drive/v3/files/${existingFileId}?uploadType=multipart`;
        await driveFetch(updateUrl, {
            method: 'PATCH',
            body: form
        });
        console.log("Drive: File updated successfully.");
    } else {
        // Create new file (POST)
        const createUrl = 'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart';
        await driveFetch(createUrl, {
            method: 'POST',
            body: form
        });
        console.log("Drive: File created successfully.");
    }
};

/**
 * Download the database file
 */
export const downloadDatabaseFromDrive = async (clientId: string): Promise<Blob> => {
    if (!accessToken) await signInToGoogle(clientId);

    const fileId = await findDatabaseFileId();
    if (!fileId) throw new Error("Database file not found in Google Drive.");

    const url = `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`;
    const res = await driveFetch(url);
    return await res.blob();
};
