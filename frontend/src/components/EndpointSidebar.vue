<script setup lang="ts">
import { computed, reactive, ref, watch } from 'vue';
import { AlertTriangle, ArrowUpRight, Braces, Check, Clock3, FileJson2, X } from 'lucide-vue-next';
import type { ApiEndpoint, ApiOperation, HttpMethod, TestRequest, TestResponse } from '../types';

const props = defineProps<{
  endpoint: ApiEndpoint | null;
  apiTitle: string;
  serverUrl: string;
  isSample: boolean;
  method: HttpMethod;
  requestPending: boolean;
  testResponse: TestResponse | null;
}>();

const emit = defineEmits<{
  close: [];
  'select-method': [method: HttpMethod];
  send: [request: TestRequest];
}>();

const activeTab = ref<'details' | 'tester'>('details');
const requestUrl = ref('');
const requestHeadersText = ref('{}');
const requestBodyText = ref('');
const pathValues = reactive<Record<string, string>>({});
const queryValues = reactive<Record<string, string>>({});
const inputError = ref('');

const operation = computed<ApiOperation | null>(() => props.endpoint?.methods.find((item) => item.method === props.method) ?? props.endpoint?.methods[0] ?? null);
const requestPreviewUrl = computed(() => {
  let preview = requestUrl.value;
  for (const parameter of operation.value?.pathParams ?? []) {
    const value = pathValues[parameter.name]?.trim();
    if (value) preview = preview.split(`{${parameter.name}}`).join(encodeURIComponent(value));
  }
  return preview;
});
function parameterLocationLabel(location: string) {
  const labels: Record<string, string> = { path: 'chemin', query: 'requête', header: 'en-tête', cookie: 'cookie' };
  return labels[location.toLowerCase()] ?? location;
}
const requiredCount = computed(() => {
  const current = operation.value;
  return current ? [...current.pathParams, ...current.queryParams, ...current.headers].filter((param) => param.required).length + Number(current.requestBodyRequired) : 0;
});
const responseJson = computed(() => {
  if (!props.testResponse) return '';
  try { return JSON.stringify(props.testResponse.body, null, 2); } catch { return String(props.testResponse.body); }
});
const responseStatusTone = computed(() => {
  if (props.testResponse?.error) return 'error';
  const status = props.testResponse?.status ?? 0;
  return status >= 200 && status < 300 ? 'success' : 'error';
});

function initializeRequest() {
  inputError.value = '';
  const current = operation.value;
  if (!props.endpoint || !current) return;
  requestUrl.value = `${props.serverUrl}${props.endpoint.path}`;
  for (const key of Object.keys(pathValues)) delete pathValues[key];
  for (const param of current.pathParams) pathValues[param.name] = param.example !== undefined ? String(param.example) : '';
  for (const key of Object.keys(queryValues)) delete queryValues[key];
  for (const param of current.queryParams) {
    queryValues[param.name] = param.example !== undefined ? String(param.example) : '';
  }
  const headers: Record<string, string> = {};
  for (const header of current.headers) if (header.example !== undefined) headers[header.name] = String(header.example);
  if (current.requestBody !== undefined) headers['Content-Type'] = current.requestContentType || 'application/json';
  requestHeadersText.value = JSON.stringify(headers, null, 2);
  requestBodyText.value = current.requestBody === undefined ? '' : JSON.stringify(current.requestBody, null, 2);
}

function sendRequest() {
  inputError.value = '';
  const current = operation.value;
  if (!current) return;
  let headers: Record<string, string>;
  try {
    const parsed = JSON.parse(requestHeadersText.value || '{}') as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('Les en-têtes doivent être un objet JSON.');
    headers = Object.fromEntries(Object.entries(parsed as Record<string, unknown>).map(([key, value]) => [key, String(value)]));
  } catch {
    inputError.value = 'Les en-têtes doivent former un objet JSON valide.';
    return;
  }
  const missing: string[] = [];
  for (const parameter of current.pathParams) {
    if (!pathValues[parameter.name]?.trim()) missing.push(`chemin : ${parameter.name}`);
  }
  for (const parameter of current.queryParams) {
    if (parameter.required && !queryValues[parameter.name]?.trim()) missing.push(`requête : ${parameter.name}`);
  }
  for (const parameter of current.headers) {
    const value = Object.entries(headers).find(([key]) => key.toLowerCase() === parameter.name.toLowerCase())?.[1];
    if (parameter.required && !value?.trim()) missing.push(`en-tête : ${parameter.name}`);
  }
  const body = requestBodyText.value.trim();
  if (current.requestBodyRequired && !body) missing.push('corps de la requête');
  if (missing.length) {
    inputError.value = `Renseignez ces champs obligatoires avant l’envoi : ${missing.join(', ')}.`;
    return;
  }
  if (body && (current.requestContentType || '').includes('json')) {
    try { JSON.parse(body); } catch {
      inputError.value = 'Le corps de la requête doit contenir un JSON valide.';
      return;
    }
  }
  const resolvedUrl = requestPreviewUrl.value;
  let url: URL;
  try { url = new URL(resolvedUrl); } catch {
    inputError.value = 'Saisissez une URL complète, y compris https://.';
    return;
  }
  for (const [key, value] of Object.entries(queryValues)) if (value.trim()) url.searchParams.set(key, value.trim());
  emit('send', { method: current.method, url: url.toString(), headers, ...(body ? { body } : {}) });
}

