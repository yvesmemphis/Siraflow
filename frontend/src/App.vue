<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';
import { AlertCircle, ArrowRight, ArrowUpRight, Check, ChevronDown, CircleCheck, Download, FileJson2, Github, Globe2, Layers3, LoaderCircle, Maximize2, Minimize2, Search, Upload, X } from 'lucide-vue-next';
import ApiFlowGraph from './components/ApiFlowGraph.vue';
import EndpointSidebar from './components/EndpointSidebar.vue';
import { demoCatalog } from './data/demos';
import { normalizeOpenApi, parseSchemaText } from './utils/openapi';
import type { ApiDocument, ApiEndpoint, HttpMethod, TestRequest, TestResponse } from './types';

const DEFAULT_SCHEMA_URL = 'https://petstore.swagger.io/v2/swagger.json';
const BACKEND_API_BASE_URL = (import.meta.env.VITE_API_BASE_URL ?? '').replace(/\/$/, '');
const BRAND_ASSET = '/assets/siraflow-mark.webp';
const HERO_ILLUSTRATION = '/assets/hero-openapi.webp';
const LANDING_BACKGROUND = '/assets/background-landing.webp';
const CANVAS_BACKGROUND = '/assets/background-canvas.webp';
const SCOPE_ILLUSTRATION = '/assets/scope-illustration.webp';
const demoCards = demoCatalog.map((entry) => {
  const document = normalizeOpenApi(entry.raw, entry.title, true);
  const server = document.server ? new URL(document.server) : null;
  return {
    ...entry,
    document,
    pathCount: document.endpoints.length,
    operationCount: document.endpoints.reduce((count, endpoint) => count + endpoint.methods.length, 0),
    specLabel: `${document.specFormat} ${document.specVersion}`,
    serverLabel: server ? `${server.host}${server.pathname.replace(/\/$/, '')}` : 'Aucun serveur déclaré'
  };
});
const petstorePreview = demoCards.find((demo) => demo.id === 'petstore')!;
const api = ref<ApiDocument | null>(null);
const schemaUrl = ref(DEFAULT_SCHEMA_URL);
const searchTerm = ref('');
const selectedPath = ref('');
const selectedMethod = ref<HttpMethod>('GET');
const loading = ref(false);
const dragging = ref(false);
const importError = ref('');
const toastMessage = ref('');
const toastKind = ref<'success' | 'error'>('success');
const sidebarOpen = ref(false);
const requestPending = ref(false);
const testResponse = ref<TestResponse | null>(null);
const fileInput = ref<HTMLInputElement | null>(null);
const exportMenuOpen = ref(false);
const isFullscreen = ref(false);
let toastTimer = 0;
let requestController: AbortController | null = null;

const selectedEndpoint = computed(() => api.value?.endpoints.find((endpoint) => endpoint.path === selectedPath.value) ?? null);
const matchingEndpointCount = computed(() => {
  if (!api.value) return 0;
  const query = searchTerm.value.trim().toLowerCase();
  if (!query) return api.value.endpoints.length;
  return api.value.endpoints.filter((endpoint) => `${endpoint.path} ${endpoint.methods.map((method) => `${method.method} ${method.summary} ${method.description} ${method.tags.join(' ')}`).join(' ')}`.toLowerCase().includes(query)).length;
});
const operationCount = computed(() => api.value?.endpoints.reduce((count, endpoint) => count + endpoint.methods.length, 0) ?? 0);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

async function validateSchemaWithBackend(schema: unknown): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(`${BACKEND_API_BASE_URL}/api/parse/`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ schema_json: schema }),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new Error('Impossible de joindre le backend Django. Vérifiez qu’il est démarré et accessible.');
    }
    throw error;
  }
  const result: unknown = await response.json();
  if (!response.ok) {
    const detail = isRecord(result) && 'schema_json' in result
      ? result.schema_json
      : result;
    throw new Error(typeof detail === 'string' ? detail : JSON.stringify(detail));
  }
  if (!isRecord(result) || !('schema' in result)) {
    throw new Error('Le backend a renvoyé une réponse inattendue.');
  }
  return result.schema;
}

