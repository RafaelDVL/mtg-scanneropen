# MTG Scanner

Aplicativo mobile Android para escanear cartas de Magic: The Gathering usando OCR on-device, consultar a API do Scryfall e gerenciar coleções pessoais.

## Stack

| Camada     | Tecnologia                                      |
| ---------- | ----------------------------------------------- |
| Framework  | Ionic 8 + Angular 20                            |
| Nativo     | Capacitor 8 (Android)                           |
| Câmera     | `@capacitor-community/camera-preview`           |
| OCR        | `@jcesarmobile/capacitor-ocr` (ML Kit Vision)   |
| API        | [Scryfall](https://scryfall.com/docs/api)       |
| Armazen.   | IndexedDB (WebView nativo)                      |

## Arquitetura

```
┌─────────────────────────────────────────────┐
│              Scanner Page                    │
│  CameraPreview → OCR → Scryfall → resultado │
└──────────────────┬──────────────────────────┘
                   │ adicionar à coleção
                   ▼
┌─────────────────────────────────────────────┐
│          Coleção (seletor/modal)             │
│   Criar nova  │  Adicionar em existente     │
└───────────────┴─────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────┐
│           DatabaseService                    │
│    IndexedDB: collections + collection_cards │
└─────────────────────────────────────────────┘
                   ▲
                   │
┌─────────────────────────────────────────────┐
│          Collection Pages                    │
│   Lista de coleções → Detalhe → Exportar    │
└─────────────────────────────────────────────┘
```

### Fluxo principal (Scanner)

1. **CameraPreview** exibe prévia ao vivo da câmera traseira (`toBack: true`)
2. Usuário toca "Capturar"
3. `CameraPreview.capture()` tira foto → `CameraPreview.stop()` desliga prévia
4. `Ocr.process()` roda ML Kit Vision na imagem → retorna textos detectados
5. **Parser** extrai código de coleção (ex: `MOC`) e número da carta (ex: `003`)
6. **ScryfallService** busca `GET /cards/{set}/{number}` (com cache e throttle de 100ms)
7. Se não achar por código+número, tenta busca fuzzy por nome (`/cards/named?fuzzy=…`)
8. Resultado exibido → usuário escolhe coleção de destino
9. `DatabaseService.addCardToCollection()` salva (ou incrementa se já existir)

### Fluxo de Coleções

- `/collection` — lista todas as coleções (nome + total de cartas)
- `/collection/:id` — cartas de uma coleção com controles de quantidade e exportação
- Export gera JSON e utiliza Web Share API (`navigator.share`) para compartilhar via WhatsApp, email, etc.

## Estrutura de diretórios

```
src/
├── app/
│   ├── scanner/                    # Tela principal do scanner
│   │   ├── scanner.page.ts         # Lógica: câmera, OCR, parser, adicionar
│   │   ├── scanner.page.html       # Overlay da câmera + resultado
│   │   └── scanner.page.scss       # Estilos (background transparente, guia)
│   ├── collection/                 # Telas de coleções
│   │   ├── collection.page.ts      # Lista de coleções
│   │   ├── collection.page.html
│   │   ├── collection.page.scss
│   │   ├── collection-detail.page.ts   # Cartas de uma coleção + export
│   │   ├── collection-detail.page.html
│   │   └── collection-detail.page.scss
│   ├── services/
│   │   ├── database.service.ts     # IndexedDB (collections + collection_cards)
│   │   └── scryfall.service.ts     # API Scryfall com cache e throttle
│   ├── app.routes.ts               # Rotas: /home, /collection, /collection/:id
│   └── app.component.ts
├── android/                        # Projeto Android nativo (Capacitor)
└── capacitor.config.ts
```

## Data Model (IndexedDB)

### Store `collections`
```
{
  id: number (autoIncrement),
  name: string,
  created_at: string (ISO 8601)
}
```

### Store `collection_cards`
```
{
  id: number (autoIncrement),
  collection_id: number,
  scryfall_id: string,
  name: string,
  set_code: string,
  collector_number: string,
  qty: number,
  is_foil: boolean,
  scanned_at: string (ISO 8601),
  image_url?: string
}
```
Índices: `by_collection` (collection_id), `by_scryfall_id`, `by_collection_and_card` (compound unique)

### Schema version history
- **v1 (removido)**: store `collection` flat com keyPath `scryfall_id`
- **v2 (atual)**: stores `collections` + `collection_cards` com suporte a múltiplas coleções

## Rotas

| Path              | Page               |
| ----------------- | ------------------ |
| `/home`           | ScannerPage        |
| `/collection`     | CollectionPage     |
| `/collection/:id` | CollectionDetailPage |
| `/`               | redireciona para `/home` |

## Services

### ScryfallService
- Cache em memória com expiração de 1h
- Throttle de 100ms entre requisições (exigido pela política da Scryfall)
- User-Agent configurado: `MTGScannerOpen/1.0`
- Métodos: `lookupBySetAndNumber`, `lookupByNameFuzzy`, `getCardImageUrl`

### DatabaseService
- Inicialização assíncrona via `indexedDB.open`
- Criação e gerenciamento de coleções
- Adição de cartas com detecção de duplicatas (compound index)
- Controles de quantidade (increment/decrement)
- Exclusão de cartas e coleções

## Desenvolvimento

### Pré-requisitos
- Node.js 18+
- Android SDK (Android Studio recomendado)
- Dispositivo Android físico (câmera necessária)

### Comandos

```bash
npm install              # instalar dependências
npm run build            # build Angular
npm run cap:build        # build Angular + sync Capacitor
npm run cap:deploy       # build + assemble APK + install no dispositivo
npm run cap:run          # cap:deploy + iniciar app
```

### Observações

- **Windows + Capacitor**: o CLI do Capacitor tenta usar `./gradlew` (bash), mas no PowerShell usa-se `.\gradlew.bat`. Os scripts `cap:deploy` e `cap:run` já contornam isso.
- **CameraPreview `toBack: true`**: exige que o WebView seja transparente via `MainActivity.onStart()` + CSS `--background: transparent` + `global.scss` com `ion-app, body, html { background: transparent }`.
- **OCR**: o plugin `@jcesarmobile/capacitor-ocr` retorna resultados individuais (`RecognitionResult[]`), não linhas com `\n`. O parser itera sobre cada item para extrair set code e collector number.

## Exportação

O formato JSON exportado:
```json
{
  "collection_name": "Minha Coleção",
  "exported_at": "2026-06-17T12:00:00.000Z",
  "total_cards": 42,
  "cards": [
    { "name": "Triumphant Getaway", "set": "moc", "collector_number": "003", "qty": 1, "is_foil": false }
  ]
}
```
