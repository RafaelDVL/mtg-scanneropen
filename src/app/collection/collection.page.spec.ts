import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { CollectionPage } from './collection.page';
import { DatabaseService, Collection, CollectionCard } from '../services/database.service';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular/standalone';

describe('CollectionPage', () => {
  let component: CollectionPage;
  let fixture: ComponentFixture<CollectionPage>;
  let mockDbService: jasmine.SpyObj<DatabaseService>;
  let mockRouter: jasmine.SpyObj<Router>;
  let mockAlertCtrl: jasmine.SpyObj<AlertController>;

  beforeEach(async () => {
    mockDbService = jasmine.createSpyObj('DatabaseService', [
      'getAllCollections',
      'getCardsInCollection',
      'createCollection',
    ]);
    mockRouter = jasmine.createSpyObj('Router', ['navigate']);
    mockAlertCtrl = jasmine.createSpyObj('AlertController', ['create']);

    await TestBed.configureTestingModule({
      imports: [CollectionPage],
      providers: [
        { provide: DatabaseService, useValue: mockDbService },
        { provide: Router, useValue: mockRouter },
        { provide: AlertController, useValue: mockAlertCtrl }
      ]
    }).compileComponents();

    fixture = TestBed.createComponent(CollectionPage);
    component = fixture.componentInstance;
  });

  it('should calculate cardCount and totalPrice correctly for empty collections', fakeAsync(() => {
    const mockCollections: Collection[] = [{ id: 1, name: 'Empty', created_at: '2023-01-01' }];
    mockDbService.getAllCollections.and.returnValue(Promise.resolve(mockCollections));
    mockDbService.getCardsInCollection.and.returnValue(Promise.resolve([]));

    component.ngOnInit();
    tick();

    expect(component.collections.length).toBe(1);
    expect(component.collections[0].cardCount).toBe(0);
    expect(component.collections[0].totalPrice).toBe(0);
  }));

  it('should calculate cardCount and totalPrice correctly for populated collections', fakeAsync(() => {
    const mockCollections: Collection[] = [{ id: 1, name: 'Populated', created_at: '2023-01-01' }];
    const mockCards: CollectionCard[] = [
      { id: 1, collection_id: 1, scryfall_id: 'a', name: 'Card 1', set_code: 'set1', collector_number: '1', qty: 2, is_foil: false, scanned_at: 'now', price_usd: 1.50 },
      { id: 2, collection_id: 1, scryfall_id: 'b', name: 'Card 2', set_code: 'set1', collector_number: '2', qty: 1, is_foil: false, scanned_at: 'now', price_usd: 3.00 },
      { id: 3, collection_id: 1, scryfall_id: 'c', name: 'Card 3', set_code: 'set1', collector_number: '3', qty: 3, is_foil: false, scanned_at: 'now' } // no price
    ];

    mockDbService.getAllCollections.and.returnValue(Promise.resolve(mockCollections));
    mockDbService.getCardsInCollection.and.returnValue(Promise.resolve(mockCards));

    component.ngOnInit();
    tick();

    expect(component.collections.length).toBe(1);
    expect(component.collections[0].cardCount).toBe(6); // 2 + 1 + 3
    expect(component.collections[0].totalPrice).toBe(6.00); // (2 * 1.50) + (1 * 3.00) + (3 * 0)
  }));
});