function showToast(message: string, kind: 'success' | 'error' = 'success') {
  toastMessage.value = message;
  toastKind.value = kind;
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => { toastMessage.value = ''; }, 3600);
}

function enterWorkspace(document: ApiDocument) {
  api.value = document;
  searchTerm.value = '';
  selectedPath.value = '';
  selectedMethod.value = document.endpoints[0]?.methods[0]?.method ?? 'GET';
  sidebarOpen.value = false;
  testResponse.value = null;
  importError.value = '';
}

function showLoadedDocument(document: ApiDocument, sourceLabel = document.title) {
  const operations = document.endpoints.reduce((count, endpoint) => count + endpoint.methods.length, 0);
  showToast(`Document chargé : ${sourceLabel} · ${document.specFormat} ${document.specVersion} · ${document.endpoints.length} routes / ${operations} opérations`);
}

function chooseDemo(demoId: string) {
  const demo = demoCatalog.find((item) => item.id === demoId);
  if (!demo) return;
  try {
    const document = normalizeOpenApi(demo.raw, demo.title, true);
    enterWorkspace(document);
    showLoadedDocument(document);
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Impossible de charger cette démo.';
  }
}

async function importFromUrl() {
  importError.value = '';
  const trimmed = schemaUrl.value.trim();
  let url: URL;
  try { url = new URL(trimmed); } catch {
    importError.value = 'Saisissez une URL de schéma valide commençant par https:// ou http://.';
    return;
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    importError.value = 'Seules les URL de schéma HTTP et HTTPS sont prises en charge.';
    return;
  }
  loading.value = true;
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(), 18000);
  try {
    const response = await fetch(url.toString(), { signal: controller.signal, headers: { Accept: 'application/json, application/yaml, text/yaml, */*' } });
    if (!response.ok) throw new Error(`Le serveur du schéma a répondu ${response.status} ${response.statusText}.`);
    const source = await response.text();
    const parsed = parseSchemaText(source);
    const validatedSchema = await validateSchemaWithBackend(parsed);
    const doc = normalizeOpenApi(validatedSchema, url.pathname.split('/').filter(Boolean).pop() || 'API importée');
    enterWorkspace(doc);
    showLoadedDocument(doc);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      importError.value = 'La requête a expiré. Vérifiez l’URL ou importez le schéma depuis un fichier local.';
    } else if (error instanceof TypeError) {
      importError.value = 'Impossible de récupérer le schéma. Le serveur bloque peut-être les requêtes inter-origines ; essayez plutôt d’importer le fichier.';
    } else {
      importError.value = error instanceof Error ? error.message : 'Impossible de charger ce schéma API.';
    }
  } finally {
    window.clearTimeout(timeout);
    loading.value = false;
  }
}

function openFilePicker() {
  fileInput.value?.click();
}

async function importFile(file?: File) {
  if (!file) return;
  importError.value = '';
  const allowed = /\.(json|ya?ml)$/i.test(file.name) || ['application/json', 'application/yaml', 'text/yaml', 'application/x-yaml'].includes(file.type);
  if (!allowed) {
    importError.value = 'Choisissez un fichier OpenAPI .json, .yaml ou .yml.';
    return;
  }
  if (file.size > 8 * 1024 * 1024) {
    importError.value = 'Ce schéma dépasse 8 Mo. Choisissez un fichier plus petit.';
    return;
  }
  loading.value = true;
  try {
    const parsed = parseSchemaText(await file.text());
    const validatedSchema = await validateSchemaWithBackend(parsed);
    const document = normalizeOpenApi(validatedSchema, file.name.replace(/\.(json|ya?ml)$/i, ''));
    enterWorkspace(document);
    showLoadedDocument(document, file.name);
  } catch (error) {
    importError.value = error instanceof Error ? error.message : 'Impossible d’analyser ce fichier de schéma.';
  } finally {
    loading.value = false;
    if (fileInput.value) fileInput.value.value = '';
  }
}

