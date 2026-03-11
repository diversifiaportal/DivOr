const localWriteQueue = new Map<string, string>();
let localWriteTimer: number | null = null;

const flushLocalWrites = () => {
  localWriteTimer = null;
  for (const [k, v] of localWriteQueue.entries()) {
    try {
      localStorage.setItem(k, v);
    } catch (e) {
      console.warn("LocalStorage error:", e);
    }
  }
  localWriteQueue.clear();
};

const scheduleLocalWrite = (key: string, value: string) => {
  localWriteQueue.set(key, value);
  if (localWriteTimer === null) {
    localWriteTimer = window.setTimeout(flushLocalWrites, 0);
  }
};

if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', flushLocalWrites);
}

export const readLocalCache = (key: string) => {
  try {
    const localRaw = localStorage.getItem(`diversifia_db_${key}`);
    return localRaw ? JSON.parse(localRaw) : null;
  } catch (e) {
    return null;
  }
};

export const writeLocalCache = (key: string, data: any) => {
  try {
    scheduleLocalWrite(`diversifia_db_${key}`, JSON.stringify(data));
  } catch (e) {
    console.warn("LocalStorage error:", e);
  }
};
