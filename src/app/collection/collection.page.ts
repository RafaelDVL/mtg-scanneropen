import { Component, OnInit, inject } from '@angular/core';
import { Router } from '@angular/router';
import { DatabaseService, Collection } from '../services/database.service';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButtons, IonButton, IonText, IonIcon, IonNote } from '@ionic/angular/standalone';
import { NgFor, NgIf } from '@angular/common';
import { addIcons } from 'ionicons';
import { arrowBack, chevronForward, add } from 'ionicons/icons';
import { AlertController } from '@ionic/angular/standalone';

@Component({
  selector: 'app-collection',
  templateUrl: 'collection.page.html',
  styleUrls: ['collection.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonLabel, IonButtons, IonButton,
    IonText, IonIcon, IonNote,
    NgFor, NgIf,
  ],
})
export class CollectionPage implements OnInit {
  private db = inject(DatabaseService);
  private router = inject(Router);
  private alertCtrl = inject(AlertController);

  collections: (Collection & { cardCount: number, totalPrice: number })[] = [];

  constructor() {
    addIcons({ arrowBack, chevronForward, add });
  }

  async ngOnInit() {
    await this.loadCollections();
  }

  async ionViewWillEnter() {
    await this.loadCollections();
  }

  private async loadCollections() {
    try {
      const cols = await this.db.getAllCollections();
      const updated = [];
      for (const col of cols) {
        const cards = await this.db.getCardsInCollection(col.id!);
        const cardCount = cards.reduce((s, c) => s + c.qty, 0);
        const totalPrice = cards.reduce((s, c) => s + ((c.price_usd || 0) * c.qty), 0);
        updated.push({ ...col, cardCount, totalPrice });
      }
      this.collections = updated;
    } catch (e) {
      console.error('Error loading collections:', e);
    }
  }

  async createCollection() {
    const alert = await this.alertCtrl.create({
      header: 'Nova coleção',
      inputs: [
        {
          name: 'name',
          placeholder: 'Nome da coleção',
          type: 'text',
          attributes: {
            maxlength: 50,
            pattern: '^[a-zA-Z0-9À-ÿ\\s\\-_]+$',
          },
        },
      ],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Criar',
          handler: async (data) => {
            const trimmedName = data.name?.trim();
            if (!trimmedName) return;

            // Security Validation: prevent long inputs and special characters
            const validPattern = /^[a-zA-Z0-9À-ÿ\s\-_]+$/;
            if (trimmedName.length > 50 || !validPattern.test(trimmedName)) {
              return; // Input rejected
            }

            await this.db.createCollection(trimmedName);
            await this.loadCollections();
          },
        },
      ],
    });
    await alert.present();
  }

  openCollection(id: number) {
    this.router.navigate(['/collection', id]);
  }

  goToScanner() {
    this.router.navigate(['/home']);
  }
}
