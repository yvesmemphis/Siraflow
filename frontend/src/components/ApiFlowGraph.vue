<script setup lang="ts">
import { computed, nextTick, onMounted, ref, watch } from 'vue';
import { MarkerType, Position, VueFlow, useVueFlow, type Edge, type Node } from '@vue-flow/core';
import { Maximize2, Minus, Plus, Scan } from 'lucide-vue-next';
import type { ApiDocument, ApiEndpoint } from '../types';

const props = defineProps<{
  api: ApiDocument;
  searchTerm: string;
  activePath: string;
}>();

const emit = defineEmits<{
  select: [endpoint: ApiEndpoint];
}>();

const nodes = ref<Node[]>([]);
const edges = ref<Edge[]>([]);
const { fitView, zoomIn, zoomOut, setViewport } = useVueFlow();
const visibleEndpoints = computed(() => {
  const query = props.searchTerm.trim().toLowerCase();
  if (!query) return props.api.endpoints;
  return props.api.endpoints.filter((endpoint) => {
    const haystack = `${endpoint.path} ${endpoint.methods.map((method) => `${method.method} ${method.summary} ${method.description} ${method.tags.join(' ')}`).join(' ')}`.toLowerCase();
    return haystack.includes(query);
  });
});

function rebuildGraph() {
  const visible = visibleEndpoints.value;
  const columns = Math.max(1, Math.min(3, visible.length));
  const nodeWidth = 286;
  const gapX = 78;
  const totalWidth = columns * nodeWidth + (columns - 1) * gapX;
  const startX = 650 - totalWidth / 2;
  const operationCount = props.api.endpoints.reduce((count, endpoint) => count + endpoint.methods.length, 0);
  const root: Node = {
    id: 'api-root',
    type: 'api-root',
    position: { x: 500, y: 44 },
    sourcePosition: Position.Bottom,
    data: { title: props.api.title, pathCount: props.api.endpoints.length, operationCount, apiVersion: props.api.version, specFormat: props.api.specFormat, specVersion: props.api.specVersion }
  };
  const pathNodes: Node[] = visible.map((endpoint, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    return {
      id: `endpoint-${index}`,
      type: 'endpoint',
      position: { x: startX + column * (nodeWidth + gapX), y: 224 + row * 190 },
      targetPosition: Position.Top,
      data: { endpoint, active: endpoint.path === props.activePath }
    };
  });
  nodes.value = [root, ...pathNodes];
  const nextEdges: Edge[] = [];
  pathNodes.forEach((node, index) => {
    nextEdges.push({
      id: `edge-${index}`,
      source: 'api-root',
      target: node.id,
      type: 'default',
      animated: true,
      markerEnd: MarkerType.ArrowClosed,
      style: { stroke: '#35506f', strokeWidth: 1.4 },
      interactionWidth: 22
    });
  });
  edges.value = nextEdges;
  nextTick(() => {
    window.setTimeout(() => fitView({ padding: 0.28, duration: 450, maxZoom: 0.92 }), 40);
  });
}

function onNodeClick(event: { node: Node }) {
  const endpoint = event.node.data.endpoint as ApiEndpoint | undefined;
  if (endpoint) emit('select', endpoint);
}

function centerGraph() {
  fitView({ padding: 0.28, duration: 500, maxZoom: 0.92 });
}

function fullscreenCanvas() {
  const element = document.querySelector('.workspace-canvas') as HTMLElement | null;
  if (element?.requestFullscreen) void element.requestFullscreen();
  else void setViewport({ x: 0, y: 0, zoom: 0.8 });
}

watch(() => [props.api, props.searchTerm, props.activePath], rebuildGraph, { immediate: true, deep: true });
onMounted(() => nextTick(() => fitView({ padding: 0.28, duration: 0, maxZoom: 0.92 })));
</script>

<template>
  <div class="graph-stage">
    <VueFlow
      v-model:nodes="nodes"
      v-model:edges="edges"
      class="api-flow"
      :min-zoom="0.24"
      :max-zoom="1.5"
      :zoom-on-scroll="true"
      :pan-on-scroll="false"
      :zoom-on-double-click="false"
      :nodes-connectable="false"
      :elements-selectable="true"
      :fit-view-on-init="true"
      @node-click="onNodeClick"
    >
      <template #node-api-root="{ data }">
        <div class="flow-root-card">
          <div class="flow-root-icon"><Scan :size="17" /></div>
          <div class="flow-root-copy">
            <span class="flow-eyebrow">{{ data.specFormat }} {{ data.specVersion }} SPÉCIFICATION</span>
            <strong>{{ data.title }}</strong>
            <small>{{ data.pathCount }} routes <span class="flow-root-dot">·</span> {{ data.operationCount }} opérations</small>
          </div>
          <span class="flow-root-version">API {{ data.apiVersion }}</span>
        </div>
      </template>
      <template #node-endpoint="{ data }">
        <button
          class="flow-endpoint-card"
          :class="{ 'is-active': data.active }"
          type="button"
          @click.stop="emit('select', data.endpoint)"
        >
          <span class="flow-endpoint-top">
            <span class="flow-endpoint-category">{{ data.endpoint.methods[0]?.tags[0] || 'ROUTE' }}</span>
            <span class="flow-endpoint-count">{{ data.endpoint.methods.length }} {{ data.endpoint.methods.length === 1 ? 'méthode' : 'méthodes' }}</span>
          </span>
          <strong class="flow-endpoint-path">{{ data.endpoint.path }}</strong>
          <span class="flow-method-row">
            <span v-for="method in data.endpoint.methods" :key="method.method" class="method-chip" :class="`method-${method.method.toLowerCase()}`">{{ method.method }}</span>
          </span>
          <span class="flow-endpoint-summary">{{ data.endpoint.methods[0]?.summary || 'Aucun résumé d’opération fourni' }}</span>
          <span class="flow-open-hint">Examiner la route <span>↗</span></span>
        </button>
      </template>
    </VueFlow>

    <div v-if="searchTerm && visibleEndpoints.length === 0" class="graph-empty-state">
      <div class="empty-search-mark">⌕</div>
      <strong>Aucune route ne correspond à votre recherche</strong>
      <span>Essayez une autre route, une autre méthode, une autre étiquette ou une autre description.</span>
    </div>

    <div class="graph-controls" aria-label="Commandes du canevas">
      <button type="button" aria-label="Zoom avant" title="Zoom avant" @click="zoomIn({ duration: 180 })"><Plus :size="16" /></button>
      <button type="button" aria-label="Zoom arrière" title="Zoom arrière" @click="zoomOut({ duration: 180 })"><Minus :size="16" /></button>
      <span class="graph-controls-separator"></span>
      <button type="button" aria-label="Ajuster le graphe à l’écran" title="Ajuster le graphe à l’écran" @click="centerGraph"><Scan :size="15" /></button>
      <button type="button" aria-label="Passer le canevas en plein écran" title="Passer le canevas en plein écran" @click="fullscreenCanvas"><Maximize2 :size="15" /></button>
    </div>
    <div class="graph-hint"><span class="hint-dot"></span> Faites glisser pour déplacer <span class="hint-divider">·</span> Faites défiler pour zoomer</div>
  </div>
</template>
