import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { DatabaseService, Collection } from '../services/database.service';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonLabel, IonButtons, IonButton, IonText, IonIcon, IonBadge, IonNote } from '@ionic/angular/standalone';
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
  collections: (Collection & { cardCount: number })[] = [];

  constructor(
    private db: DatabaseService,
    private router: Router,
    private alertCtrl: AlertController
  ) {
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
        updated.push({ ...col, cardCount });
      }
      this.collections = updated;
    } catch (e) {
      console.error('Error loading collections:', e);
    }
  }

  async createCollection() {
    const alert = await this.alertCtrl.create({
      header: 'Nova coleção',
      inputs: [{ name: 'name', placeholder: 'Nome da coleção', type: 'text' }],
      buttons: [
        { text: 'Cancelar', role: 'cancel' },
        {
          text: 'Criar',
          handler: async (data) => {
            if (!data.name?.trim()) return;
            await this.db.createCollection(data.name.trim());
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
