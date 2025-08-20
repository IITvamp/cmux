// IndexedDB storage for large editor content (images)
const DB_NAME = 'cmux-editor-storage';
const DB_VERSION = 1;
const STORE_NAME = 'editor-images';

interface StoredImage {
  id: string;
  src: string;
  timestamp: number;
}

class EditorStorage {
  private db: IDBDatabase | null = null;

  async init(): Promise<void> {
    if (this.db) return;

    return new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve();
      };

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        
        // Create object store for images if it doesn't exist
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
          store.createIndex('timestamp', 'timestamp', { unique: false });
        }
      };
    });
  }

  async saveImage(id: string, src: string): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const request = store.put({
        id,
        src,
        timestamp: Date.now()
      });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getImage(id: string): Promise<string | null> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.get(id);

      request.onsuccess = () => {
        const result = request.result as StoredImage | undefined;
        resolve(result?.src || null);
      };
      request.onerror = () => reject(request.error);
    });
  }

  async saveImages(images: Array<{ id: string; src: string }>): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      
      const timestamp = Date.now();
      let pending = images.length;
      
      if (pending === 0) {
        resolve();
        return;
      }

      const handleComplete = () => {
        pending--;
        if (pending === 0) resolve();
      };

      images.forEach(({ id, src }) => {
        const request = store.put({ id, src, timestamp });
        request.onsuccess = handleComplete;
        request.onerror = () => reject(request.error);
      });
    });
  }

  async getImages(ids: string[]): Promise<Map<string, string>> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    const results = new Map<string, string>();
    
    return new Promise((resolve) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readonly');
      const store = transaction.objectStore(STORE_NAME);
      
      let pending = ids.length;
      
      if (pending === 0) {
        resolve(results);
        return;
      }

      const handleComplete = () => {
        pending--;
        if (pending === 0) resolve(results);
      };

      ids.forEach(id => {
        const request = store.get(id);
        request.onsuccess = () => {
          const result = request.result as StoredImage | undefined;
          if (result?.src) {
            results.set(id, result.src);
          }
          handleComplete();
        };
        request.onerror = () => {
          console.error(`Failed to get image ${id}:`, request.error);
          handleComplete();
        };
      });
    });
  }

  async cleanupOrphanedImages(activeImageIds: Set<string>): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.openCursor();

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          const image = cursor.value as StoredImage;
          // Delete if this image ID is not in the active set
          if (!activeImageIds.has(image.id)) {
            store.delete(cursor.primaryKey);
          }
          cursor.continue();
        } else {
          resolve();
        }
      };

      request.onerror = () => reject(request.error);
    });
  }

  async clear(): Promise<void> {
    await this.init();
    if (!this.db) throw new Error('Database not initialized');

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([STORE_NAME], 'readwrite');
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }
}

export const editorStorage = new EditorStorage();