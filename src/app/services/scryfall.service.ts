import { Injectable } from '@angular/core';

export interface ScryfallCard {
  id: string;
  oracle_id: string;
  name: string;
  set: string;
  set_name: string;
  collector_number: string;
  rarity: string;
  image_uris?: {
    normal: string;
    large: string;
    art_crop: string;
  };
  card_faces?: Array<{
    image_uris?: {
      normal: string;
      large: string;
      art_crop: string;
    };
  }>;
  type_line: string;
  mana_cost: string;
  lang: string;
  prices?: {
    usd?: string | null;
    usd_foil?: string | null;
    eur?: string | null;
    eur_foil?: string | null;
    tix?: string | null;
  };
}

interface CacheEntry {
  data: ScryfallCard;
  timestamp: number;
}

@Injectable({
  providedIn: 'root',
})
export class ScryfallService {
  private cache = new Map<string, CacheEntry>();
  private lastRequestTime = 0;
  private throttlePromise: Promise<void> = Promise.resolve();
  private readonly MIN_INTERVAL_MS = 100;
  private readonly USER_AGENT = 'MTGScannerOpen/1.0 (github.com/rafaelmachadobr/mtg-scanneropen)';

  private getHeaders(): Record<string, string> {
    return {
      'User-Agent': this.USER_AGENT,
      Accept: 'application/json',
    };
  }

  private throttle(): Promise<void> {
    this.throttlePromise = this.throttlePromise.then(async () => {
      const now = Date.now();
      const elapsed = now - this.lastRequestTime;
      if (elapsed < this.MIN_INTERVAL_MS) {
        await new Promise((r) => setTimeout(r, this.MIN_INTERVAL_MS - elapsed));
      }
      this.lastRequestTime = Date.now();
    });
    return this.throttlePromise;
  }

  private getCacheKey(set: string, collectorNumber: string): string {
    return `${set.toLowerCase()}/${collectorNumber}`;
  }

  private getFromCache(key: string): ScryfallCard | null {
    const entry = this.cache.get(key);
    if (entry && Date.now() - entry.timestamp < 3600000) {
      return entry.data;
    }
    this.cache.delete(key);
    return null;
  }

  private setCache(key: string, data: ScryfallCard): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async lookupBySetAndNumber(set: string, collectorNumber: string): Promise<ScryfallCard | null> {
    const key = this.getCacheKey(set, collectorNumber);
    const cached = this.getFromCache(key);
    if (cached) return cached;

    await this.throttle();
    try {
      const response = await fetch(`https://api.scryfall.com/cards/${encodeURIComponent(set)}/${encodeURIComponent(collectorNumber)}`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) return null;
      const data: ScryfallCard = await response.json();
      this.setCache(key, data);
      return data;
    } catch {
      return null;
    }
  }

  async lookupByNameFuzzy(name: string): Promise<ScryfallCard | null> {
    await this.throttle();
    try {
      const response = await fetch(`https://api.scryfall.com/cards/named?fuzzy=${encodeURIComponent(name)}`, {
        headers: this.getHeaders(),
      });
      if (!response.ok) return null;
      const data: ScryfallCard = await response.json();
      return data;
    } catch {
      return null;
    }
  }

  getCardImageUrl(card: ScryfallCard): string | null {
    if (card.image_uris?.normal) return card.image_uris.normal;
    if (card.card_faces?.[0]?.image_uris?.normal) return card.card_faces[0].image_uris.normal;
    return null;
  }
}
