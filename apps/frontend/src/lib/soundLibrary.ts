export type CustomSound = { id: string; name: string };

const DB_NAME = "zabbix-portal-sounds";
const STORE = "sounds";

const openDB = (): Promise<IDBDatabase> =>
  new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "id" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

export const listSounds = async (): Promise<CustomSound[]> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () =>
      resolve(
        (req.result as Array<{ id: string; name: string }>).map(({ id, name }) => ({ id, name })),
      );
    req.onerror = () => reject(req.error);
  });
};

export const addSound = async (name: string, file: File): Promise<string> => {
  const db = await openDB();
  const id = crypto.randomUUID();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).add({ id, name, blob: file });
    tx.oncomplete = () => resolve(id);
    tx.onerror = () => reject(tx.error);
  });
};

export const deleteSound = async (id: string): Promise<void> => {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
};

export const playSoundById = async (id: string): Promise<HTMLAudioElement | null> => {
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(id);
    req.onsuccess = () => {
      const record = req.result as { id: string; name: string; blob: Blob } | undefined;
      if (!record) {
        resolve(null);
        return;
      }
      const url = URL.createObjectURL(record.blob);
      const audio = new Audio(url);
      audio.volume = 0.6;
      audio.onended = () => URL.revokeObjectURL(url);
      void audio
        .play()
        .then(() => resolve(audio))
        .catch(() => {
          URL.revokeObjectURL(url);
          resolve(null);
        });
    };
    req.onerror = () => resolve(null);
  });
};

// UUIDs contain hyphens; built-in preset keys never do
export const isCustomId = (key: string): boolean => key.includes("-");
