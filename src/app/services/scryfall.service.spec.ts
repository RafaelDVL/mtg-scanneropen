import { TestBed } from '@angular/core/testing';
import { ScryfallService, ScryfallCard } from './scryfall.service';

describe('ScryfallService', () => {
  let service: ScryfallService;
  let fetchSpy: jasmine.Spy;

  const mockCard: ScryfallCard = {
    id: '123',
    oracle_id: '456',
    name: 'Black Lotus',
    set: 'lea',
    set_name: 'Limited Edition Alpha',
    collector_number: '232',
    rarity: 'rare',
    type_line: 'Artifact',
    mana_cost: '{0}',
    lang: 'en'
  };

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScryfallService);
    fetchSpy = spyOn(window, 'fetch');
  });

  afterEach(() => {
    fetchSpy.calls.reset();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('lookupBySetAndNumber', () => {
    it('should fetch card by set and collector number', async () => {
      fetchSpy.and.returnValue(Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockCard)
      } as Response));

      const card = await service.lookupBySetAndNumber('lea', '232');
      expect(card).toEqual(mockCard);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.scryfall.com/cards/lea/232',
        jasmine.objectContaining({
          headers: {
            'User-Agent': 'MTGScannerOpen/1.0 (github.com/rafaelmachadobr/mtg-scanneropen)',
            Accept: 'application/json'
          }
        })
      );
    });

    it('should cache successful responses and not fetch again', async () => {
      fetchSpy.and.returnValue(Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockCard)
      } as Response));

      const card1 = await service.lookupBySetAndNumber('lea', '232');
      expect(card1).toEqual(mockCard);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const card2 = await service.lookupBySetAndNumber('lea', '232');
      expect(card2).toEqual(mockCard);
      expect(fetchSpy).toHaveBeenCalledTimes(1); // Still 1
    });

    it('should return null if response is not ok', async () => {
      fetchSpy.and.returnValue(Promise.resolve({
        ok: false
      } as Response));

      const card = await service.lookupBySetAndNumber('lea', '999');
      expect(card).toBeNull();
    });

    it('should return null if fetch throws an exception', async () => {
      fetchSpy.and.returnValue(Promise.reject(new Error('Network error')));

      const card = await service.lookupBySetAndNumber('lea', '232');
      expect(card).toBeNull();
    });
  });
  describe('lookupByNameFuzzy', () => {
    it('should fetch card by fuzzy name', async () => {
      fetchSpy.and.returnValue(Promise.resolve({
        ok: true,
        json: () => Promise.resolve(mockCard)
      } as Response));

      const card = await service.lookupByNameFuzzy('black lotus');
      expect(card).toEqual(mockCard);
      expect(fetchSpy).toHaveBeenCalledWith(
        'https://api.scryfall.com/cards/named?fuzzy=black%20lotus',
        jasmine.objectContaining({
          headers: {
            'User-Agent': 'MTGScannerOpen/1.0 (github.com/rafaelmachadobr/mtg-scanneropen)',
            Accept: 'application/json'
          }
        })
      );
    });

    it('should return null if response is not ok', async () => {
      fetchSpy.and.returnValue(Promise.resolve({
        ok: false
      } as Response));

      const card = await service.lookupByNameFuzzy('unknown card');
      expect(card).toBeNull();
    });

    it('should return null if fetch throws an exception', async () => {
      fetchSpy.and.returnValue(Promise.reject(new Error('Network error')));

      const card = await service.lookupByNameFuzzy('black lotus');
      expect(card).toBeNull();
    });
  });
});
