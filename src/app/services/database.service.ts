import { Injectable } from '@angular/core';

export interface Collection {
  id?: number;
  name: string;
  created_at: string;
}

export interface CollectionCard {
  id?: number;
  collection_id: number;
  scryfall_id: string;
  name: string;
  set_code: string;
  collector_number: string;
  qty: number;
  is_foil: boolean;
  scanned_at: string;
  image_url?: string;
  price_usd?: number;
}

@Injectable({
  providedIn: 'root',
})
export class DatabaseService {
  private dbName = 'mtg_scanner';
  private db: IDBDatabase | null = null;
  private initPromise: Promise<void> | null = null;

  constructor() {
    this.initPromise = this.initDB();
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 2);
      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result;
        const oldVersion = event.oldVersion;

        if (oldVersion === 1) {
          if (db.objectStoreNames.contains('collection')) {
            db.deleteObjectStore('collection');
          }
        }

        if (!db.objectStoreNames.contains('collections')) {
          db.createObjectStore('collections', { keyPath: 'id', autoIncrement: true });
        }
        if (!db.objectStoreNames.contains('collection_cards')) {
          const store = db.createObjectStore('collection_cards', { keyPath: 'id', autoIncrement: true });
          store.createIndex('by_collection', 'collection_id', { unique: false });
          store.createIndex('by_scryfall_id', 'scryfall_id', { unique: false });
          store.createIndex('by_collection_and_card', ['collection_id', 'scryfall_id'], { unique: true });
        }
      };
      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result;
        resolve();
      };
      request.onerror = () => reject(request.error);
    });
  }

  private async ensureDB(): Promise<IDBDatabase> {
    if (this.db) return this.db;
    await this.initPromise;
    return this.db!;
  }

  async getAllCollections(): Promise<Collection[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readonly');
      const store = tx.objectStore('collections');
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async createCollection(name: string): Promise<number> {
    const db = await this.ensureDB();
    const entry: Collection = { name, created_at: new Date().toISOString() };
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readwrite');
      const store = tx.objectStore('collections');
      const request = store.add(entry);
      request.onsuccess = () => resolve(request.result as number);
      request.onerror = () => reject(request.error);
    });
  }

  async getCollection(id: number): Promise<Collection | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collections', 'readonly');
      const store = tx.objectStore('collections');
      const request = store.get(id);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCardsInCollection(collectionId: number): Promise<CollectionCard[]> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collection_cards', 'readonly');
      const store = tx.objectStore('collection_cards');
      const index = store.index('by_collection');
      const request = index.getAll(collectionId);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getCardInCollection(collectionId: number, scryfallId: string): Promise<CollectionCard | undefined> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collection_cards', 'readonly');
      const store = tx.objectStore('collection_cards');
      const index = store.index('by_collection_and_card');
      const request = index.get([collectionId, scryfallId]);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async addCardToCollection(collectionId: number, card: Omit<CollectionCard, 'id' | 'collection_id'>): Promise<'added'> {
    const existing = await this.getCardInCollection(collectionId, card.scryfall_id);
    if (existing) {
      existing.qty += card.qty;
      await this.updateCard(existing);
      return 'added';
    }
    const entry: CollectionCard = { ...card, collection_id: collectionId };
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collection_cards', 'readwrite');
      const store = tx.objectStore('collection_cards');
      const request = store.add(entry);
      request.onsuccess = () => resolve('added');
      request.onerror = () => reject(request.error);
    });
  }

  private async updateCard(card: CollectionCard): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collection_cards', 'readwrite');
      const store = tx.objectStore('collection_cards');
      const request = store.put(card);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async incrementCardQuantity(collectionId: number, cardId: number): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collection_cards', 'readwrite');
      const store = tx.objectStore('collection_cards');
      const request = store.get(cardId);
      request.onsuccess = () => {
        const card = request.result;
        if (card) {
          card.qty++;
          store.put(card);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async decrementCardQuantity(collectionId: number, cardId: number): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collection_cards', 'readwrite');
      const store = tx.objectStore('collection_cards');
      const request = store.get(cardId);
      request.onsuccess = () => {
        const card = request.result;
        if (card) {
          card.qty = Math.max(0, card.qty - 1);
          store.put(card);
        }
      };
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async removeCardFromCollection(cardId: number): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collection_cards', 'readwrite');
      const store = tx.objectStore('collection_cards');
      const request = store.delete(cardId);
      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async deleteCollection(collectionId: number): Promise<void> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(['collections', 'collection_cards'], 'readwrite');
      const colStore = tx.objectStore('collections');
      colStore.delete(collectionId);
      
      const cardStore = tx.objectStore('collection_cards');
      const cardIndex = cardStore.index('by_collection');
      const range = IDBKeyRange.only(collectionId);
      const cursorReq = cardIndex.openCursor(range);
      
      cursorReq.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result;
        if (cursor) {
          cursor.delete();
          cursor.continue();
        }
      };
      
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  }

  async getTotalCardCount(): Promise<number> {
    const db = await this.ensureDB();
    return new Promise((resolve, reject) => {
      const tx = db.transaction('collection_cards', 'readonly');
      const store = tx.objectStore('collection_cards');
      const request = store.openCursor();
      let total = 0;

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue>).result;
        if (cursor) {
          total += cursor.value.qty;
          cursor.continue();
        } else {
          resolve(total);
        }
      };

      request.onerror = () => reject(request.error);
    });
  }
}
