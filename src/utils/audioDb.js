const DB_NAME = 'nocturne_audio';
const DB_VERSION = 1;
const AUDIO_STORE = 'tracks';
const COVER_STORE = 'covers';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains(AUDIO_STORE)) {
        db.createObjectStore(AUDIO_STORE, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(COVER_STORE)) {
        db.createObjectStore(COVER_STORE, { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => resolve(e.target.result);
    request.onerror = (e) => reject(e.target.error);
  });
}

export async function saveAudioBlob(trackId, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).put({ id: trackId, blob, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getAudioBlob(trackId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const req = tx.objectStore(AUDIO_STORE).get(trackId);
    req.onsuccess = (e) => resolve(e.target.result?.blob || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function deleteAudioBlob(trackId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readwrite');
    tx.objectStore(AUDIO_STORE).delete(trackId);
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function saveCoverBlob(trackId, blob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COVER_STORE, 'readwrite');
    tx.objectStore(COVER_STORE).put({ id: trackId, blob, savedAt: Date.now() });
    tx.oncomplete = () => resolve();
    tx.onerror = (e) => reject(e.target.error);
  });
}

export async function getCoverBlob(trackId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(COVER_STORE, 'readonly');
    const req = tx.objectStore(COVER_STORE).get(trackId);
    req.onsuccess = (e) => resolve(e.target.result?.blob || null);
    req.onerror = (e) => reject(e.target.error);
  });
}

export async function getAllStoredTracks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(AUDIO_STORE, 'readonly');
    const req = tx.objectStore(AUDIO_STORE).getAll();
    req.onsuccess = (e) => resolve(e.target.result || []);
    req.onerror = (e) => reject(e.target.error);
  });
}

export function blobToUrl(blob) {
  if (!blob) return null;
  return URL.createObjectURL(blob);
}
