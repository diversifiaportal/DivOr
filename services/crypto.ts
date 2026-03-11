const keyCache: Record<string, Promise<CryptoKey | null>> = {};
const keyInitLocks = new Map<string, Promise<CryptoKey | null>>();
const KEY_DB_NAME = 'diversifia_crypto';
const KEY_STORE = 'keys';
const KEY_DB_VERSION = 1;

const openKeyDb = () => {
  return new Promise<IDBDatabase>((resolve, reject) => {
    if (typeof indexedDB === 'undefined') {
      reject(new Error('IndexedDB indisponible'));
      return;
    }
    const request = indexedDB.open(KEY_DB_NAME, KEY_DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(KEY_STORE)) {
        db.createObjectStore(KEY_STORE);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
};

const getKeyFromDb = async (keyId: string) => {
  const db = await openKeyDb();
  return new Promise<CryptoKey | null>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readonly');
    const req = tx.objectStore(KEY_STORE).get(keyId);
    req.onsuccess = () => resolve((req.result as CryptoKey) || null);
    req.onerror = () => reject(req.error);
  });
};

const putKeyToDb = async (keyId: string, key: CryptoKey) => {
  const db = await openKeyDb();
  return new Promise<void>((resolve, reject) => {
    const tx = db.transaction(KEY_STORE, 'readwrite');
    tx.objectStore(KEY_STORE).put(key, keyId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const bytesToBase64 = (bytes: Uint8Array) => {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
};

export const base64ToBytes = (b64: string) => {
  const binary = atob(b64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
};

export const getAttachmentKey = (keyId: string) => {
  if (keyCache[keyId]) return keyCache[keyId];
  const inFlight = keyInitLocks.get(keyId);
  if (inFlight) return inFlight;

  const initPromise = (async () => {
    if (typeof crypto === 'undefined' || !crypto.subtle) return null;
    const legacyStorageKey = `diversifia_attachment_key_${keyId}`;

    try {
      const existingKey = await getKeyFromDb(keyId);
      if (existingKey) return existingKey;
    } catch (e) {}

    const legacyRaw = localStorage.getItem(legacyStorageKey);
    if (legacyRaw) {
      const keyBytes = base64ToBytes(legacyRaw);
      const imported = await crypto.subtle.importKey('raw', keyBytes, 'AES-GCM', false, ['encrypt', 'decrypt']);
      try {
        await putKeyToDb(keyId, imported);
        localStorage.removeItem(legacyStorageKey);
      } catch (e) {}
      return imported;
    }

    const newKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
    try {
      await putKeyToDb(keyId, newKey);
    } catch (e) {}
    return newKey;
  })().catch((err) => {
    console.warn('[CRYPTO] Initialisation clé échouée:', err);
    return null;
  });

  keyInitLocks.set(keyId, initPromise);
  keyCache[keyId] = initPromise;
  initPromise.finally(() => keyInitLocks.delete(keyId));

  return initPromise;
};


export type StoredAttachmentData = {
  dataUrl: string;
  enc: boolean;
  iv?: string;
};

export const encryptDataUrl = async (dataUrl: string, keyId: string): Promise<StoredAttachmentData> => {
  const key = await getAttachmentKey(keyId);
  if (!key) return { dataUrl, enc: false };

  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(dataUrl);
  const cipherBuffer = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
  return {
    dataUrl: bytesToBase64(new Uint8Array(cipherBuffer)),
    enc: true,
    iv: bytesToBase64(iv)
  };
};

export const decryptDataUrl = async (stored: StoredAttachmentData, keyId: string) => {
  if (!stored.enc) return stored.dataUrl;
  if (!stored.iv) throw new Error("IV manquant pour déchiffrement");
  const key = await getAttachmentKey(keyId);
  if (!key) throw new Error("Clé de chiffrement indisponible");

  const cipherBytes = base64ToBytes(stored.dataUrl);
  const ivBytes = base64ToBytes(stored.iv);
  const plainBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: ivBytes }, key, cipherBytes);
  return new TextDecoder().decode(plainBuffer);
};