function copyToClipboard(value: string) {
  void navigator.clipboard?.writeText(value);
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function highlightJson(value: string): string {
  const escaped = escapeHtml(value);
  return escaped.replace(/(&quot;(?:\\.|[^&])*?&quot;)(\s*:)?|(&quot;(?:\\.|[^&])*?&quot;)|\b(true|false|null)\b|(-?\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b)/g, (match, keyToken: string | undefined, colon: string | undefined, stringToken: string | undefined, literal: string | undefined, number: string | undefined) => {
    if (keyToken && colon) return `<span class="json-key">${keyToken}</span>${colon}`;
    if (stringToken) return `<span class="json-string">${stringToken}</span>`;
    if (literal) return `<span class="json-literal">${literal}</span>`;
    if (number) return `<span class="json-number">${number}</span>`;
    return match;
  });
}

const highlightedResponse = computed(() => highlightJson(responseJson.value));
const highlightedExamples = computed(() => (operation.value?.responses ?? []).map((response) => ({ ...response, highlighted: response.example === undefined ? '' : highlightJson(JSON.stringify(response.example, null, 2)) })));

watch(() => [props.endpoint, props.method], initializeRequest, { immediate: true, deep: true });
</script>

<template>
  <aside v-if="endpoint && operation" class="endpoint-sidebar" aria-label="Détails de la route">
    <header class="sidebar-header">
      <div class="sidebar-breadcrumb"><span>{{ apiTitle }}</span><span class="breadcrumb-slash">/</span><span>Route</span></div>
      <button class="icon-button sidebar-close" type="button" aria-label="Fermer les détails de la route" @click="emit('close')"><X :size="18" /></button>
    </header>

    <div class="sidebar-title-block">
      <div class="sidebar-path-row">
        <span class="method-badge" :class="`method-${method.toLowerCase()}`">{{ method }}</span>
        <span class="sidebar-route">{{ endpoint.path }}</span>
      </div>
      <h2>{{ operation.summary }}</h2>
      <p>{{ operation.description || 'Aucune description n’est fournie pour cette opération.' }}</p>
      <div class="endpoint-meta">
        <span v-if="operation.operationId" class="meta-token"><Braces :size="12" /> {{ operation.operationId }}</span>
        <span class="meta-token"><FileJson2 :size="12" /> {{ requiredCount }} obligatoire{{ requiredCount > 1 ? 's' : '' }}</span>
      </div>
    </div>
    <p v-if="isSample" class="sample-document-notice">Contrat intégré abrégé ; les contenus fournis sont illustratifs et peuvent différer de ceux du serveur.</p>

    <div v-if="endpoint.methods.length > 1" class="method-switcher">
      <button v-for="item in endpoint.methods" :key="item.method" type="button" :class="[`method-${item.method.toLowerCase()}`, { 'is-current': method === item.method }]" @click="emit('select-method', item.method)">{{ item.method }}</button>
    </div>

    <nav class="sidebar-tabs" aria-label="Outils de la route">
      <button type="button" :class="{ active: activeTab === 'details' }" @click="activeTab = 'details'"><Braces :size="14" /> Vue d’ensemble</button>
      <button type="button" :class="{ active: activeTab === 'tester' }" @click="activeTab = 'tester'"><span class="tester-tab-dot"></span> Mini Postman</button>
    </nav>

    <div v-if="activeTab === 'details'" class="sidebar-scroll">
      <section v-if="operation.headers.length" class="detail-section">
        <div class="section-heading"><span>EN-TÊTES</span><span class="section-count">{{ operation.headers.length }}</span></div>
        <div v-for="item in operation.headers" :key="item.name" class="parameter-card">
          <div class="parameter-line"><code>{{ item.name }}</code><span v-if="item.required" class="required-label">OBLIGATOIRE</span><span class="parameter-type">{{ item.type }}</span></div>
          <p>{{ item.description || 'En-tête de la requête' }}</p>
        </div>
      </section>

      <section v-if="operation.pathParams.length || operation.queryParams.length" class="detail-section">
        <div class="section-heading"><span>PARAMÈTRES</span><span class="section-count">{{ operation.pathParams.length + operation.queryParams.length }}</span></div>
        <div v-for="item in [...operation.pathParams, ...operation.queryParams]" :key="`${item.location}-${item.name}`" class="parameter-card">
          <div class="parameter-line"><code>{{ item.name }}</code><span class="parameter-location">{{ parameterLocationLabel(item.location) }}</span><span v-if="item.required" class="required-label">OBLIGATOIRE</span><span class="parameter-type">{{ item.type }}</span></div>
          <p>{{ item.description || `${parameterLocationLabel(item.location)} : paramètre` }}</p>
          <div v-if="item.example !== undefined" class="parameter-example"><span>EXEMPLE</span><code>{{ item.example }}</code></div>
          <div v-else-if="item.defaultValue !== undefined" class="parameter-example"><span>VALEUR PAR DÉFAUT</span><code>{{ item.defaultValue }}</code></div>
        </div>
      </section>

      <section v-if="operation.requestBody !== undefined" class="detail-section">
        <div class="section-heading"><span>CORPS DE LA REQUÊTE</span><span class="content-type-label">{{ operation.requestContentType }}</span></div>
        <div class="code-card"><div class="code-card-top"><span><i class="code-dot blue"></i> {{ operation.requestBodyOrigin === 'schema-derived' ? 'JSON dérivé du schéma' : 'exemple de requête déclaré' }}</span><button type="button" title="Copier le corps de la requête" @click="copyToClipboard(requestBodyText)"><Check :size="13" /></button></div><pre class="json-code"><code v-html="highlightJson(requestBodyText)"></code></pre></div>
      </section>

      <section class="detail-section response-section">
        <div class="section-heading"><span>RÉPONSES</span><span class="section-count">{{ operation.responses.length }}</span></div>
        <div v-for="response in highlightedExamples" :key="response.status" class="response-card">
          <div class="response-card-heading"><span class="response-code" :class="response.status.startsWith('2') ? 'status-good' : 'status-warn'">{{ response.status }}</span><span>{{ response.description }}</span><ArrowUpRight :size="13" /></div>
          <div v-if="response.highlighted" class="response-example-label">{{ response.exampleOrigin === 'schema-derived' ? 'STRUCTURE DÉRIVÉE DU SCHÉMA' : 'EXEMPLE DE RÉPONSE DÉCLARÉ' }}</div>
          <pre v-if="response.highlighted" class="response-example"><code v-html="response.highlighted"></code></pre>
          <div v-else class="response-no-example">Aucun exemple de corps de réponse n’est fourni.</div>
        </div>
      </section>
      <div class="sidebar-doc-note">Les exemples sont indiqués comme déclarés ou dérivés du schéma ; les contenus des exemples intégrés sont illustratifs. <span>·</span> <button type="button" @click="activeTab = 'tester'">Préparer la requête <ArrowUpRight :size="12" /></button></div>
    </div>

    <div v-else class="tester-scroll">
      <div class="tester-intro"><div class="tester-icon"><Braces :size="16" /></div><div><strong>Zone de test des requêtes</strong><span>{{ operation.requestBodyOrigin === 'schema-derived' ? 'Le corps ci-dessous est dérivé du schéma ; vérifiez les valeurs avant l’envoi.' : 'Vérifiez la requête avant de l’envoyer.' }}</span></div></div>
      <div class="tester-field-block">
        <label>{{ operation.pathParams.length ? 'APERÇU DE L’URL DE REQUÊTE' : 'URL DE REQUÊTE' }}</label>
        <div class="request-url-row"><span class="request-method" :class="`method-${method.toLowerCase()}`">{{ method }}</span><input v-if="operation.pathParams.length" :value="requestPreviewUrl" aria-label="Aperçu de l’URL de requête" readonly spellcheck="false" /><input v-else v-model="requestUrl" aria-label="URL de requête" spellcheck="false" /></div>
      </div>
      <div v-if="operation.pathParams.length" class="tester-field-block">
        <div class="tester-label-row"><label>PARAMÈTRES DE CHEMIN</label><span>{{ operation.pathParams.length }} paramètre{{ operation.pathParams.length > 1 ? 's' : '' }}</span></div>
        <div v-for="param in operation.pathParams" :key="param.name" class="tester-param-row"><code>{{ param.name }}</code><span v-if="param.required" class="required-label">OBLIGATOIRE</span><input v-model="pathValues[param.name]" :placeholder="param.example !== undefined ? String(param.example) : 'Saisir une valeur'" :aria-label="`Paramètre de chemin ${param.name}`" /></div>
        <p class="tester-field-hint">Saisissez les valeurs du chemin ici ; l’aperçu de l’URL ci-dessus sera mis à jour avant l’envoi.</p>
      </div>
      <div v-if="operation.queryParams.length" class="tester-field-block">
        <div class="tester-label-row"><label>PARAMÈTRES DE REQUÊTE</label><span>{{ operation.queryParams.length }} paramètre{{ operation.queryParams.length > 1 ? 's' : '' }}</span></div>
        <div v-for="param in operation.queryParams" :key="param.name" class="tester-param-row"><code>{{ param.name }}</code><span v-if="param.required" class="required-label">OBLIGATOIRE</span><input v-model="queryValues[param.name]" :placeholder="param.example !== undefined ? String(param.example) : param.defaultValue !== undefined ? String(param.defaultValue) : 'Saisir une valeur'" :aria-label="`Paramètre de requête ${param.name}`" /></div>
      </div>
      <div class="tester-field-block">
        <div class="tester-label-row"><label>EN-TÊTES <span class="optional-label">JSON</span></label><span>modifiables</span></div>
        <textarea v-model="requestHeadersText" class="request-code-input header-input" spellcheck="false" aria-label="En-têtes de requête au format JSON"></textarea>
      </div>
      <div v-if="operation.requestBody !== undefined || operation.requestBodyRequired || ['POST', 'PUT', 'PATCH'].includes(method)" class="tester-field-block">
        <div class="tester-label-row"><label>CORPS <span class="optional-label">{{ operation.requestBodyRequired ? 'OBLIGATOIRE' : 'JSON' }}</span></label><span>{{ operation.requestContentType || 'application/json' }}</span></div>
        <textarea v-model="requestBodyText" class="request-code-input body-input" spellcheck="false" aria-label="Corps de la requête au format JSON" placeholder="{}"></textarea>
      </div>
      <div v-if="inputError" class="request-error"><AlertTriangle :size="14" /> {{ inputError }}</div>
      <button class="send-request-button" type="button" :disabled="requestPending" @click="sendRequest"><span v-if="requestPending" class="button-spinner"></span><Braces v-else :size="15" /> {{ requestPending ? 'Envoi de la requête…' : 'Envoyer la requête' }} <ArrowUpRight v-if="!requestPending" :size="14" /></button>
      <p class="tester-cors-note">Cet onglet envoie directement la requête. Le CORS, l’authentification de l’API et la disponibilité du serveur dépendent de l’API cible.</p>

      <section v-if="testResponse" class="test-response-section">
        <div class="tester-label-row response-result-label"><label>RÉPONSE</label><span v-if="testResponse.duration"><Clock3 :size="12" /> {{ testResponse.duration }} ms</span></div>
        <div class="test-status-line"><span class="response-code" :class="responseStatusTone === 'success' ? 'status-good' : 'status-warn'">{{ testResponse.error ? 'ERR' : testResponse.status }}</span><span>{{ testResponse.error ? 'Échec de la requête' : testResponse.statusText || 'Réponse reçue' }}</span><span class="response-status-light" :class="responseStatusTone"></span></div>
        <div v-if="testResponse.error" class="request-error response-error"><AlertTriangle :size="14" /> {{ testResponse.error }}</div>
        <div class="code-card response-code-card"><div class="code-card-top"><span><i class="code-dot green"></i> response.json</span><button type="button" title="Copier la réponse" @click="copyToClipboard(responseJson)"><Check :size="13" /></button></div><pre class="json-code response-json"><code v-html="highlightedResponse"></code></pre></div>
      </section>
    </div>

    <footer class="sidebar-footer"><span class="footer-shield">SPEC</span><span>Valeurs déclarées dans le document</span><span class="footer-divider">·</span><span>SiraFlow</span><span class="footer-spacer"></span><span>ÉCHAP</span></footer>
  </aside>
</template>
