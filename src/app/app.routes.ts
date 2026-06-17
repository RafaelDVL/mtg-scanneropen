import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: 'home',
    loadComponent: () => import('./scanner/scanner.page').then((m) => m.ScannerPage),
  },
  {
    path: 'collection',
    loadComponent: () => import('./collection/collection.page').then((m) => m.CollectionPage),
  },
  {
    path: 'collection/:id',
    loadComponent: () => import('./collection/collection-detail.page').then((m) => m.CollectionDetailPage),
  },
  {
    path: '',
    redirectTo: 'home',
    pathMatch: 'full',
  },
];
