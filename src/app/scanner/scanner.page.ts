import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { CameraPreview } from '@capacitor-community/camera-preview';
import { Ocr, RecognitionResult } from '@jcesarmobile/capacitor-ocr';
import { ScryfallService, ScryfallCard } from '../services/scryfall.service';
import { DatabaseService, Collection, CollectionCard } from '../services/database.service';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonButton, IonIcon, IonCard, IonCardContent, IonCardHeader, IonCardTitle, IonCardSubtitle, IonText, IonSpinner, IonBadge, IonButtons, IonLabel } from '@ionic/angular/standalone';
import { NgIf } from '@angular/common';
import { UpperCasePipe } from '@angular/common';
import { AlertController } from '@ionic/angular/standalone';
import { addIcons } from 'ionicons';
import { camera, cameraOutline, scanOutline } from 'ionicons/icons';

interface ParsedOcrResult {
  collectorNumber?: string;
  setCode?: string;
  rawLines: string[];
}

interface ScanResult {
  card: ScryfallCard | null;
  imageUrl: string;
  photoUri: string;
  confidence: 'high' | 'medium' | 'low';
}

const LANGUAGE_BLACKLIST = new Set(['EN', 'PT', 'ES', 'FR', 'DE', 'IT', 'JA', 'KO', 'RU', 'ZH', 'HE']);

@Component({
  selector: 'app-scanner',
  templateUrl: 'scanner.page.html',
  styleUrls: ['scanner.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonButton, IonIcon, IonCard, IonCardContent,
    IonCardHeader, IonCardTitle, IonCardSubtitle,
    IonText, IonSpinner, IonBadge, IonButtons, IonLabel,
    NgIf, UpperCasePipe,
  ],
})
export class ScannerPage implements OnInit, OnDestroy {
  previewActive = false;
  scanResult: ScanResult | null = null;
  loading = false;
  error = '';
  totalCards = 0;

  constructor(
    private router: Router,
    private scryfall: ScryfallService,
    private db: DatabaseService,
    private alertCtrl: AlertController
  ) {
    addIcons({ camera, cameraOutline, scanOutline });
  }

  async ngOnInit() {
    await this.loadTotal();
  }

  async ionViewWillEnter() {
    await this.startPreview();
  }

  async ionViewWillLeave() {
    await this.stopPreview();
  }

  ngOnDestroy() {
    this.stopPreview();
  }

  private async startPreview() {
    if (this.previewActive) return;
    try {
      await CameraPreview.start({
        position: 'rear',
        toBack: true,
        enableZoom: true,
      });
      this.previewActive = true;
    } catch (e) {
      console.error('Preview start failed:', e);
    }
  }

  private async stopPreview() {
    if (!this.previewActive) return;
    try {
      await CameraPreview.stop();
      this.previewActive = false;
    } catch (e) {
      console.error('Preview stop failed:', e);
    }
  }

  private async loadTotal() {
    try {
      this.totalCards = await this.db.getTotalCardCount();
    } catch {}
  }

  async capturePhoto() {
    this.scanResult = null;
    this.error = '';
    this.loading = true;

    try {
      const captured = await CameraPreview.capture({ quality: 90 });
      await this.stopPreview();
      const base64 = captured.value;
      const dataUri = `data:image/jpeg;base64,${base64}`;

      await this.runOcr(dataUri);
    } catch (e) {
      this.error = 'Erro ao capturar foto';
      console.error(e);
    } finally {
      this.loading = false;
    }
  }

  private async runOcr(photoUri: string) {
    try {
      const result = await Ocr.process({ image: photoUri });
      const items = result.results.map((r: RecognitionResult) => r.text.trim()).filter((t: string) => t.length > 0);

      console.log('OCR items:', items);

      if (items.length === 0) {
        this.error = 'Nenhum texto detectado. Tente novamente com melhor iluminação.';
        return;
      }

      const parsed = this.parseOcrItems(items);

      if (parsed.setCode && parsed.collectorNumber) {
        const card = await this.scryfall.lookupBySetAndNumber(parsed.setCode, parsed.collectorNumber);
        if (card) {
          const imageUrl = this.scryfall.getCardImageUrl(card) || photoUri;
          this.scanResult = { card, imageUrl, photoUri, confidence: 'high' };
          return;
        }
      }

      const fuzzyName = this.buildFuzzyName(items, parsed);
      if (fuzzyName) {
        const card = await this.scryfall.lookupByNameFuzzy(fuzzyName);
        if (card) {
          const imageUrl = this.scryfall.getCardImageUrl(card) || photoUri;
          this.scanResult = { card, imageUrl, photoUri, confidence: 'medium' };
          return;
        }
      }

      this.error = `Não foi possível identificar a carta.\nTexto detectado: ${items.join(' | ')}`;
    } catch (e) {
      this.error = 'Erro no OCR. Tente novamente.';
      console.error(e);
    }
  }

