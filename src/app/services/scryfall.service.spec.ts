import { TestBed } from '@angular/core/testing';
import { ScryfallService, ScryfallCard } from './scryfall.service';

describe('ScryfallService', () => {
  let service: ScryfallService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(ScryfallService);
  });

  afterEach(() => {
    // Reset any spy after each test if needed
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  describe('lookupBySetAndNumber', () => {
    let fetchSpy: jasmine.Spy;

    beforeEach(() => {
      fetchSpy = spyOn(window, 'fetch');
    });

    it('should return null if fetch throws an error', async () => {
      fetchSpy.and.returnValue(Promise.reject(new Error('Network Error')));

      const result = await service.lookupBySetAndNumber('ktk', '1');

      expect(result).toBeNull();
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('should return null if fetch returns a non-ok response', async () => {
      fetchSpy.and.returnValue(Promise.resolve(new Response(null, { status: 404, statusText: 'Not Found' })));

      const result = await service.lookupBySetAndNumber('ktk', '1');

      expect(result).toBeNull();
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('should return ScryfallCard data if fetch is successful', async () => {
      const mockCard: Partial<ScryfallCard> = {
        id: '123',
        name: 'Test Card',
        set: 'ktk',
        collector_number: '1'
      };

      fetchSpy.and.returnValue(Promise.resolve(new Response(JSON.stringify(mockCard), { status: 200 })));

      const result = await service.lookupBySetAndNumber('ktk', '1');

      expect(result).toEqual(mockCard as ScryfallCard);
      expect(fetchSpy).toHaveBeenCalled();
    });

    it('should return cached data on subsequent calls', async () => {
      const mockCard: Partial<ScryfallCard> = {
        id: '123',
        name: 'Test Card',
        set: 'ktk',
        collector_number: '1'
      };

      fetchSpy.and.returnValue(Promise.resolve(new Response(JSON.stringify(mockCard), { status: 200 })));

      const result1 = await service.lookupBySetAndNumber('ktk', '1');
      expect(result1).toEqual(mockCard as ScryfallCard);
      expect(fetchSpy).toHaveBeenCalledTimes(1);

      const result2 = await service.lookupBySetAndNumber('ktk', '1');
      expect(result2).toEqual(mockCard as ScryfallCard);
      // Fetch should not be called again
      expect(fetchSpy).toHaveBeenCalledTimes(1);
    });
  });
});
