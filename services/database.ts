import { initializeApp, FirebaseApp } from "firebase/app";
import { 
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  doc, 
  setDoc, 
  getDoc, 
  updateDoc,
  arrayUnion,
  Firestore
} from "firebase/firestore";
import { firebaseConfig } from "../firebaseConfig";
import { isKeyAllowed } from "./dbKeyPolicy";
import { readLocalCache, writeLocalCache } from "./localCache";

let app: FirebaseApp | null = null;
export let db: Firestore | null = null;

const isFirebaseConfigured = firebaseConfig.apiKey && !firebaseConfig.apiKey.includes("VOTRE_CLE");

if (isFirebaseConfigured) {
  try {
    app = initializeApp(firebaseConfig);
    
    // Activation de la persistance hors-ligne pour éviter les erreurs réseaux
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
      ignoreUndefinedProperties: true 
    });

  } catch (e) {
    console.error("Erreur d'initialisation Firebase:", e);
  }
}

// Fonction utilitaire pour assainir les objets (retirer undefined, conserver null)
const sanitizeForFirestore = (obj: any): any => {
  if (obj === undefined || obj === null || obj instanceof Date) return obj;
  if (Array.isArray(obj)) {
    return obj.filter(v => v !== undefined);
  }
  if (typeof obj === 'object') {
    const out: any = {};
    for (const [k, v] of Object.entries(obj)) {
      if (v !== undefined) out[k] = v;
    }
    return out;
  }
  return obj;
};

const pendingSyncKey = (key: string) => `diversifia_pending_sync_${key}`;

const markPendingSync = (key: string, updatedAt: string) => {
  try {
    localStorage.setItem(pendingSyncKey(key), updatedAt);
  } catch (e) {}
};

const clearPendingSync = (key: string) => {
  try {
    localStorage.removeItem(pendingSyncKey(key));
  } catch (e) {}
};


const validateKey = (key: string) => {
  if (!isKeyAllowed(key)) {
    console.warn(`[DATA] Clé non supportée: ${key}`);
    return false;
  }
  return true;
};


// Fonction spéciale pour ajouter un élément à une liste sans écraser le reste (Atomic)
export const addArrayItem = async (key: string, item: any) => {
  if (!validateKey(key)) return false;
  // CRITIQUE : On nettoie l'objet avant l'envoi. Firebase rejette les 'undefined' dans les tableaux.
  const cleanItem = sanitizeForFirestore(item);

  if (!db) {
     // Fallback si pas de DB
     const current = await getCloudData(key) || [];
     const updated = [cleanItem, ...current];
     return saveCloudData(key, updated);
  }
  
  try {
    const docRef = doc(db, "diversifia_store", key);
    // arrayUnion ajoute l'élément uniquement, sans toucher aux autres données
    await updateDoc(docRef, {
      payload: arrayUnion(cleanItem),
      updatedAt: new Date().toISOString()
    });
    return true;
  } catch (e: any) {
    console.warn("Echec arrayUnion (doc inexistant ?), tentative création:", e);
    // Si le document n'existe pas encore, on le crée
    try {
        const docRef = doc(db, "diversifia_store", key);
        await setDoc(docRef, { 
            payload: [cleanItem], 
            updatedAt: new Date().toISOString() 
        }, { merge: true });
        return true;
    } catch (err) {
        console.error("Echec total sauvegarde:", err);
        return false;
    }
  }
};

export const saveCloudData = async (key: string, data: any) => {
  if (!key || !validateKey(key)) return false;
  
  const cleanData = sanitizeForFirestore(data);
  const updatedAt = new Date().toISOString();
  const storageObj = { payload: cleanData, updatedAt };

  let localSuccess = false;

  // 1. Sauvegarde Prioritaire LocalStorage (Backup)
  writeLocalCache(key, storageObj);
  localSuccess = true;

  // 2. Tentative Sauvegarde Cloud
  if (db) {
    try {
      const docRef = doc(db, "diversifia_store", key);
      await setDoc(docRef, storageObj, { merge: true });
      clearPendingSync(key);
      return true; // Succès total
    } catch (e: any) {
      console.error(`[CLOUD ERROR] Echec sauvegarde Cloud ${key}:`, e);
      if (localSuccess) markPendingSync(key, updatedAt);
      // Si Cloud échoue mais Local OK, on retourne true pour ne pas bloquer l'utilisateur
      return localSuccess; 
    }
  }

  if (localSuccess) markPendingSync(key, updatedAt);
  return localSuccess;
};

export const getCloudData = async (key: string) => {
  if (!key || !validateKey(key)) return null;

  // Lecture Backup Local
  const localData = readLocalCache(key);

  if (db) {
    try {
      const docRef = doc(db, "diversifia_store", key);
      // getDoc lit le cache Firestore si hors ligne
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const cloudData = docSnap.data();
        if (cloudData && cloudData.payload) {
          const cloudUpdatedAt = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
          const localUpdatedAt = localData?.updatedAt ? new Date(localData.updatedAt).getTime() : 0;

          // Cloud-first, mais on évite d'écraser un cache local plus récent.
          if (localUpdatedAt <= cloudUpdatedAt) {
            writeLocalCache(key, cloudData);
          }
          return cloudData.payload;
        }
      }
    } catch (e) {
      console.warn(`[CLOUD] Lecture impossible pour ${key}, fallback local.`);
    }
  }

  return localData ? localData.payload : null;
};

// Récupère la donnée cache/local ou cloud, sans resynchronisation automatique.
export const getCachedData = async (key: string) => {
  if (!key || !validateKey(key)) return null;

  const localData = readLocalCache(key);

  let cloudData: any = null;
  if (db) {
    try {
      const docRef = doc(db, "diversifia_store", key);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        cloudData = docSnap.data();
      }
    } catch (e) {
      console.warn(`[CLOUD] Lecture impossible pour ${key}, fallback local.`);
    }
  }

  const hasCloud = cloudData && cloudData.payload;
  const hasLocal = localData && localData.payload;

  if (!hasCloud && hasLocal) return localData.payload;
  if (hasCloud && !hasLocal) {
    writeLocalCache(key, cloudData);
    return cloudData.payload;
  }
  if (!hasCloud && !hasLocal) return null;

  const cloudUpdatedAt = cloudData.updatedAt ? new Date(cloudData.updatedAt).getTime() : 0;
  const localUpdatedAt = localData.updatedAt ? new Date(localData.updatedAt).getTime() : 0;

  if (localUpdatedAt > cloudUpdatedAt) {
    if (localData?.updatedAt) {
      markPendingSync(key, localData.updatedAt);
    }
    return localData.payload;
  }

  writeLocalCache(key, cloudData);
  return cloudData.payload;
};

export const isOnline = () => {
  return typeof navigator !== "undefined" ? navigator.onLine : true;
};

export const safeJSON = (data: any) => {
  try {
    return JSON.stringify(data, null, 2);
  } catch (e) {
    return String(data);
  }
};













