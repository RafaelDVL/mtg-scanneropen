import { TestBed } from '@angular/core/testing';
import { DatabaseService } from './database.service';

describe('DatabaseService', () => {
  let service: DatabaseService;

  beforeEach(async () => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(DatabaseService);

    // Cleanup any existing db state before test
    await (service as any).ensureDB();
    const collections = await service.getAllCollections();
    for (const c of collections) {
      await service.deleteCollection(c.id!);
    }
  });

  it('should benchmark getTotalCardCount', async () => {
    const numCollections = 50;
    const cardsPerCollection = 20;

    for (let i = 0; i < numCollections; i++) {
      const colId = await service.createCollection(`Test Col ${i}`);
      for (let j = 0; j < cardsPerCollection; j++) {
        await service.addCardToCollection(colId, {
          scryfall_id: `scry_${i}_${j}`,
          name: `Card ${j}`,
          set_code: 'test',
          collector_number: `${j}`,
          qty: 2,
          is_foil: false,
          scanned_at: new Date().toISOString()
        });
      }
    }

    const iterations = 10;
    const start = performance.now();
    let count = 0;
    for (let i = 0; i < iterations; i++) {
      count = await service.getTotalCardCount();
    }
    const end = performance.now();
    const avgTime = (end - start) / iterations;

    console.log(`\n\n[BENCHMARK] Average time: ${avgTime.toFixed(2)} ms per call`);
    console.log(`[BENCHMARK] Total count verified: ${count}\n\n`);

    expect(count).toBe(numCollections * cardsPerCollection * 2);
  });
});
