import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { DatabaseService, Collection, CollectionCard } from '../services/database.service';
import { IonHeader, IonToolbar, IonTitle, IonContent, IonList, IonItem, IonThumbnail, IonLabel, IonButtons, IonButton, IonText, IonIcon, IonBadge, IonItemSliding, IonItemOptions, IonItemOption } from '@ionic/angular/standalone';
import { ToastController } from '@ionic/angular/standalone';
import { Share } from '@capacitor/share';
import { Filesystem, Directory, Encoding } from '@capacitor/filesystem';
import { NgFor, NgIf, UpperCasePipe } from '@angular/common';
import { addIcons } from 'ionicons';
import { arrowBack, shareOutline } from 'ionicons/icons';

@Component({
  selector: 'app-collection-detail',
  templateUrl: 'collection-detail.page.html',
  styleUrls: ['collection-detail.page.scss'],
  imports: [
    IonHeader, IonToolbar, IonTitle, IonContent,
    IonList, IonItem, IonThumbnail, IonLabel,
    IonButtons, IonButton, IonText, IonIcon,
    IonBadge, IonItemSliding, IonItemOptions, IonItemOption,
    NgFor, NgIf, UpperCasePipe,
  ],
})
export class CollectionDetailPage implements OnInit {
  collection: Collection | null = null;
  cards: CollectionCard[] = [];
  totalQty = 0;

  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private db: DatabaseService,
    private toastCtrl: ToastController
  ) {
    addIcons({ arrowBack, shareOutline });
  }

  async ngOnInit() {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.collection = await this.db.getCollection(id) || null;
      await this.loadCards();
    }
  }

  private async loadCards() {
    if (!this.collection?.id) return;
    try {
      this.cards = await this.db.getCardsInCollection(this.collection.id);
      this.totalQty = this.cards.reduce((sum, c) => sum + c.qty, 0);
    } catch {}
  }

  async incrementQty(card: CollectionCard) {
    if (!this.collection?.id) return;
    await this.db.incrementCardQuantity(this.collection.id, card.id!);
    await this.loadCards();
  }

  async decrementQty(card: CollectionCard) {
    if (!this.collection?.id) return;
    await this.db.decrementCardQuantity(this.collection.id, card.id!);
    await this.loadCards();
  }

  async removeCard(card: CollectionCard) {
    await this.db.removeCardFromCollection(card.id!);
    await this.loadCards();
  }

  async exportCollection() {
    if (!this.collection || this.cards.length === 0) return;

    const data = {
      collection_name: this.collection.name,
      exported_at: new Date().toISOString(),
      total_cards: this.totalQty,
      cards: this.cards.map((c) => ({
        name: c.name,
        set: c.set_code,
        collector_number: c.collector_number,
        qty: c.qty,
        is_foil: c.is_foil,
      })),
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const safeName = this.collection.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();

    try {
      // Tenta compartilhar nativamente via Capacitor
      const fileName = `${safeName}.json`;
      const result = await Filesystem.writeFile({
        path: fileName,
        data: jsonStr,
        directory: Directory.Cache,
        encoding: Encoding.UTF8,
      });

      await Share.share({
        title: `Exportar Coleção: ${this.collection.name}`,
        text: `Exportação da coleção ${this.collection.name}.`,
        url: result.uri,
        dialogTitle: 'Compartilhar coleção MTG'
      });
    } catch (e) {
      // Fallback para área de transferência se estiver no browser ou não suportar Share
      try {
        await navigator.clipboard.writeText(jsonStr);
        const toast = await this.toastCtrl.create({
          message: 'Coleção copiada para a área de transferência!',
          duration: 3000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      } catch (err) {
        const toast = await this.toastCtrl.create({
          message: 'Falha ao copiar coleção.',
          duration: 3000,
          color: 'danger',
          position: 'bottom'
        });
        await toast.present();
      }
    }
  }

  goBack() {
    this.router.navigate(['/collection']);
  }
}