  private parseOcrItems(items: string[]): ParsedOcrResult {
    let collectorNumber: string | undefined;
    let setCode: string | undefined;

    for (const item of items) {
      const clean = item.replace(/[•·●■\-_]/g, ' ').trim();

      const digits = clean.match(/(\d{3,4})/);
      if (digits && !collectorNumber) {
        collectorNumber = digits[1];
      }

      const setMatch = clean.match(/^([A-Z0-9]{2,6})(?:\s+[A-Z]{2})?$/);
      if (setMatch && !setCode && setMatch[1].length >= 2) {
        setCode = setMatch[1];
      }
    }

    return { collectorNumber, setCode, rawLines: items };
  }

  private buildFuzzyName(items: string[], parsed: ParsedOcrResult): string | null {
    for (const item of items) {
      const t = item.replace(/[•·●■\-_]/g, ' ').trim();
      if (t.length > 3 && !/^\d/.test(t)) {
        const upper = t.toUpperCase();
        if (!LANGUAGE_BLACKLIST.has(upper) && upper !== parsed.setCode && upper !== parsed.collectorNumber) {
          return t;
        }
      }
    }
    return null;
  }

  async confirmAddCard() {
    const card = this.scanResult?.card;
    if (!card) return;

    const collections = await this.db.getAllCollections();

    if (collections.length === 0) {
      this.promptNewCollection(card);
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Adicionar a coleção',
      inputs: [
        ...collections.map((c) => ({
          label: c.name,
          value: c.id,
          type: 'radio' as const,
        })),
        {
          label: 'Nova coleção...',
          value: -1,
          type: 'radio' as const,
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'OK',
          handler: (data: number) => {
            if (data === -1) {
              this.promptNewCollection(card);
            } else if (data) {
              this.addCardToCollection(data, card);
            }
          },
        },
      ],
    });
    await alert.present();
  }

  private async promptNewCollection(card: ScryfallCard) {
    const alert = await this.alertCtrl.create({
      header: 'Nova coleção',
      inputs: [{ name: 'name', placeholder: 'Nome da coleção', type: 'text' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Criar',
          handler: async (data) => {
            if (!data.name?.trim()) return;
            const id = await this.db.createCollection(data.name.trim());
            await this.addCardToCollection(id, card);
          },
        },
      ],
    });
    await alert.present();
  }

  private async addCardToCollection(collectionId: number, card: ScryfallCard) {
    const existing = await this.db.getCardInCollection(collectionId, card.id);

    if (existing) {
      const alert = await this.alertCtrl.create({
        header: 'Carta já existe',
        message: 'Esta carta já está na coleção. Deseja adicionar mais 1?',
        buttons: [
          { text: 'Cancelar', role: 'cancel' },
          {
            text: 'Adicionar',
            handler: async () => {
              await this.db.incrementCardQuantity(collectionId, existing.id!);
              this.totalCards++;
              this.resetAfterAdd();
            },
          },
        ],
      });
      await alert.present();
      return;
    }

    const entry: Omit<CollectionCard, 'id' | 'collection_id'> = {
      scryfall_id: card.id,
      name: card.name,
      set_code: card.set,
      collector_number: card.collector_number,
      qty: 1,
      is_foil: false,
      scanned_at: new Date().toISOString(),
      image_url: this.scryfall.getCardImageUrl(card) || undefined,
      price_usd: card.prices?.usd ? parseFloat(card.prices.usd) : undefined,
    };
    await this.db.addCardToCollection(collectionId, entry);
    this.totalCards++;
    this.resetAfterAdd();
  }

  private resetAfterAdd() {
    this.scanResult = null;
    this.error = '';
    this.loading = false;
    this.startPreview();
  }

  retry() {
    this.scanResult = null;
    this.error = '';
    this.loading = false;
    this.startPreview();
  }

  goToCollection() {
    this.router.navigate(['/collection']);
  }
}