function onFileChange(event: Event) {
  const input = event.target as HTMLInputElement;
  void importFile(input.files?.[0]);
}

function onDrop(event: DragEvent) {
  dragging.value = false;
  void importFile(event.dataTransfer?.files?.[0]);
}

function openEndpoint(endpoint: ApiEndpoint) {
  selectedPath.value = endpoint.path;
  selectedMethod.value = endpoint.methods[0]?.method ?? 'GET';
  sidebarOpen.value = true;
  testResponse.value = null;
}

function selectMethod(method: HttpMethod) {
  selectedMethod.value = method;
  testResponse.value = null;
}

function resetToImport() {
  api.value = null;
  selectedPath.value = '';
  selectedMethod.value = 'GET';
  sidebarOpen.value = false;
  searchTerm.value = '';
  testResponse.value = null;
  importError.value = '';
}

function escapeSvg(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&apos;');
}

function methodColor(method: string) {
  const colors: Record<string, string> = { GET: '#10b981', POST: '#38bdf8', PUT: '#f59e0b', PATCH: '#f59e0b', DELETE: '#f43f5e', OPTIONS: '#a78bfa', HEAD: '#94a3b8' };
  return colors[method] ?? '#94a3b8';
}

function createExportSvg(formatTitle = 'Carte API SiraFlow') {
  if (!api.value) return '';
  const query = searchTerm.value.trim().toLowerCase();
  const endpoints = api.value.endpoints.filter((endpoint) => !query || `${endpoint.path} ${endpoint.methods.map((method) => `${method.method} ${method.summary} ${method.description}`).join(' ')}`.toLowerCase().includes(query));
  const columns = Math.max(1, Math.min(3, endpoints.length));
  const nodeWidth = 286;
  const nodeHeight = 128;
  const gapX = 78;
  const totalWidth = columns * nodeWidth + (columns - 1) * gapX;
  const width = Math.max(1040, totalWidth + 160);
  const startX = (width - totalWidth) / 2;
  const rootWidth = 360;
  const rootHeight = 88;
  const rootX = (width - rootWidth) / 2;
  const rootY = 54;
  const rowGap = 190;
  const topY = 236;
  const rows = Math.ceil(endpoints.length / columns);
  const height = Math.max(520, topY + Math.max(rows, 1) * rowGap + 110);
  const cards = endpoints.map((endpoint, index) => {
    const col = index % columns;
    const row = Math.floor(index / columns);
    const x = startX + col * (nodeWidth + gapX);
    const y = topY + row * rowGap;
    const centerX = x + nodeWidth / 2;
    const rootCenterX = rootX + rootWidth / 2;
    const badges = endpoint.methods.slice(0, 4).map((method, badgeIndex) => `<rect x="${x + 18 + badgeIndex * 65}" y="${y + 59}" width="57" height="22" rx="6" fill="${methodColor(method.method)}" fill-opacity=".14"/><text x="${x + 46 + badgeIndex * 65}" y="${y + 74}" text-anchor="middle" fill="${methodColor(method.method)}" font-size="10" font-family="DM Mono, monospace" font-weight="700">${escapeSvg(method.method)}</text>`).join('');
    const title = escapeSvg(endpoint.methods[0]?.summary ?? 'Route API').slice(0, 54);
    const path = escapeSvg(endpoint.path).slice(0, 44);
    return `<path d="M ${rootCenterX} ${rootY + rootHeight} C ${rootCenterX} ${rootY + rootHeight + 55}, ${centerX} ${y - 52}, ${centerX} ${y}" fill="none" stroke="#405978" stroke-width="1.5" stroke-dasharray="5 7"/><rect x="${x}" y="${y}" width="${nodeWidth}" height="${nodeHeight}" rx="14" fill="#111923" stroke="#29384a"/><text x="${x + 18}" y="${y + 29}" fill="#91a2b7" font-size="9" font-family="DM Mono, monospace" letter-spacing="1.3">${escapeSvg(endpoint.methods[0]?.tags[0] ?? 'ROUTE').toUpperCase()}</text><text x="${x + 18}" y="${y + 51}" fill="#e7edf5" font-size="15" font-family="DM Mono, monospace">${path}</text>${badges}<text x="${x + 18}" y="${y + 104}" fill="#8c9bad" font-size="11" font-family="DM Sans, sans-serif">${title}</text>`;
  }).join('');
  const gridLines = Array.from({ length: Math.ceil(width / 36) }, (_, index) => `<circle cx="${index * 36}" cy="${Math.floor(index * 1.618) % Math.floor(height / 36) * 36}" r="1" fill="#263244"/>`).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}"><defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#0a0e16"/><stop offset="1" stop-color="#0c1320"/></linearGradient><linearGradient id="accent" x1="0" y1="0" x2="1" y2="0"><stop stop-color="#38bdf8"/><stop offset="1" stop-color="#6366f1"/></linearGradient></defs><rect width="100%" height="100%" fill="url(#bg)"/>${gridLines}<text x="48" y="42" fill="#6f8198" font-family="DM Mono, monospace" font-size="10" letter-spacing="2">SIRAFLOW / ${escapeSvg(formatTitle).toUpperCase()}</text><rect x="${rootX}" y="${rootY}" width="${rootWidth}" height="${rootHeight}" rx="16" fill="#111a27" stroke="#36516e"/><rect x="${rootX + 18}" y="${rootY + 20}" width="42" height="42" rx="12" fill="#38bdf8" fill-opacity=".12" stroke="#38bdf8" stroke-opacity=".3"/><path d="M ${rootX + 31} ${rootY + 42} l8 -12 l-1 10 l9 -1 l-12 15 l2 -11 z" fill="#38bdf8"/><text x="${rootX + 76}" y="${rootY + 31}" fill="#72849a" font-family="DM Mono, monospace" font-size="9" letter-spacing="1.2">POINT D’ENTRÉE API</text><text x="${rootX + 76}" y="${rootY + 53}" fill="#f0f5fb" font-family="DM Sans, sans-serif" font-size="17" font-weight="700">${escapeSvg(api.value.title)}</text><text x="${rootX + 76}" y="${rootY + 72}" fill="#8798ab" font-family="DM Sans, sans-serif" font-size="11">${endpoints.length} routes · v${escapeSvg(api.value.version)}</text>${cards}<text x="48" y="${height - 30}" fill="#5f7188" font-family="DM Mono, monospace" font-size="10">GÉNÉRÉ AVEC SIRAFLOW · ${endpoints.length} ROUTES</text></svg>`;
}

function downloadBlob(blob: Blob, filename: string) {
  const href = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = href;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(href);
}

function exportSvg() {
  if (!api.value) return;
  const svg = createExportSvg(api.value.title);
  downloadBlob(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }), `${api.value.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-map.svg`);
  exportMenuOpen.value = false;
  showToast('Carte SVG exportée');
}

async function exportPng() {
  if (!api.value) return;
  const svg = createExportSvg(api.value.title);
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  try {
    const image = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error('Impossible de générer l’export SVG.'));
    });
    image.src = url;
    await loaded;
    const scale = 2;
    const canvas = document.createElement('canvas');
    canvas.width = image.width * scale;
    canvas.height = image.height * scale;
    const context = canvas.getContext('2d');
    if (!context) throw new Error('La zone de dessin n’est pas disponible dans ce navigateur.');
    context.scale(scale, scale);
    context.drawImage(image, 0, 0);
    const png = await new Promise<Blob>((resolve, reject) => canvas.toBlob((value) => value ? resolve(value) : reject(new Error('Échec de l’export PNG.')), 'image/png'));
    downloadBlob(png, `${api.value.title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-map.png`);
    showToast('Carte PNG exportée');
  } catch (error) {
    showToast(error instanceof Error ? error.message : 'Échec de l’export PNG.', 'error');
  } finally {
    URL.revokeObjectURL(url);
    exportMenuOpen.value = false;
  }
}

async function sendApiRequest(request: TestRequest) {
  requestPending.value = true;
  testResponse.value = null;
  const controller = new AbortController();
  requestController = controller;
  const started = performance.now();
  const timeout = window.setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(request.url, {
      method: request.method,
      headers: request.headers,
      ...(request.body && !['GET', 'HEAD'].includes(request.method) ? { body: request.body } : {}),
      signal: controller.signal
    });
    const raw = await response.text();
    let body: unknown = raw;
    try { body = raw ? JSON.parse(raw) as unknown : null; } catch { /* keep non-JSON response as text */ }
    testResponse.value = { status: response.status, statusText: response.statusText, duration: Math.round(performance.now() - started), body };
  } catch (error) {
    const message = error instanceof DOMException && error.name === 'AbortError'
      ? 'La requête a expiré après 15 secondes.'
      : 'Échec de la requête réseau. Vérifiez l’URL, votre connexion ou la politique CORS de l’API.';
    testResponse.value = { status: 0, statusText: 'Erreur réseau', duration: Math.round(performance.now() - started), body: { error: message }, error: message };
  } finally {
    window.clearTimeout(timeout);
    requestPending.value = false;
    requestController = null;
  }
}

async function toggleFullscreen() {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else await document.documentElement.requestFullscreen();
  } catch {
    showToast('Le plein écran n’est pas disponible dans ce navigateur.', 'error');
  }
}

function updateFullscreenState() {
  isFullscreen.value = Boolean(document.fullscreenElement);
}

function onDocumentKey(event: KeyboardEvent) {
  if (event.key === 'Escape') {
    if (selectedEndpoint.value && sidebarOpen.value) sidebarOpen.value = false;
    if (exportMenuOpen.value) exportMenuOpen.value = false;
  }
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k' && api.value) {
    event.preventDefault();
    document.querySelector<HTMLInputElement>('.workspace-search-input')?.focus();
  }
}

onMounted(() => {
  document.addEventListener('fullscreenchange', updateFullscreenState);
  document.addEventListener('keydown', onDocumentKey);
});
onUnmounted(() => {
  document.removeEventListener('fullscreenchange', updateFullscreenState);
  document.removeEventListener('keydown', onDocumentKey);
  window.clearTimeout(toastTimer);
  requestController?.abort();
});
</script>

<template>
  <div v-if="!api" class="landing-shell">
    <header class="landing-nav">
      <a class="brand-lockup" href="#top" aria-label="Accueil SiraFlow">
        <span class="brand-mark"><img :src="BRAND_ASSET" alt="" width="30" height="30" /></span>
        <span class="brand-name">Sira<span>Flow</span></span>
      </a>
      <nav class="landing-links" aria-label="Navigation principale">
        <a href="#examples">Exemples</a>
        <a href="#how-it-works">Comment lire la spécification</a>
      </nav>
      <a class="open-spec-link" href="#import">Ouvrir une spécification <ArrowRight :size="14" /></a>
    </header>

    <main id="top" class="landing-main">
      <section class="hero-section" :style="{ '--hero-background': `url(${LANDING_BACKGROUND})` }">
        <div class="hero-content">
          <div class="hero-kicker">OPENAPI / SWAGGER <span>·</span> LECTEUR DE SPÉCIFICATIONS</div>
          <h1>Une carte issue<br /><span class="accent-words">de votre contrat API.</span></h1>
          <p class="hero-subtitle">Chargez une spécification pour visualiser ensemble ses routes, méthodes, paramètres et réponses déclarées. Ouvrez une opération pour en examiner les détails et préparer une requête depuis le navigateur.</p>
          <div class="spec-support-row">
            <span>OpenAPI 3.x</span><span>Swagger 2.0</span><span>JSON ou YAML</span>
          </div>
        </div>

        <section class="hero-visual" aria-label="Aperçu de la spécification d’exemple PetStore">
          <div class="hero-illustration-frame"><img :src="HERO_ILLUSTRATION" alt="Une spécification papier qui se transforme en une carte structurée de routes API reliées" width="720" height="480" fetchpriority="high" /></div>
          <div class="snapshot-topbar"><span><FileJson2 :size="14" /> Exemple intégré</span><code>{{ petstorePreview.specLabel }}</code></div>
          <div class="snapshot-heading"><div><strong>{{ petstorePreview.document.title }}</strong><code>{{ petstorePreview.serverLabel }}</code></div><span>API {{ petstorePreview.document.version }}</span></div>
          <div class="snapshot-counts"><span><b>{{ petstorePreview.pathCount }}</b> routes</span><span><b>{{ petstorePreview.operationCount }}</b> opérations</span><span><b>{{ petstorePreview.document.specVersion }}</b> version de la spécification</span></div>
          <div class="snapshot-routes">
            <div v-for="endpoint in petstorePreview.document.endpoints" :key="endpoint.path" class="snapshot-route">
              <code>{{ endpoint.path }}</code>
              <span class="snapshot-methods"><span v-for="method in endpoint.methods" :key="method.method" class="method-compact" :class="`method-${method.method.toLowerCase()}`">{{ method.method }}</span></span>
              <small>{{ endpoint.methods.map((method) => method.summary).join(' · ') }}</small>
            </div>
          </div>
          <div class="snapshot-note">Routes et noms d’opérations issus du document intégré</div>
        </section>
      </section>

      <section id="import" class="import-section">
        <div class="section-intro"><div><span class="section-kicker">01 / SOURCE</span><h2>Charger une spécification</h2></div><p>Utilisez une URL ou un fichier local. Les imports par URL et les requêtes de test sont soumis aux règles CORS et d’authentification du serveur cible.</p></div>
        <div class="import-card" :class="{ 'is-dragging': dragging }" @dragenter.prevent="dragging = true" @dragover.prevent="dragging = true" @dragleave.prevent="dragging = false" @drop.prevent="onDrop">
          <div class="import-card-heading">
            <div><h3>URL de la spécification</h3><p>OpenAPI 3.x ou Swagger 2.0 · JSON ou YAML</p></div>
            <span class="schema-format-badge">URL</span>
          </div>
          <form class="url-import-form" @submit.prevent="importFromUrl">
            <div class="url-input-wrap"><span class="field-prefix">URL</span><input v-model="schemaUrl" aria-label="URL du schéma OpenAPI" placeholder="https://api.example.com/openapi.json" spellcheck="false" /></div>
            <button class="visualize-button" type="submit" :disabled="loading"><LoaderCircle v-if="loading" class="spin-icon" :size="16" /><span v-else>Ouvrir le document</span><ArrowRight v-if="!loading" :size="16" /></button>
          </form>
          <div class="import-divider"><span></span><small>OU OUVRIR UN FICHIER LOCAL</small><span></span></div>
          <button class="dropzone" type="button" @click="openFilePicker"><span class="dropzone-upload-icon"><Upload :size="17" /></span><span class="dropzone-copy"><b>{{ dragging ? 'Déposez le fichier de spécification ici' : 'Déposez un fichier .json, .yaml ou .yml ici' }}</b><small>ou <u>parcourir les fichiers</u> · taille maximale : 8 Mo</small></span><ArrowUpRight :size="15" class="dropzone-arrow" /></button>
          <input ref="fileInput" class="visually-hidden-input" type="file" accept=".json,.yaml,.yml,application/json,application/yaml,text/yaml" @change="onFileChange" />
          <div v-if="importError" class="import-error"><AlertCircle :size="15" /> <span>{{ importError }}</span><button type="button" aria-label="Fermer le message d’erreur" @click="importError = ''"><X :size="14" /></button></div>
          <div v-else class="import-footnote">Les fichiers locaux sont analysés dans cet onglet ; SiraFlow ne les téléverse pas.</div>
        </div>
      </section>

      <section id="examples" class="demo-section">
        <div class="section-intro demo-section-intro"><div><span class="section-kicker">02 / EXEMPLES</span><h2>Spécifications d’exemple intégrées</h2></div><p>Ces documents sont fournis avec l’application. Leur contenu illustre les contrats d’exemple ; un serveur n’est contacté que lorsque vous envoyez une requête.</p></div>
        <div class="demo-grid">
          <button v-for="demo in demoCards" :key="demo.id" class="demo-card" :class="`demo-${demo.id}`" type="button" @click="chooseDemo(demo.id)">
            <span class="demo-icon" :class="`demo-icon-${demo.id}`"><FileJson2 v-if="demo.id === 'petstore'" :size="19" /><Layers3 v-else-if="demo.id === 'ecommerce'" :size="19" /><Github v-else :size="19" /></span>
            <span class="demo-card-main"><span class="demo-category">{{ demo.specLabel }}</span><strong>{{ demo.title }}</strong><small>{{ demo.pathCount }} routes · {{ demo.operationCount }} opérations</small><small class="demo-server">{{ demo.serverLabel }}</small><small class="demo-description">{{ demo.description }}</small></span>
            <ArrowUpRight :size="16" class="demo-arrow" />
          </button>
        </div>
      </section>

      <section id="how-it-works" class="how-section">
        <div class="section-intro"><div><span class="section-kicker">03 / PÉRIMÈTRE</span><h2>Ce qui accompagne chaque route</h2></div><p>La carte est une vue du document, pas un inventaire en temps réel d’un service en cours d’exécution.</p></div>
        <div class="scope-grid">
          <article><span>01</span><h3>Les opérations restent distinctes</h3><p>Une route peut comporter plusieurs méthodes. SiraFlow regroupe la route et distingue les paramètres et les réponses de chaque opération.</p></article>
          <article><span>02</span><h3>L’origine des exemples reste visible</h3><p>Les exemples explicites conservent l’indication de leur source. Les structures générées à partir d’un schéma sont signalées séparément ; aucune description manquante n’est ajoutée.</p></article>
          <article><span>03</span><h3>Les références locales sont suivies</h3><p>Les références contenues dans le document sont résolues. Cette version ne récupère pas les URL <code>$ref</code> distantes.</p></article>
        </div>
        <p class="scope-note"><strong>Les tests sont distincts de la lecture :</strong> les requêtes sont envoyées depuis votre navigateur et peuvent nécessiter des identifiants ou une autorisation CORS du serveur API.</p>
        <figure class="scope-illustration">
          <img :src="SCOPE_ILLUSTRATION" alt="Illustration d’une spécification qui se ramifie en fiches d’opérations et de réponses." width="1200" height="800" loading="lazy" />
          <figcaption>Cette illustration est conceptuelle ; les routes et opérations sont lues dans la spécification que vous ouvrez.</figcaption>
        </figure>
      </section>
    </main>

    <footer class="landing-footer"><a class="footer-brand" href="#top"><img :src="BRAND_ASSET" alt="" width="16" height="16" /> SiraFlow</a><span>OpenAPI 3.x · Swagger 2.0 · JSON et YAML</span><span class="footer-version">LES FICHIERS LOCAUX RESTENT DANS CET ONGLET</span></footer>
  </div>

  <div v-else class="workspace-shell">
    <header class="workspace-header">
      <a class="brand-lockup workspace-brand" href="#" @click.prevent="resetToImport"><span class="brand-mark"><img :src="BRAND_ASSET" alt="" width="27" height="27" /></span><span class="brand-name">Sira<span>Flow</span></span></a>
      <span class="workspace-header-divider"></span>
      <div class="workspace-breadcrumb"><span class="breadcrumb-root">Document</span><span class="breadcrumb-chevron">/</span><strong>{{ api.title }}</strong><span class="workspace-version">API {{ api.version }}</span></div>
      <div class="workspace-header-spacer"></div>
      <label class="workspace-search"><Search :size="15" /><input v-model="searchTerm" class="workspace-search-input" type="search" placeholder="Rechercher une route, une méthode, une étiquette…" aria-label="Rechercher une route, une méthode ou une étiquette d’API" /><span class="search-count">{{ matchingEndpointCount }}</span></label>
      <div class="workspace-actions">
        <div class="export-menu-wrap">
          <button class="header-action-button export-trigger" type="button" :aria-expanded="exportMenuOpen" @click="exportMenuOpen = !exportMenuOpen"><Download :size="15" /><span>Exporter</span><ChevronDown :size="13" /></button>
          <div v-if="exportMenuOpen" class="export-dropdown"><button type="button" @click="exportSvg"><span class="export-format-icon">SVG</span><span><b>Exporter en SVG</b><small>Vectoriel · Redimensionnable</small></span><ArrowUpRight :size="14" /></button><button type="button" @click="exportPng"><span class="export-format-icon png-icon">PNG</span><span><b>Exporter en PNG</b><small>Image · résolution 2×</small></span><ArrowUpRight :size="14" /></button></div>
        </div>
        <button class="header-action-button fullscreen-action" type="button" aria-label="Activer ou quitter le plein écran" title="Activer ou quitter le plein écran" @click="toggleFullscreen"><Minimize2 v-if="isFullscreen" :size="15" /><Maximize2 v-else :size="15" /><span>{{ isFullscreen ? 'Quitter' : 'Plein écran' }}</span></button>
        <button class="new-schema-button" type="button" @click="resetToImport"><span>Nouveau schéma</span><span class="new-schema-plus">+</span></button>
      </div>
    </header>

    <main class="workspace-main">
      <div class="canvas-topline"><div class="canvas-api-info"><span class="spec-state-mark"></span><span class="canvas-api-name">{{ api.title }}</span><span class="canvas-info-separator">/</span><span class="canvas-info-count">{{ operationCount }} opérations</span><span class="canvas-info-separator">·</span><span class="canvas-info-count">{{ matchingEndpointCount }} sur {{ api.endpoints.length }} routes</span></div><div class="canvas-topline-right"><span class="canvas-server" :title="api.server || 'Aucune URL de serveur n’est déclarée dans cette spécification'"><Globe2 :size="12" /> {{ api.server || 'Aucun serveur déclaré' }}</span><span class="spec-dialect-pill">{{ api.specFormat }} {{ api.specVersion }}</span><span v-if="api.isDemo" class="demo-mode-indicator">EXEMPLE INTÉGRÉ</span><span v-else class="schema-loaded-indicator"><Check :size="12" /> DOCUMENT CHARGÉ</span></div></div>
      <div class="workspace-canvas" :class="{ 'drawer-open': sidebarOpen && selectedEndpoint }" :style="{ '--canvas-background': `url(${CANVAS_BACKGROUND})` }">
        <ApiFlowGraph :api="api" :search-term="searchTerm" :active-path="selectedPath" @select="openEndpoint" />
        <Transition name="drawer"><EndpointSidebar v-if="sidebarOpen && selectedEndpoint" :endpoint="selectedEndpoint" :api-title="api.title" :server-url="api.server" :is-sample="Boolean(api.isDemo)" :method="selectedMethod" :request-pending="requestPending" :test-response="testResponse" @close="sidebarOpen = false" @select-method="selectMethod" @send="sendApiRequest" /></Transition>
      </div>
      <div class="workspace-footer"><span><span class="footer-status-dot"></span> SPÉCIFICATION LUE</span><span>{{ api.specFormat }} {{ api.specVersion }} <i>·</i> API {{ api.version }}</span><span class="workspace-footer-hint">Sélectionnez une route pour examiner ses opérations</span></div>
    </main>

    <Transition name="toast"><div v-if="toastMessage" class="toast-message" :class="`toast-${toastKind}`"><CircleCheck v-if="toastKind === 'success'" :size="16" /><AlertCircle v-else :size="16" /> {{ toastMessage }}<button type="button" aria-label="Fermer la notification" @click="toastMessage = ''"><X :size="14" /></button></div></Transition>
  </div>
</template>
