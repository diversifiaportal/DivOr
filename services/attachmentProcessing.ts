const compressOnMain = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 1024;
        const MAX_HEIGHT = 1024;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob((blob) => {
          if (!blob) {
            reject(new Error('Compression échouée'));
            return;
          }
          const outReader = new FileReader();
          outReader.onload = () => resolve(outReader.result as string);
          outReader.onerror = (err) => reject(err);
          outReader.readAsDataURL(blob);
        }, 'image/jpeg', 0.7);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
};

let compressWorker: Worker | null = null;
let compressWorkerSeq = 0;
const compressWorkerCallbacks = new Map<number, { resolve: (v: string) => void; reject: (e: any) => void }>();

const getCompressWorker = () => {
  if (compressWorker) return compressWorker;
  if (typeof Worker === 'undefined' || typeof OffscreenCanvas === 'undefined') return null;

  const workerCode = `
self.onmessage = async (e) => {
  const { id, buffer, type } = e.data;
  try {
    const blob = new Blob([buffer], { type });
    const bitmap = await createImageBitmap(blob);
    const MAX_WIDTH = 1024;
    const MAX_HEIGHT = 1024;
    let width = bitmap.width;
    let height = bitmap.height;
    if (width > height) {
      if (width > MAX_WIDTH) {
        height *= MAX_WIDTH / width;
        width = MAX_WIDTH;
      }
    } else {
      if (height > MAX_HEIGHT) {
        width *= MAX_HEIGHT / height;
        height = MAX_HEIGHT;
      }
    }
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(bitmap, 0, 0, width, height);
    const outBlob = await canvas.convertToBlob({ type: 'image/jpeg', quality: 0.7 });
    const outBuffer = await outBlob.arrayBuffer();
    self.postMessage({ id, buffer: outBuffer }, [outBuffer]);
  } catch (err) {
    self.postMessage({ id, error: err && err.message ? err.message : 'Compression échouée' });
  }
};
`;

  const blob = new Blob([workerCode], { type: 'application/javascript' });
  compressWorker = new Worker(URL.createObjectURL(blob));
  compressWorker.onmessage = (e) => {
    const { id, buffer, error } = e.data || {};
    const cb = compressWorkerCallbacks.get(id);
    if (!cb) return;
    compressWorkerCallbacks.delete(id);
    if (error) {
      cb.reject(new Error(error));
      return;
    }
    const outBlob = new Blob([buffer], { type: 'image/jpeg' });
    const outReader = new FileReader();
    outReader.onload = () => cb.resolve(outReader.result as string);
    outReader.onerror = (err) => cb.reject(err);
    outReader.readAsDataURL(outBlob);
  };
  return compressWorker;
};

const compressWithWorker = async (file: File) => {
  const worker = getCompressWorker();
  if (!worker) return null;

  const buffer = await file.arrayBuffer();
  return new Promise<string>((resolve, reject) => {
    const id = ++compressWorkerSeq;
    compressWorkerCallbacks.set(id, { resolve, reject });
    worker.postMessage({ id, buffer, type: file.type }, [buffer]);
  });
};

export const compressImage = async (file: File): Promise<string> => {
  try {
    const result = await compressWithWorker(file);
    if (result) return result;
  } catch (e) {
    // Fallback on main thread
  }
  return compressOnMain(file);
};

export const fileToDataUrl = async (file: File) => {
  if (file.type.startsWith('image/')) {
    return compressImage(file);
  }

  return new Promise<string>((resolve) => {
    const reader = new FileReader();
    reader.onload = (ev) => resolve(ev.target?.result as string);
    reader.readAsDataURL(file);
  });
};
