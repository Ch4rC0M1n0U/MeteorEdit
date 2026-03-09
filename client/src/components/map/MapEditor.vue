<template>
  <div class="map-editor" @keydown.escape="cancelDrawing">
    <div class="me-toolbar">
      <div class="me-toolbar-group">
        <v-select
          v-model="currentStyle"
          :items="mapStyles"
          item-title="label"
          item-value="value"
          density="compact"
          hide-details
          class="me-style-select"
          @update:model-value="changeStyle"
        />
      </div>

      <div class="me-separator" />

      <div class="me-toolbar-group">
        <button
          class="me-btn"
          :class="{ active: addingMarker }"
          @click="toggleAddMarker"
          title="Ajouter un repere"
        >
          <v-icon size="16">mdi-map-marker-plus</v-icon>
        </button>
        <button class="me-btn" @click="fitMarkers" title="Voir tous les reperes" :disabled="!markers.length">
          <v-icon size="16">mdi-fit-to-screen-outline</v-icon>
        </button>
      </div>

      <div class="me-separator" />

      <div class="me-toolbar-group">
        <button
          class="me-btn"
          :class="{ active: drawingMode === 'circle' }"
          @click="setDrawingMode('circle')"
          title="Dessiner un cercle"
        >
          <v-icon size="16">mdi-circle-outline</v-icon>
        </button>
        <button
          class="me-btn"
          :class="{ active: drawingMode === 'line' }"
          @click="setDrawingMode('line')"
          title="Dessiner une ligne"
        >
          <v-icon size="16">mdi-vector-line</v-icon>
        </button>
        <button
          class="me-btn"
          :class="{ active: drawingMode === 'arrow' }"
          @click="setDrawingMode('arrow')"
          title="Dessiner une fleche"
        >
          <v-icon size="16">mdi-arrow-top-right</v-icon>
        </button>
        <button
          class="me-btn"
          :class="{ active: drawingMode === 'textbox' }"
          @click="setDrawingMode('textbox')"
          title="Ajouter un texte"
        >
          <v-icon size="16">mdi-format-text</v-icon>
        </button>
        <v-menu :close-on-content-click="false">
          <template #activator="{ props: menuProps }">
            <button
              class="me-btn"
              :class="{ active: addingEntity }"
              v-bind="menuProps"
              title="Placer une entite"
            >
              <v-icon size="16">mdi-map-marker-account</v-icon>
            </button>
          </template>
          <div class="me-entity-menu">
            <div class="me-entity-menu-title mono">Placer une entite</div>
            <button
              v-for="et in entityTypes"
              :key="et.type"
              class="me-entity-menu-item"
              @click="startAddingEntity(et.type)"
            >
              <v-icon size="18" :color="et.color">{{ et.icon }}</v-icon>
              <span>{{ et.label }}</span>
            </button>
          </div>
        </v-menu>
      </div>

      <div class="me-separator" />

      <div class="me-toolbar-group">
        <v-text-field
          v-model="searchQuery"
          density="compact"
          hide-details
          placeholder="Rechercher un lieu..."
          class="me-search-field"
          prepend-inner-icon="mdi-magnify"
          @keyup.enter="geocode"
          clearable
        />
      </div>

      <div v-if="customLayers.length" class="me-toolbar-group">
        <v-menu :close-on-content-click="false">
          <template #activator="{ props: menuProps }">
            <button
              class="me-btn"
              v-bind="menuProps"
              title="Couches personnalisees"
            >
              <v-icon size="16">mdi-layers</v-icon>
            </button>
          </template>
          <div class="me-layers-menu">
            <div class="me-layers-menu-title mono">Couches</div>
            <div
              v-for="cl in customLayers"
              :key="cl.id"
              class="me-layers-menu-item"
              @click="toggleCustomLayer(cl.id)"
            >
              <v-icon size="16" :color="cl.visible ? 'var(--me-accent)' : 'var(--me-text-muted)'">
                {{ cl.visible ? 'mdi-eye' : 'mdi-eye-off' }}
              </v-icon>
              <span :style="{ opacity: cl.visible ? 1 : 0.5 }">{{ cl.label }}</span>
            </div>
          </div>
        </v-menu>
      </div>

      <div class="me-toolbar-spacer" />

      <!-- Presence -->
      <div v-if="presenceUsers.length" class="me-presence-bar">
        <div
          v-for="pu in presenceUsers"
          :key="pu.userId"
          class="me-presence-avatar"
          :title="pu.name"
        >
          <img v-if="pu.avatarUrl" :src="pu.avatarUrl" :alt="pu.name" />
          <span v-else :style="{ background: pu.color }">{{ pu.initials }}</span>
        </div>
      </div>

      <div class="me-toolbar-group">
        <button class="me-btn me-btn-comments" :class="{ active: showComments }" @click="showComments = !showComments" title="Commentaires">
          <v-icon size="16">mdi-comment-text-outline</v-icon>
          <span v-if="commentCount" class="me-comment-badge">{{ commentCount }}</span>
        </button>
        <button class="me-btn" @click="showSidebar = !showSidebar" :class="{ active: showSidebar }" title="Liste des elements">
          <v-icon size="16">mdi-format-list-bulleted</v-icon>
          <span v-if="markers.length + drawings.length + entities.length" class="me-marker-badge">{{ markers.length + drawings.length + entities.length }}</span>
        </button>
      </div>
    </div>

    <!-- Drawing status bar -->
    <div v-if="drawingMode !== 'none' || addingEntity" class="me-drawing-status">
      <v-icon size="14" class="mr-1">{{ addingEntity ? 'mdi-map-marker-account' : 'mdi-draw' }}</v-icon>
      <span>{{ addingEntity ? 'Cliquez pour placer l\'entite' : drawingStatusText }}</span>
      <button class="me-status-cancel" @click="addingEntity ? cancelAddEntity() : cancelDrawing()">
        <v-icon size="14" class="mr-1">mdi-close</v-icon>
        Annuler
      </button>
    </div>

    <div class="me-body">
      <div ref="mapContainer" class="me-map" :class="{ 'me-map-crosshair': addingMarker || addingEntity || drawingMode !== 'none' }" />

      <!-- Sidebar -->
      <div class="me-marker-sidebar" :class="{ open: showSidebar }">
        <div class="me-marker-sidebar-header">
          <h3 class="mono">Elements</h3>
          <button class="me-close-btn" @click="showSidebar = false">
            <v-icon size="16">mdi-close</v-icon>
          </button>
        </div>
        <div class="me-marker-list">
          <!-- Markers section -->
          <div class="me-sidebar-section-title">
            <v-icon size="14">mdi-map-marker</v-icon>
            <span>Reperes</span>
            <span class="me-sidebar-count">{{ markers.length }}</span>
          </div>
          <div v-if="!markers.length" class="me-marker-empty">Aucun repere</div>
          <div
            v-for="m in markers"
            :key="m.id"
            class="me-marker-item"
            @click="flyToMarker(m)"
          >
            <div class="me-marker-item-color" :style="{ background: m.color }" />
            <div class="me-marker-item-info">
              <span class="me-marker-item-title">{{ m.title || 'Sans titre' }}</span>
              <span class="me-marker-item-coords mono">{{ m.lngLat[1].toFixed(4) }}, {{ m.lngLat[0].toFixed(4) }}</span>
            </div>
            <button class="me-marker-item-delete" @click.stop="deleteMarker(m.id)" title="Supprimer">
              <v-icon size="14">mdi-delete-outline</v-icon>
            </button>
          </div>

          <!-- Drawings section -->
          <div class="me-sidebar-section-title" style="margin-top: 8px;">
            <v-icon size="14">mdi-draw</v-icon>
            <span>Dessins</span>
            <span class="me-sidebar-count">{{ drawings.length }}</span>
          </div>
          <div v-if="!drawings.length" class="me-marker-empty">Aucun dessin</div>
          <div
            v-for="d in drawings"
            :key="d.id"
            class="me-marker-item"
            @click="openDrawingEditPopup(d)"
          >
            <div class="me-marker-item-color" :style="{ background: d.color, opacity: d.opacity }" />
            <v-icon size="14" class="me-drawing-type-icon">{{ drawingTypeIcon(d.type) }}</v-icon>
            <div class="me-marker-item-info">
              <span class="me-marker-item-title">{{ d.description || drawingTypeLabel(d.type) }}</span>
              <span v-if="d.type === 'circle' && d.radiusKm" class="me-marker-item-coords mono">{{ formatRadius(d.radiusKm) }}</span>
            </div>
            <button class="me-marker-item-delete" @click.stop="deleteDrawing(d.id)" title="Supprimer">
              <v-icon size="14">mdi-delete-outline</v-icon>
            </button>
          </div>

          <!-- Entities section -->
          <div class="me-sidebar-section-title" style="margin-top: 8px;">
            <v-icon size="14">mdi-map-marker-account</v-icon>
            <span>Entites</span>
            <span class="me-sidebar-count">{{ entities.length }}</span>
          </div>
          <div v-if="!entities.length" class="me-marker-empty">Aucune entite</div>
          <div
            v-for="ent in entities"
            :key="ent.id"
            class="me-marker-item"
            @click="openEntityEditPopup(ent)"
          >
            <v-icon size="16" :color="getEntityTypeInfo(ent.entityType)?.color">{{ getEntityTypeInfo(ent.entityType)?.icon || 'mdi-help-circle' }}</v-icon>
            <div class="me-marker-item-info">
              <span class="me-marker-item-title">{{ ent.label || getEntityTypeInfo(ent.entityType)?.label || ent.entityType }}</span>
              <span class="me-marker-item-coords mono">{{ ent.lngLat[1].toFixed(4) }}, {{ ent.lngLat[0].toFixed(4) }}</span>
            </div>
            <button class="me-marker-item-delete" @click.stop="deleteEntity(ent.id)" title="Supprimer">
              <v-icon size="14">mdi-delete-outline</v-icon>
            </button>
          </div>
        </div>
      </div>

      <CommentSidebar
        v-model="showComments"
        :node-id="props.nodeId"
        @count-change="commentCount = $event"
      />
    </div>

    <!-- Marker edit popup -->
    <Teleport to="body">
      <div v-if="editingMarker" class="me-popup-overlay" @click.self="cancelEdit">
        <div class="me-popup glass-card">
          <div class="me-popup-header">
            <h3 class="mono">{{ editingMarkerId ? 'Modifier le repere' : 'Nouveau repere' }}</h3>
            <button class="me-close-btn" @click="cancelEdit">
              <v-icon size="16">mdi-close</v-icon>
            </button>
          </div>
          <div class="me-popup-body">
            <v-text-field
              v-model="editingMarker.title"
              label="Titre"
              density="compact"
              hide-details
              autofocus
            />
            <v-textarea
              v-model="editingMarker.description"
              label="Description"
              density="compact"
              hide-details
              rows="3"
              class="mt-3"
            />
            <div class="me-popup-color-row mt-3">
              <label class="plugin-label mono">Couleur</label>
              <div class="me-color-options">
                <button
                  v-for="c in markerColors"
                  :key="c"
                  class="me-color-btn"
                  :class="{ active: editingMarker.color === c }"
                  :style="{ background: c }"
                  @click="editingMarker && (editingMarker.color = c)"
                />
              </div>
            </div>
          </div>
          <div class="me-popup-footer">
            <button class="me-btn-ghost" @click="cancelEdit">Annuler</button>
            <button class="me-btn-primary" @click="saveMarker">Enregistrer</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Entity edit popup -->
    <Teleport to="body">
      <div v-if="editingEntity" class="me-popup-overlay" @click.self="cancelEntityEdit">
        <div class="me-popup glass-card">
          <div class="me-popup-header">
            <h3 class="mono">{{ editingEntityId ? 'Modifier l\'entite' : 'Nouvelle entite' }}</h3>
            <button class="me-close-btn" @click="cancelEntityEdit">
              <v-icon size="16">mdi-close</v-icon>
            </button>
          </div>
          <div class="me-popup-body">
            <v-text-field
              v-model="editingEntity.label"
              label="Nom"
              density="compact"
              hide-details
              autofocus
            />
            <v-textarea
              v-model="editingEntity.description"
              label="Description"
              density="compact"
              hide-details
              rows="3"
              class="mt-3"
            />
            <div class="me-popup-entity-type mt-3">
              <label class="plugin-label mono">Type</label>
              <div class="me-entity-type-grid">
                <button
                  v-for="et in entityTypes"
                  :key="et.type"
                  class="me-entity-type-btn"
                  :class="{ active: editingEntity.entityType === et.type }"
                  @click="editingEntity && (editingEntity.entityType = et.type)"
                >
                  <v-icon size="18" :color="et.color">{{ et.icon }}</v-icon>
                  <span>{{ et.label }}</span>
                </button>
              </div>
            </div>
          </div>
          <div class="me-popup-footer">
            <button v-if="editingEntityId" class="me-btn-danger" @click="deleteEntityFromPopup">Supprimer</button>
            <div class="me-popup-footer-spacer" />
            <button class="me-btn-ghost" @click="cancelEntityEdit">Annuler</button>
            <button class="me-btn-primary" @click="saveEntity">Enregistrer</button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Drawing edit popup -->
    <Teleport to="body">
      <div v-if="editingDrawing" class="me-popup-overlay" @click.self="cancelDrawingEdit">
        <div class="me-popup glass-card">
          <div class="me-popup-header">
            <h3 class="mono">{{ editingDrawingId ? 'Modifier le dessin' : 'Nouveau dessin' }}</h3>
            <button class="me-close-btn" @click="cancelDrawingEdit">
              <v-icon size="16">mdi-close</v-icon>
            </button>
          </div>
          <div class="me-popup-body">
            <v-text-field
              v-if="editingDrawing.type === 'textbox'"
              v-model="editingDrawing.text"
              label="Texte"
              density="compact"
              hide-details
              autofocus
            />
            <v-textarea
              v-model="editingDrawing.description"
              label="Commentaire"
              density="compact"
              hide-details
              rows="3"
              :class="editingDrawing.type === 'textbox' ? 'mt-3' : ''"
              :autofocus="editingDrawing.type !== 'textbox'"
            />
            <div class="me-popup-color-row mt-3">
              <label class="plugin-label mono">Couleur</label>
              <div class="me-color-options">
                <button
                  v-for="c in markerColors"
                  :key="c"
                  class="me-color-btn"
                  :class="{ active: editingDrawing.color === c }"
                  :style="{ background: c }"
                  @click="editingDrawing && (editingDrawing.color = c)"
                />
              </div>
            </div>
            <div class="me-popup-opacity-row mt-3">
              <label class="plugin-label mono">Opacite : {{ Math.round(editingDrawing.opacity * 100) }}%</label>
              <v-slider
                v-model="editingDrawing.opacity"
                :min="0.05"
                :max="1"
                :step="0.05"
                hide-details
                density="compact"
                color="var(--me-accent)"
              />
            </div>
          </div>
          <div class="me-popup-footer">
            <button v-if="editingDrawingId" class="me-btn-danger" @click="deleteDrawingFromPopup">Supprimer</button>
            <div class="me-popup-footer-spacer" />
            <button class="me-btn-ghost" @click="cancelDrawingEdit">Annuler</button>
            <button class="me-btn-primary" @click="saveDrawing">Enregistrer</button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onBeforeUnmount, watch } from 'vue';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import api, { SERVER_URL } from '../../services/api';
import { getSocket, connectSocket } from '../../services/socket';
import { useDossierStore } from '../../stores/dossier';
import { useThemeStore } from '../../stores/theme';
import { useAuthStore } from '../../stores/auth';
import type { Socket } from 'socket.io-client';
import CommentSidebar from '../editor/CommentSidebar.vue';

interface MapMarker {
  id: string;
  lngLat: [number, number];
  title: string;
  description: string;
  color: string;
}

interface MapDrawing {
  id: string;
  type: 'circle' | 'line' | 'arrow' | 'textbox';
  center?: [number, number];
  radiusKm?: number;
  points?: [number, number][];
  position?: [number, number];
  text?: string;
  color: string;
  opacity: number;
  description: string;
}

interface MapEntity {
  id: string;
  entityType: string;
  lngLat: [number, number];
  label: string;
  description: string;
}

interface PresenceUser {
  userId: string;
  name: string;
  color: string;
  initials: string;
  avatarUrl: string | null;
}

type DrawingMode = 'none' | 'circle' | 'line' | 'arrow' | 'textbox';

const props = defineProps<{ nodeId: string; data: any }>();
const emit = defineEmits<{ 'update:data': [value: any] }>();

const dossierStore = useDossierStore();
const themeStore = useThemeStore();
const authStore = useAuthStore();
const mapContainer = ref<HTMLElement | null>(null);

// Markers
const markers = ref<MapMarker[]>([]);
const addingMarker = ref(false);
const editingMarker = ref<MapMarker | null>(null);
const editingMarkerId = ref<string | null>(null);

// Drawings
const drawings = ref<MapDrawing[]>([]);
const drawingMode = ref<DrawingMode>('none');
const tempPoints = ref<[number, number][]>([]);
const editingDrawing = ref<MapDrawing | null>(null);
const editingDrawingId = ref<string | null>(null);

// Entities
const entities = ref<MapEntity[]>([]);
const addingEntity = ref(false);
const addingEntityType = ref('');
const editingEntity = ref<MapEntity | null>(null);
const editingEntityId = ref<string | null>(null);

// Presence
const presenceUsers = ref<PresenceUser[]>([]);

// UI state
const showSidebar = ref(false);
const showComments = ref(false);
const commentCount = ref(0);
const searchQuery = ref('');
const customLayers = ref<Array<{ id: string; label: string; visible: boolean }>>([]);
function getDefaultStyle() {
  return themeStore.isDark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
}
const currentStyle = ref(getDefaultStyle());

let map: mapboxgl.Map | null = null;
let mapboxMarkers: Map<string, mapboxgl.Marker> = new Map();
let textboxMarkers: Map<string, mapboxgl.Marker> = new Map();
let socket: Socket | null = null;
let saveTimeout: ReturnType<typeof setTimeout> | null = null;
let mouseMoveHandler: ((e: mapboxgl.MapMouseEvent) => void) | null = null;
let entityDomMarkers: Map<string, mapboxgl.Marker> = new Map();

const markerColors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#6b7280'];

const entityTypes = [
  { type: 'phone', icon: 'mdi-cellphone', label: 'Telephone', color: '#22c55e' },
  { type: 'identity', icon: 'mdi-card-account-details', label: 'Identite', color: '#3b82f6' },
  { type: 'wifi', icon: 'mdi-wifi', label: 'WiFi / Reseau', color: '#8b5cf6' },
  { type: 'vehicle', icon: 'mdi-car', label: 'Vehicule', color: '#f97316' },
  { type: 'camera', icon: 'mdi-cctv', label: 'Camera', color: '#ef4444' },
  { type: 'location', icon: 'mdi-crosshairs-gps', label: 'Localisation', color: '#eab308' },
  { type: 'person', icon: 'mdi-account', label: 'Personne', color: '#ec4899' },
  { type: 'building', icon: 'mdi-office-building', label: 'Batiment', color: '#6b7280' },
  { type: 'money', icon: 'mdi-cash', label: 'Transaction', color: '#14b8a6' },
  { type: 'other', icon: 'mdi-dots-horizontal-circle', label: 'Autres', color: '#9ca3af' },
];

const mapStyles = [
  { label: 'Dark', value: 'mapbox://styles/mapbox/dark-v11' },
  { label: 'Streets', value: 'mapbox://styles/mapbox/streets-v12' },
  { label: 'Satellite', value: 'mapbox://styles/mapbox/satellite-v9' },
  { label: 'Satellite Streets', value: 'mapbox://styles/mapbox/satellite-streets-v12' },
  { label: 'Light', value: 'mapbox://styles/mapbox/light-v11' },
  { label: 'Outdoors', value: 'mapbox://styles/mapbox/outdoors-v12' },
  { label: 'BXL Custom', value: 'mapbox://styles/gaetan-minnekeer/cmmdbavdr000j01s674cg9vvu' },
];

function isMapDark(): boolean {
  const style = currentStyle.value;
  // Light, Streets, and Outdoors are light styles; everything else (dark, satellite, custom) is dark
  return !style.includes('light-v') && !style.includes('streets-v') && !style.includes('outdoors-v');
}

const DRAWING_SOURCE = 'map-drawings';
const PREVIEW_SOURCE = 'drawing-preview';

const drawingLayers = [
  'drawings-circle-fill', 'drawings-circle-casing', 'drawings-circle-outline',
  'drawings-line-casing', 'drawings-line',
  'drawings-arrow-casing', 'drawings-arrow-line', 'drawings-arrow-head',
];

const previewLayers = [
  'preview-circle-fill', 'preview-circle-outline',
  'preview-line', 'preview-arrow-line', 'preview-arrow-head',
];

// --- Utility ---

function generateId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function haversineDistance(a: [number, number], b: [number, number]): number {
  const R = 6371;
  const dLat = (b[1] - a[1]) * Math.PI / 180;
  const dLng = (b[0] - a[0]) * Math.PI / 180;
  const lat1 = a[1] * Math.PI / 180;
  const lat2 = b[1] * Math.PI / 180;
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

function generateCircleCoords(center: [number, number], radiusKm: number, steps = 64): [number, number][] {
  const coords: [number, number][] = [];
  for (let i = 0; i < steps; i++) {
    const angle = (i / steps) * 2 * Math.PI;
    const dx = radiusKm * Math.cos(angle);
    const dy = radiusKm * Math.sin(angle);
    const lng = center[0] + (dx / (111.32 * Math.cos(center[1] * Math.PI / 180)));
    const lat = center[1] + (dy / 110.574);
    coords.push([lng, lat]);
  }
  coords.push(coords[0]);
  return coords;
}

function computeBearing(from: [number, number], to: [number, number]): number {
  const dLng = (to[0] - from[0]) * Math.PI / 180;
  const lat1 = from[1] * Math.PI / 180;
  const lat2 = to[1] * Math.PI / 180;
  const y = Math.sin(dLng) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function createArrowHeadImage(): { width: number; height: number; data: Uint8Array } {
  const size = 32;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.moveTo(size / 2, 2);
  ctx.lineTo(size - 4, size - 4);
  ctx.lineTo(size / 2, size - 10);
  ctx.lineTo(4, size - 4);
  ctx.closePath();
  ctx.fill();
  const imgData = ctx.getImageData(0, 0, size, size);
  return { width: size, height: size, data: new Uint8Array(imgData.data.buffer) };
}

function formatRadius(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(2)} km`;
}

function hashColor(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) hash = str.charCodeAt(i) + ((hash << 5) - hash);
  const colors = ['#ef4444', '#f97316', '#eab308', '#22c55e', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
  return colors[Math.abs(hash) % colors.length];
}

function getEntityTypeInfo(type: string) {
  return entityTypes.find(et => et.type === type);
}

function drawingTypeIcon(type: string): string {
  switch (type) {
    case 'circle': return 'mdi-circle-outline';
    case 'line': return 'mdi-vector-line';
    case 'arrow': return 'mdi-arrow-top-right';
    case 'textbox': return 'mdi-format-text';
    default: return 'mdi-shape-outline';
  }
}

function drawingTypeLabel(type: string): string {
  switch (type) {
    case 'circle': return 'Cercle';
    case 'line': return 'Ligne';
    case 'arrow': return 'Fleche';
    case 'textbox': return 'Texte';
    default: return 'Dessin';
  }
}

const drawingStatusText = computed(() => {
  switch (drawingMode.value) {
    case 'circle':
      return tempPoints.value.length === 0
        ? 'Cliquez pour placer le centre du cercle'
        : 'Cliquez pour definir le rayon';
    case 'line':
      return tempPoints.value.length === 0
        ? 'Cliquez pour commencer la ligne'
        : 'Cliquez pour ajouter un point, double-cliquez pour terminer';
    case 'arrow':
      return tempPoints.value.length === 0
        ? 'Cliquez pour le debut de la fleche'
        : 'Cliquez pour la fin de la fleche';
    case 'textbox':
      return 'Cliquez pour placer le texte';
    default:
      return '';
  }
});

// --- Data persistence ---

function loadFromData() {
  if (props.data?.markers) {
    markers.value = props.data.markers;
  }
  if (props.data?.drawings) {
    drawings.value = props.data.drawings;
  }
  if (props.data?.entities) {
    entities.value = props.data.entities;
  }
  if (props.data?.style) {
    currentStyle.value = props.data.style;
  }
}

function getMapData() {
  return {
    center: map ? [map.getCenter().lng, map.getCenter().lat] : [2.3522, 48.8566],
    zoom: map ? map.getZoom() : 5,
    style: currentStyle.value,
    markers: markers.value,
    drawings: drawings.value,
    entities: entities.value,
  };
}

function scheduleSave() {
  if (saveTimeout) clearTimeout(saveTimeout);
  saveTimeout = setTimeout(() => {
    const data = getMapData();
    emit('update:data', data);
    api.put(`/nodes/${props.nodeId}`, { mapData: data });
  }, 2000);
}

// --- Mapbox Markers ---

function addMapboxMarker(m: MapMarker) {
  if (!map) return;
  const el = document.createElement('div');
  el.className = 'me-custom-marker';
  el.style.backgroundColor = m.color;
  el.style.width = '24px';
  el.style.height = '24px';
  el.style.borderRadius = '50% 50% 50% 0';
  el.style.transform = 'rotate(-45deg)';
  el.style.border = '2px solid white';
  el.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
  el.style.cursor = 'pointer';

  el.addEventListener('click', (e) => {
    e.stopPropagation();
    openEditPopup(m);
  });

  const marker = new mapboxgl.Marker({ element: el, draggable: true })
    .setLngLat(m.lngLat)
    .addTo(map);

  marker.on('dragend', () => {
    const lngLat = marker.getLngLat();
    const found = markers.value.find(mk => mk.id === m.id);
    if (found) {
      found.lngLat = [lngLat.lng, lngLat.lat];
      scheduleSave();
      emitMarkerUpdate(found);
    }
  });

  mapboxMarkers.set(m.id, marker);
}

function removeMapboxMarker(id: string) {
  const marker = mapboxMarkers.get(id);
  if (marker) {
    marker.remove();
    mapboxMarkers.delete(id);
  }
}

function syncMapboxMarkers() {
  mapboxMarkers.forEach(m => m.remove());
  mapboxMarkers.clear();
  markers.value.forEach(m => addMapboxMarker(m));
}

function toggleAddMarker() {
  if (drawingMode.value !== 'none') cancelDrawing();
  if (addingEntity.value) cancelAddEntity();
  addingMarker.value = !addingMarker.value;
}

function openEditPopup(m: MapMarker) {
  editingMarker.value = { ...m };
  editingMarkerId.value = m.id;
}

function cancelEdit() {
  editingMarker.value = null;
  editingMarkerId.value = null;
}

function saveMarker() {
  if (!editingMarker.value) return;
  if (editingMarkerId.value) {
    const idx = markers.value.findIndex(m => m.id === editingMarkerId.value);
    if (idx >= 0) {
      markers.value[idx] = { ...editingMarker.value };
      removeMapboxMarker(editingMarkerId.value);
      addMapboxMarker(markers.value[idx]);
      emitMarkerUpdate(markers.value[idx]);
    }
  } else {
    markers.value.push(editingMarker.value);
    addMapboxMarker(editingMarker.value);
    emitMarkerAdd(editingMarker.value);
  }
  scheduleSave();
  editingMarker.value = null;
  editingMarkerId.value = null;
}

function deleteMarker(id: string) {
  markers.value = markers.value.filter(m => m.id !== id);
  removeMapboxMarker(id);
  scheduleSave();
  emitMarkerDelete(id);
}

function flyToMarker(m: MapMarker) {
  map?.flyTo({ center: m.lngLat, zoom: 14, duration: 1000 });
}

function fitMarkers() {
  if (!map || !markers.value.length) return;
  const bounds = new mapboxgl.LngLatBounds();
  markers.value.forEach(m => bounds.extend(m.lngLat));
  map.fitBounds(bounds, { padding: 60, maxZoom: 15, duration: 1000 });
}

// --- Drawing GeoJSON ---

function drawingsToGeoJSON(drawingsList: MapDrawing[]): GeoJSON.FeatureCollection {
  const features: GeoJSON.Feature[] = [];
  for (const d of drawingsList) {
    switch (d.type) {
      case 'circle':
        if (d.center && d.radiusKm) {
          features.push({
            type: 'Feature',
            properties: { drawingId: d.id, drawingType: 'circle', color: d.color, opacity: d.opacity },
            geometry: { type: 'Polygon', coordinates: [generateCircleCoords(d.center, d.radiusKm)] },
          });
        }
        break;
      case 'line':
        if (d.points && d.points.length >= 2) {
          features.push({
            type: 'Feature',
            properties: { drawingId: d.id, drawingType: 'line', color: d.color, opacity: d.opacity },
            geometry: { type: 'LineString', coordinates: d.points },
          });
        }
        break;
      case 'arrow':
        if (d.points && d.points.length === 2) {
          features.push({
            type: 'Feature',
            properties: { drawingId: d.id, drawingType: 'arrow', color: d.color, opacity: d.opacity },
            geometry: { type: 'LineString', coordinates: d.points },
          });
          const bearing = computeBearing(d.points[0], d.points[1]);
          features.push({
            type: 'Feature',
            properties: { drawingId: d.id, drawingType: 'arrowhead', color: d.color, opacity: d.opacity, bearing },
            geometry: { type: 'Point', coordinates: d.points[1] },
          });
        }
        break;
      case 'textbox':
        // Textboxes are rendered as DOM markers, not GeoJSON
        break;
    }
  }
  return { type: 'FeatureCollection', features };
}

function emptyGeoJSON(): GeoJSON.FeatureCollection {
  return { type: 'FeatureCollection', features: [] };
}

function setupDrawingLayers() {
  if (!map) return;

  // Main drawings source + layers
  if (!map.getSource(DRAWING_SOURCE)) {
    map.addSource(DRAWING_SOURCE, { type: 'geojson', data: emptyGeoJSON() });
  }

  if (!map.getLayer('drawings-circle-fill')) {
    map.addLayer({
      id: 'drawings-circle-fill',
      type: 'fill',
      source: DRAWING_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'circle'],
      paint: {
        'fill-color': ['get', 'color'],
        'fill-opacity': ['get', 'opacity'],
      },
    });
  }
  // Casing layers (dark outline behind colored lines for contrast on light maps)
  if (!map.getLayer('drawings-circle-casing')) {
    map.addLayer({
      id: 'drawings-circle-casing',
      type: 'line',
      source: DRAWING_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'circle'],
      paint: {
        'line-color': '#000000',
        'line-width': 5,
        'line-opacity': 0.2,
      },
    });
  }
  if (!map.getLayer('drawings-circle-outline')) {
    map.addLayer({
      id: 'drawings-circle-outline',
      type: 'line',
      source: DRAWING_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'circle'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3,
        'line-opacity': ['get', 'opacity'],
      },
    });
  }
  if (!map.getLayer('drawings-line-casing')) {
    map.addLayer({
      id: 'drawings-line-casing',
      type: 'line',
      source: DRAWING_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'line'],
      paint: {
        'line-color': '#000000',
        'line-width': 6,
        'line-opacity': 0.2,
      },
    });
  }
  if (!map.getLayer('drawings-line')) {
    map.addLayer({
      id: 'drawings-line',
      type: 'line',
      source: DRAWING_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'line'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3,
        'line-opacity': ['get', 'opacity'],
      },
    });
  }
  if (!map.getLayer('drawings-arrow-casing')) {
    map.addLayer({
      id: 'drawings-arrow-casing',
      type: 'line',
      source: DRAWING_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'arrow'],
      paint: {
        'line-color': '#000000',
        'line-width': 6,
        'line-opacity': 0.2,
      },
    });
  }
  if (!map.getLayer('drawings-arrow-line')) {
    map.addLayer({
      id: 'drawings-arrow-line',
      type: 'line',
      source: DRAWING_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'arrow'],
      paint: {
        'line-color': ['get', 'color'],
        'line-width': 3,
        'line-opacity': ['get', 'opacity'],
      },
    });
  }
  if (!map.hasImage('arrow-head-icon')) {
    map.addImage('arrow-head-icon', createArrowHeadImage(), { sdf: true });
  }
  if (!map.getLayer('drawings-arrow-head')) {
    map.addLayer({
      id: 'drawings-arrow-head',
      type: 'symbol',
      source: DRAWING_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'arrowhead'],
      layout: {
        'icon-image': 'arrow-head-icon',
        'icon-size': 0.7,
        'icon-rotate': ['get', 'bearing'],
        'icon-allow-overlap': true,
        'icon-rotation-alignment': 'map',
      },
      paint: {
        'icon-color': ['get', 'color'],
        'icon-opacity': ['get', 'opacity'],
      },
    });
  }

  // Preview source + layers
  if (!map.getSource(PREVIEW_SOURCE)) {
    map.addSource(PREVIEW_SOURCE, { type: 'geojson', data: emptyGeoJSON() });
  }

  if (!map.getLayer('preview-circle-fill')) {
    map.addLayer({
      id: 'preview-circle-fill',
      type: 'fill',
      source: PREVIEW_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'circle'],
      paint: { 'fill-color': ['get', 'color'], 'fill-opacity': 0.15 },
    });
  }
  if (!map.getLayer('preview-circle-outline')) {
    map.addLayer({
      id: 'preview-circle-outline',
      type: 'line',
      source: PREVIEW_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'circle'],
      paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [4, 3] },
    });
  }
  if (!map.getLayer('preview-line')) {
    map.addLayer({
      id: 'preview-line',
      type: 'line',
      source: PREVIEW_SOURCE,
      filter: ['any', ['==', ['get', 'drawingType'], 'line'], ['==', ['get', 'drawingType'], 'arrow']],
      paint: { 'line-color': ['get', 'color'], 'line-width': 2, 'line-dasharray': [4, 3] },
    });
  }
  if (!map.getLayer('preview-arrow-head')) {
    map.addLayer({
      id: 'preview-arrow-head',
      type: 'symbol',
      source: PREVIEW_SOURCE,
      filter: ['==', ['get', 'drawingType'], 'arrowhead'],
      layout: {
        'icon-image': 'arrow-head-icon',
        'icon-size': 0.6,
        'icon-rotate': ['get', 'bearing'],
        'icon-allow-overlap': true,
        'icon-rotation-alignment': 'map',
      },
      paint: { 'icon-color': ['get', 'color'], 'icon-opacity': 0.5 },
    });
  }

  // Cursor on hover
  for (const layerId of drawingLayers) {
    if (!map.getLayer(layerId)) continue;
    map.on('mouseenter', layerId, () => {
      if (map && drawingMode.value === 'none' && !addingMarker.value) {
        map.getCanvas().style.cursor = 'pointer';
      }
    });
    map.on('mouseleave', layerId, () => {
      if (map && drawingMode.value === 'none' && !addingMarker.value) {
        map.getCanvas().style.cursor = '';
      }
    });
  }
}

function getTextboxScale(): number {
  if (!map) return 1;
  const zoom = map.getZoom();
  return Math.min(1, Math.max(0.3, zoom / 14));
}

function updateTextboxScales() {
  const scale = getTextboxScale();
  textboxMarkers.forEach((marker) => {
    // Scale the inner element, NOT the wrapper (Mapbox manages wrapper's transform)
    const inner = marker.getElement()?.querySelector('.me-textbox-marker') as HTMLElement;
    if (inner) inner.style.transform = `scale(${scale})`;
  });
}

function addTextboxMarker(d: MapDrawing) {
  if (!map || !d.position || !d.text) return;

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'pointer-events: auto; cursor: pointer; display: flex; justify-content: center; align-items: center;';

  const el = document.createElement('div');
  el.className = 'me-textbox-marker';
  const isDark = isMapDark();
  const bgColor = isDark ? 'rgba(15, 15, 30, 0.85)' : 'rgba(255, 255, 255, 0.9)';
  const scale = getTextboxScale();
  el.style.cssText = `
    background: ${bgColor};
    border: 2px solid ${d.color};
    border-radius: 6px;
    padding: 6px 12px;
    color: ${d.color};
    font-size: 14px;
    font-weight: 700;
    font-family: var(--me-font-mono, monospace);
    white-space: nowrap;
    opacity: ${d.opacity};
    backdrop-filter: blur(8px);
    -webkit-backdrop-filter: blur(8px);
    box-shadow: 0 2px 10px rgba(0,0,0,0.4);
    user-select: none;
    transition: box-shadow 0.15s, border-color 0.15s, transform 0.1s;
    transform: scale(${scale});
    transform-origin: center center;
  `;
  el.textContent = d.text;
  el.addEventListener('mouseenter', () => {
    el.style.boxShadow = `0 0 16px ${d.color}66`;
    el.style.borderColor = '#ffffff';
  });
  el.addEventListener('mouseleave', () => {
    el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.3)';
    el.style.borderColor = d.color;
  });

  wrapper.appendChild(el);
  wrapper.addEventListener('click', (e) => {
    e.stopPropagation();
    openDrawingEditPopup(d);
  });

  const marker = new mapboxgl.Marker({ element: wrapper, anchor: 'center' })
    .setLngLat(d.position)
    .addTo(map);

  textboxMarkers.set(d.id, marker);
}

function removeTextboxMarker(id: string) {
  const m = textboxMarkers.get(id);
  if (m) { m.remove(); textboxMarkers.delete(id); }
}

function syncTextboxMarkers() {
  textboxMarkers.forEach(m => m.remove());
  textboxMarkers.clear();
  for (const d of drawings.value) {
    if (d.type === 'textbox') addTextboxMarker(d);
  }
}

function syncDrawings() {
  if (!map) return;
  const src = map.getSource(DRAWING_SOURCE) as mapboxgl.GeoJSONSource;
  if (src) src.setData(drawingsToGeoJSON(drawings.value));
  syncTextboxMarkers();
}

function clearPreview() {
  if (!map) return;
  const src = map.getSource(PREVIEW_SOURCE) as mapboxgl.GeoJSONSource;
  if (src) src.setData(emptyGeoJSON());
}

function updatePreview(cursorLngLat: [number, number]) {
  if (!map) return;
  const src = map.getSource(PREVIEW_SOURCE) as mapboxgl.GeoJSONSource;
  if (!src) return;

  const features: GeoJSON.Feature[] = [];
  const color = '#3b82f6';

  if (drawingMode.value === 'circle' && tempPoints.value.length === 1) {
    const center = tempPoints.value[0];
    const radius = haversineDistance(center, cursorLngLat);
    features.push({
      type: 'Feature',
      properties: { drawingType: 'circle', color },
      geometry: { type: 'Polygon', coordinates: [generateCircleCoords(center, radius)] },
    });
  }

  if (drawingMode.value === 'line' && tempPoints.value.length >= 1) {
    features.push({
      type: 'Feature',
      properties: { drawingType: 'line', color },
      geometry: { type: 'LineString', coordinates: [...tempPoints.value, cursorLngLat] },
    });
  }

  if (drawingMode.value === 'arrow' && tempPoints.value.length === 1) {
    const pts: [number, number][] = [tempPoints.value[0], cursorLngLat];
    features.push({
      type: 'Feature',
      properties: { drawingType: 'arrow', color },
      geometry: { type: 'LineString', coordinates: pts },
    });
    const bearing = computeBearing(pts[0], pts[1]);
    features.push({
      type: 'Feature',
      properties: { drawingType: 'arrowhead', color, bearing },
      geometry: { type: 'Point', coordinates: pts[1] },
    });
  }

  src.setData({ type: 'FeatureCollection', features });
}

// --- Drawing mode ---

function setDrawingMode(mode: DrawingMode) {
  if (addingMarker.value) addingMarker.value = false;
  if (addingEntity.value) cancelAddEntity();
  if (drawingMode.value === mode) {
    cancelDrawing();
    return;
  }
  drawingMode.value = mode;
  tempPoints.value = [];
  clearPreview();
  if (map && mode === 'line') {
    map.doubleClickZoom.disable();
  }
}

function cancelDrawing() {
  if (drawingMode.value === 'line' && map) {
    map.doubleClickZoom.enable();
  }
  drawingMode.value = 'none';
  tempPoints.value = [];
  clearPreview();
}

function handleMapClick(e: mapboxgl.MapMouseEvent) {
  const lngLat: [number, number] = [e.lngLat.lng, e.lngLat.lat];

  // Drawing mode clicks
  if (drawingMode.value !== 'none') {
    handleDrawingClick(lngLat);
    return;
  }

  // Check if clicked on a drawing
  if (map) {
    const activeLayers = drawingLayers.filter(l => map!.getLayer(l));
    if (activeLayers.length) {
      const features = map.queryRenderedFeatures(e.point, { layers: activeLayers });
      if (features.length) {
        const drawingId = features[0].properties?.drawingId;
        if (drawingId) {
          const drawing = drawings.value.find(d => d.id === drawingId);
          if (drawing) {
            openDrawingEditPopup(drawing);
            return;
          }
        }
      }
    }
  }

  // Entity adding
  if (addingEntity.value) {
    addingEntity.value = false;
    const newEntity: MapEntity = {
      id: generateId(),
      entityType: addingEntityType.value,
      lngLat: lngLat,
      label: '',
      description: '',
    };
    editingEntity.value = { ...newEntity };
    editingEntityId.value = null;
    return;
  }

  // Marker adding
  if (!addingMarker.value) return;
  addingMarker.value = false;
  const newMarker: MapMarker = {
    id: generateId(),
    lngLat: lngLat,
    title: '',
    description: '',
    color: '#3b82f6',
  };
  editingMarker.value = { ...newMarker };
  editingMarkerId.value = null;
}

function handleDrawingClick(lngLat: [number, number]) {
  switch (drawingMode.value) {
    case 'circle':
      if (tempPoints.value.length === 0) {
        tempPoints.value.push(lngLat);
      } else {
        const center = tempPoints.value[0];
        const radiusKm = haversineDistance(center, lngLat);
        finishDrawing({
          id: generateId(),
          type: 'circle',
          center,
          radiusKm,
          color: '#3b82f6',
          opacity: 0.25,
          description: '',
        });
      }
      break;

    case 'line':
      tempPoints.value.push(lngLat);
      break;

    case 'arrow':
      if (tempPoints.value.length === 0) {
        tempPoints.value.push(lngLat);
      } else {
        finishDrawing({
          id: generateId(),
          type: 'arrow',
          points: [tempPoints.value[0], lngLat],
          color: '#3b82f6',
          opacity: 0.8,
          description: '',
        });
      }
      break;

    case 'textbox':
      finishDrawing({
        id: generateId(),
        type: 'textbox',
        position: lngLat,
        text: 'Texte',
        color: isMapDark() ? '#ffffff' : '#1a1a2e',
        opacity: 1,
        description: '',
      });
      break;
  }
}

function handleDblClick(e: mapboxgl.MapMouseEvent) {
  if (drawingMode.value === 'line' && tempPoints.value.length >= 2) {
    e.preventDefault();
    finishDrawing({
      id: generateId(),
      type: 'line',
      points: [...tempPoints.value],
      color: '#3b82f6',
      opacity: 0.8,
      description: '',
    });
  }
}

function handleMouseMove(e: mapboxgl.MapMouseEvent) {
  if (drawingMode.value === 'none') return;
  if (tempPoints.value.length === 0 && drawingMode.value !== 'textbox') return;
  updatePreview([e.lngLat.lng, e.lngLat.lat]);
}

function finishDrawing(drawing: MapDrawing) {
  if (drawingMode.value === 'line' && map) {
    map.doubleClickZoom.enable();
  }
  drawingMode.value = 'none';
  tempPoints.value = [];
  clearPreview();

  // Open edit popup for the new drawing
  editingDrawing.value = { ...drawing };
  editingDrawingId.value = null;
}

// --- Drawing edit ---

function openDrawingEditPopup(d: MapDrawing) {
  editingDrawing.value = { ...d };
  editingDrawingId.value = d.id;
}

function cancelDrawingEdit() {
  editingDrawing.value = null;
  editingDrawingId.value = null;
}

function saveDrawing() {
  if (!editingDrawing.value) return;

  if (editingDrawingId.value) {
    const idx = drawings.value.findIndex(d => d.id === editingDrawingId.value);
    if (idx >= 0) {
      drawings.value[idx] = { ...editingDrawing.value };
      emitDrawingUpdate(drawings.value[idx]);
    }
  } else {
    drawings.value.push(editingDrawing.value);
    emitDrawingAdd(editingDrawing.value);
  }

  syncDrawings();
  scheduleSave();
  editingDrawing.value = null;
  editingDrawingId.value = null;
}

function deleteDrawing(id: string) {
  drawings.value = drawings.value.filter(d => d.id !== id);
  syncDrawings();
  scheduleSave();
  emitDrawingDelete(id);
}

function deleteDrawingFromPopup() {
  if (!editingDrawingId.value) return;
  deleteDrawing(editingDrawingId.value);
  editingDrawing.value = null;
  editingDrawingId.value = null;
}

// --- Entity management ---

function startAddingEntity(type: string) {
  if (drawingMode.value !== 'none') cancelDrawing();
  addingMarker.value = false;
  addingEntity.value = true;
  addingEntityType.value = type;
}

function cancelAddEntity() {
  addingEntity.value = false;
  addingEntityType.value = '';
}


function addEntityDomMarker(ent: MapEntity) {
  if (!map) return;
  const info = getEntityTypeInfo(ent.entityType);
  const color = info?.color || '#6b7280';

  // Wrapper div — Mapbox manages its transform, so we never touch it
  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'cursor: pointer;';

  // Inner visible element: small icon circle that expands on hover
  const inner = document.createElement('div');
  inner.className = 'me-entity-dom-marker';
  inner.style.cssText = `
    display: flex; align-items: center; gap: 0;
    background: ${color};
    border-radius: 50%;
    width: 28px; height: 28px;
    justify-content: center;
    box-shadow: 0 2px 6px rgba(0,0,0,0.4);
    transition: all 0.2s ease;
    overflow: hidden;
    white-space: nowrap;
  `;

  const iconSpan = document.createElement('span');
  iconSpan.className = 'mdi ' + (info?.icon.replace('mdi-', 'mdi-') || 'mdi-help-circle');
  iconSpan.style.cssText = 'font-size: 16px; color: #fff; flex-shrink: 0;';
  inner.appendChild(iconSpan);

  const labelSpan = document.createElement('span');
  labelSpan.textContent = ent.label || info?.label || ent.entityType;
  labelSpan.style.cssText = `
    font-size: 11px; font-weight: 600; color: #fff;
    font-family: var(--me-font-mono, monospace);
    max-width: 0; opacity: 0; overflow: hidden;
    transition: max-width 0.2s ease, opacity 0.2s ease, margin 0.2s ease;
    margin-left: 0;
  `;
  inner.appendChild(labelSpan);

  inner.addEventListener('mouseenter', () => {
    inner.style.borderRadius = '14px';
    inner.style.width = 'auto';
    inner.style.padding = '0 10px 0 6px';
    inner.style.gap = '4px';
    inner.style.boxShadow = `0 0 14px ${color}88`;
    labelSpan.style.maxWidth = '150px';
    labelSpan.style.opacity = '1';
    labelSpan.style.marginLeft = '2px';
  });
  inner.addEventListener('mouseleave', () => {
    inner.style.borderRadius = '50%';
    inner.style.width = '28px';
    inner.style.padding = '0';
    inner.style.gap = '0';
    inner.style.boxShadow = '0 2px 6px rgba(0,0,0,0.4)';
    labelSpan.style.maxWidth = '0';
    labelSpan.style.opacity = '0';
    labelSpan.style.marginLeft = '0';
  });
  inner.addEventListener('click', (e) => {
    e.stopPropagation();
    openEntityEditPopup(ent);
  });

  wrapper.appendChild(inner);

  const marker = new mapboxgl.Marker({ element: wrapper, draggable: true, anchor: 'center' })
    .setLngLat(ent.lngLat)
    .addTo(map);

  marker.on('dragend', () => {
    const lngLat = marker.getLngLat();
    const found = entities.value.find(e => e.id === ent.id);
    if (found) {
      found.lngLat = [lngLat.lng, lngLat.lat];
      scheduleSave();
      emitEntityUpdate(found);
    }
  });

  entityDomMarkers.set(ent.id, marker);
}

function removeEntityDomMarker(id: string) {
  const m = entityDomMarkers.get(id);
  if (m) { m.remove(); entityDomMarkers.delete(id); }
}

function syncEntityMarkers() {
  entityDomMarkers.forEach(m => m.remove());
  entityDomMarkers.clear();
  for (const ent of entities.value) {
    addEntityDomMarker(ent);
  }
}

function openEntityEditPopup(ent: MapEntity) {
  editingEntity.value = { ...ent };
  editingEntityId.value = ent.id;
}

function cancelEntityEdit() {
  editingEntity.value = null;
  editingEntityId.value = null;
}

function saveEntity() {
  if (!editingEntity.value) return;
  if (editingEntityId.value) {
    const idx = entities.value.findIndex(e => e.id === editingEntityId.value);
    if (idx >= 0) {
      entities.value[idx] = { ...editingEntity.value };
      removeEntityDomMarker(editingEntityId.value);
      addEntityDomMarker(entities.value[idx]);
      emitEntityUpdate(entities.value[idx]);
    }
  } else {
    entities.value.push(editingEntity.value);
    addEntityDomMarker(editingEntity.value);
    emitEntityAdd(editingEntity.value);
  }
  scheduleSave();
  editingEntity.value = null;
  editingEntityId.value = null;
}

function deleteEntity(id: string) {
  entities.value = entities.value.filter(e => e.id !== id);
  removeEntityDomMarker(id);
  scheduleSave();
  emitEntityDelete(id);
}

function deleteEntityFromPopup() {
  if (!editingEntityId.value) return;
  deleteEntity(editingEntityId.value);
  editingEntity.value = null;
  editingEntityId.value = null;
}

// --- Presence ---

function emitPresenceJoin() {
  const dossierId = dossierStore.currentDossier?._id;
  if (!dossierId || !socket || !authStore.user) return;
  const u = authStore.user;
  socket.emit('map-presence-join', {
    dossierId,
    nodeId: props.nodeId,
    user: {
      userId: u.id,
      name: `${u.firstName} ${u.lastName}`,
      color: hashColor(u.id),
      initials: `${u.firstName[0] || ''}${u.lastName[0] || ''}`.toUpperCase(),
      avatarUrl: u.avatarPath ? `${SERVER_URL}/${u.avatarPath}` : null,
    },
  });
}

function emitPresenceLeave() {
  const dossierId = dossierStore.currentDossier?._id;
  if (!dossierId || !socket || !authStore.user) return;
  socket.emit('map-presence-leave', {
    dossierId,
    nodeId: props.nodeId,
    userId: authStore.user.id,
  });
}

function onRemotePresenceJoined(data: { nodeId: string; user: PresenceUser }) {
  if (data.nodeId !== props.nodeId) return;
  if (data.user.userId === authStore.user?.id) return;
  if (!presenceUsers.value.some(p => p.userId === data.user.userId)) {
    presenceUsers.value.push(data.user);
  }
}

function onRemotePresenceLeft(data: { nodeId: string; userId: string }) {
  if (data.nodeId !== props.nodeId) return;
  presenceUsers.value = presenceUsers.value.filter(p => p.userId !== data.userId);
}

function onRemotePresenceList(data: { nodeId: string; users: PresenceUser[] }) {
  if (data.nodeId !== props.nodeId) return;
  for (const u of data.users) {
    if (u.userId === authStore.user?.id) continue;
    if (!presenceUsers.value.some(p => p.userId === u.userId)) {
      presenceUsers.value.push(u);
    }
  }
}

// --- Style / Geocode ---

// --- Custom tileset layers ---

let tilesetPopup: mapboxgl.Popup | null = null;

// Standard Mapbox style layer ID prefixes — anything NOT matching these is custom
const MAPBOX_LAYER_PREFIXES = [
  'land', 'water', 'road', 'bridge', 'tunnel', 'aeroway', 'building',
  'admin', 'boundary', 'national-park', 'poi', 'transit', 'natural',
  'place', 'country', 'state', 'settlement', 'continent', 'airport',
  'hillshade', 'contour', 'housenum', 'ferry', 'path', 'pedestrian',
  'golf', 'pitch', 'park', 'cemetery', 'industrial', 'sand', 'glacier',
  'grass', 'hospital', 'school', 'landuse', 'landcover', 'mapbox-',
  'sky', 'background', 'satellite',
];

function isBuiltinLayer(layerId: string): boolean {
  const id = layerId.toLowerCase();
  return MAPBOX_LAYER_PREFIXES.some(prefix => id.startsWith(prefix))
    || id.includes('label') || id.includes('symbol');
}

function detectCustomLayers() {
  if (!map) return;
  const style = map.getStyle();
  if (!style?.layers) { customLayers.value = []; return; }

  const found: Array<{ id: string; label: string; visible: boolean }> = [];
  for (const layer of style.layers) {
    // Skip our own drawing layers
    if ('source' in layer && (layer.source === DRAWING_SOURCE)) continue;
    // Skip standard Mapbox layers
    if (isBuiltinLayer(layer.id)) continue;
    // This is a custom layer
    const vis = map.getLayoutProperty(layer.id, 'visibility');
    found.push({
      id: layer.id,
      label: layer.id.replace(/[-_]/g, ' '),
      visible: vis !== 'none',
    });
  }
  customLayers.value = found;
}

function toggleCustomLayer(layerId: string) {
  if (!map) return;
  const layer = customLayers.value.find(l => l.id === layerId);
  if (!layer) return;
  layer.visible = !layer.visible;
  map.setLayoutProperty(layerId, 'visibility', layer.visible ? 'visible' : 'none');
}

function getVisibleCustomLayerIds(): string[] {
  return customLayers.value.filter(l => l.visible).map(l => l.id).filter(id => map?.getLayer(id));
}

function setupTilesetInteraction() {
  if (!map) return;

  map.on('click', (e) => {
    const visibleIds = getVisibleCustomLayerIds();
    if (!visibleIds.length) return;

    const features = map!.queryRenderedFeatures(e.point, { layers: visibleIds });
    if (!features.length) return;

    const feat = features[0];
    const props = feat.properties;
    if (!props || !Object.keys(props).length) return;

    const rows = Object.entries(props)
      .filter(([_, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `<tr><td style="font-weight:600;padding:2px 8px 2px 0;color:var(--me-accent);font-size:11px;white-space:nowrap;">${k}</td><td style="font-size:11px;max-width:200px;word-break:break-word;">${v}</td></tr>`)
      .join('');
    const html = `<table style="border-collapse:collapse;">${rows}</table>`;

    if (tilesetPopup) tilesetPopup.remove();
    tilesetPopup = new mapboxgl.Popup({ closeButton: true, maxWidth: '320px', className: 'me-tileset-popup' })
      .setLngLat(e.lngLat)
      .setHTML(html)
      .addTo(map!);
  });

  map.on('mousemove', (e) => {
    if (!map) return;
    const visibleIds = getVisibleCustomLayerIds();
    if (!visibleIds.length) return;
    const features = map.queryRenderedFeatures(e.point, { layers: visibleIds });
    const canvas = map.getCanvas();
    if (features.length && drawingMode.value === 'none' && !addingMarker.value && !addingEntity.value) {
      canvas.style.cursor = 'pointer';
    }
  });
}

function changeStyle(style: string) {
  if (map) {
    map.setStyle(style);
    map.once('style.load', () => {
      syncMapboxMarkers();
      setupDrawingLayers();
      syncDrawings();
      syncTextboxMarkers();
      syncEntityMarkers();
      detectCustomLayers();
    });
  }
}

async function geocode() {
  if (!searchQuery.value.trim() || !mapboxgl.accessToken) return;
  try {
    const res = await fetch(
      `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(searchQuery.value)}.json?access_token=${mapboxgl.accessToken}&limit=1`
    );
    const data = await res.json();
    if (data.features?.length) {
      const [lng, lat] = data.features[0].center;
      map?.flyTo({ center: [lng, lat], zoom: 16, duration: 1500 });
    }
  } catch (err) {
    console.error('Geocoding failed:', err);
  }
}

// --- Socket.io ---

function emitMarkerAdd(marker: MapMarker) {
  const dossierId = dossierStore.currentDossier?._id;
  if (dossierId && socket) socket.emit('map-marker-add', { dossierId, nodeId: props.nodeId, marker });
}
function emitMarkerUpdate(marker: MapMarker) {
  const dossierId = dossierStore.currentDossier?._id;
  if (dossierId && socket) socket.emit('map-marker-update', { dossierId, nodeId: props.nodeId, marker });
}
function emitMarkerDelete(markerId: string) {
  const dossierId = dossierStore.currentDossier?._id;
  if (dossierId && socket) socket.emit('map-marker-delete', { dossierId, nodeId: props.nodeId, markerId });
}

function emitDrawingAdd(drawing: MapDrawing) {
  const dossierId = dossierStore.currentDossier?._id;
  if (dossierId && socket) socket.emit('map-drawing-add', { dossierId, nodeId: props.nodeId, drawing });
}
function emitDrawingUpdate(drawing: MapDrawing) {
  const dossierId = dossierStore.currentDossier?._id;
  if (dossierId && socket) socket.emit('map-drawing-update', { dossierId, nodeId: props.nodeId, drawing });
}
function emitDrawingDelete(drawingId: string) {
  const dossierId = dossierStore.currentDossier?._id;
  if (dossierId && socket) socket.emit('map-drawing-delete', { dossierId, nodeId: props.nodeId, drawingId });
}

function emitEntityAdd(entity: MapEntity) {
  const dossierId = dossierStore.currentDossier?._id;
  if (dossierId && socket) socket.emit('map-entity-add', { dossierId, nodeId: props.nodeId, entity });
}
function emitEntityUpdate(entity: MapEntity) {
  const dossierId = dossierStore.currentDossier?._id;
  if (dossierId && socket) socket.emit('map-entity-update', { dossierId, nodeId: props.nodeId, entity });
}
function emitEntityDelete(entityId: string) {
  const dossierId = dossierStore.currentDossier?._id;
  if (dossierId && socket) socket.emit('map-entity-delete', { dossierId, nodeId: props.nodeId, entityId });
}

function onRemoteMarkerAdded(data: { nodeId: string; marker: MapMarker }) {
  if (data.nodeId !== props.nodeId) return;
  if (markers.value.some(m => m.id === data.marker.id)) return;
  markers.value.push(data.marker);
  addMapboxMarker(data.marker);
}
function onRemoteMarkerUpdated(data: { nodeId: string; marker: MapMarker }) {
  if (data.nodeId !== props.nodeId) return;
  const idx = markers.value.findIndex(m => m.id === data.marker.id);
  if (idx >= 0) {
    markers.value[idx] = data.marker;
    removeMapboxMarker(data.marker.id);
    addMapboxMarker(data.marker);
  }
}
function onRemoteMarkerDeleted(data: { nodeId: string; markerId: string }) {
  if (data.nodeId !== props.nodeId) return;
  markers.value = markers.value.filter(m => m.id !== data.markerId);
  removeMapboxMarker(data.markerId);
}

function onRemoteDrawingAdded(data: { nodeId: string; drawing: MapDrawing }) {
  if (data.nodeId !== props.nodeId) return;
  if (drawings.value.some(d => d.id === data.drawing.id)) return;
  drawings.value.push(data.drawing);
  syncDrawings();
}
function onRemoteDrawingUpdated(data: { nodeId: string; drawing: MapDrawing }) {
  if (data.nodeId !== props.nodeId) return;
  const idx = drawings.value.findIndex(d => d.id === data.drawing.id);
  if (idx >= 0) {
    drawings.value[idx] = data.drawing;
    syncDrawings();
  }
}
function onRemoteDrawingDeleted(data: { nodeId: string; drawingId: string }) {
  if (data.nodeId !== props.nodeId) return;
  drawings.value = drawings.value.filter(d => d.id !== data.drawingId);
  syncDrawings();
}

function onRemoteEntityAdded(data: { nodeId: string; entity: MapEntity }) {
  if (data.nodeId !== props.nodeId) return;
  if (entities.value.some(e => e.id === data.entity.id)) return;
  entities.value.push(data.entity);
  addEntityDomMarker(data.entity);
}
function onRemoteEntityUpdated(data: { nodeId: string; entity: MapEntity }) {
  if (data.nodeId !== props.nodeId) return;
  const idx = entities.value.findIndex(e => e.id === data.entity.id);
  if (idx >= 0) {
    entities.value[idx] = data.entity;
    removeEntityDomMarker(data.entity.id);
    addEntityDomMarker(data.entity);
  }
}
function onRemoteEntityDeleted(data: { nodeId: string; entityId: string }) {
  if (data.nodeId !== props.nodeId) return;
  entities.value = entities.value.filter(e => e.id !== data.entityId);
  removeEntityDomMarker(data.entityId);
}

// --- Map init ---

async function initMap() {
  try {
    const { data } = await api.get('/settings/mapbox');
    if (data.apiKey) {
      mapboxgl.accessToken = data.apiKey;
      if (!props.data?.style) currentStyle.value = getDefaultStyle();
    }
  } catch {
    console.warn('Could not load mapbox settings');
  }

  if (!mapboxgl.accessToken || !mapContainer.value) return;

  loadFromData();

  const center = props.data?.center || [2.3522, 48.8566];
  const zoom = props.data?.zoom || 5;

  map = new mapboxgl.Map({
    container: mapContainer.value,
    style: currentStyle.value,
    center,
    zoom,
  });

  map.addControl(new mapboxgl.NavigationControl(), 'bottom-right');
  map.addControl(new mapboxgl.ScaleControl(), 'bottom-left');

  map.on('click', handleMapClick);
  map.on('dblclick', handleDblClick);

  mouseMoveHandler = handleMouseMove;
  map.on('mousemove', mouseMoveHandler);

  map.on('load', () => {
    syncMapboxMarkers();
    setupDrawingLayers();
    syncDrawings();
    syncEntityMarkers();
    detectCustomLayers();
    setupTilesetInteraction();
  });

  map.on('moveend', scheduleSave);
  map.on('zoom', () => { updateTextboxScales(); });
}

// --- Theme watcher ---

watch(() => themeStore.isDark, (dark) => {
  const newStyle = dark ? 'mapbox://styles/mapbox/dark-v11' : 'mapbox://styles/mapbox/light-v11';
  currentStyle.value = newStyle;
  changeStyle(newStyle);
});

// --- Lifecycle ---

function setupSocketListeners() {
  if (!socket) return;

  // Clean previous listeners
  socket.off('map-marker-added', onRemoteMarkerAdded);
  socket.off('map-marker-updated', onRemoteMarkerUpdated);
  socket.off('map-marker-deleted', onRemoteMarkerDeleted);
  socket.off('map-drawing-added', onRemoteDrawingAdded);
  socket.off('map-drawing-updated', onRemoteDrawingUpdated);
  socket.off('map-drawing-deleted', onRemoteDrawingDeleted);
  socket.off('map-entity-added', onRemoteEntityAdded);
  socket.off('map-entity-updated', onRemoteEntityUpdated);
  socket.off('map-entity-deleted', onRemoteEntityDeleted);
  socket.off('map-presence-joined', onRemotePresenceJoined);
  socket.off('map-presence-left', onRemotePresenceLeft);
  socket.off('map-presence-list', onRemotePresenceList);

  // Register listeners
  socket.on('map-marker-added', onRemoteMarkerAdded);
  socket.on('map-marker-updated', onRemoteMarkerUpdated);
  socket.on('map-marker-deleted', onRemoteMarkerDeleted);
  socket.on('map-drawing-added', onRemoteDrawingAdded);
  socket.on('map-drawing-updated', onRemoteDrawingUpdated);
  socket.on('map-drawing-deleted', onRemoteDrawingDeleted);
  socket.on('map-entity-added', onRemoteEntityAdded);
  socket.on('map-entity-updated', onRemoteEntityUpdated);
  socket.on('map-entity-deleted', onRemoteEntityDeleted);
  socket.on('map-presence-joined', onRemotePresenceJoined);
  socket.on('map-presence-left', onRemotePresenceLeft);
  socket.on('map-presence-list', onRemotePresenceList);
}

onMounted(async () => {
  await initMap();
  // Use the existing socket from the dossier store (already joined the room)
  socket = getSocket() || connectSocket();
  setupSocketListeners();
  emitPresenceJoin();

  // Re-register listeners on reconnect (socket.io auto-reconnects but room join is lost)
  socket.on('connect', () => {
    const dossierId = dossierStore.currentDossier?._id;
    if (dossierId) {
      socket!.emit('join-dossier', dossierId);
    }
    setupSocketListeners();
    emitPresenceJoin();
  });
});

onBeforeUnmount(() => {
  if (saveTimeout) {
    clearTimeout(saveTimeout);
    const data = getMapData();
    api.put(`/nodes/${props.nodeId}`, { mapData: data });
  }
  emitPresenceLeave();
  socket?.off('map-marker-added', onRemoteMarkerAdded);
  socket?.off('map-marker-updated', onRemoteMarkerUpdated);
  socket?.off('map-marker-deleted', onRemoteMarkerDeleted);
  socket?.off('map-drawing-added', onRemoteDrawingAdded);
  socket?.off('map-drawing-updated', onRemoteDrawingUpdated);
  socket?.off('map-drawing-deleted', onRemoteDrawingDeleted);
  socket?.off('map-entity-added', onRemoteEntityAdded);
  socket?.off('map-entity-updated', onRemoteEntityUpdated);
  socket?.off('map-entity-deleted', onRemoteEntityDeleted);
  socket?.off('map-presence-joined', onRemotePresenceJoined);
  socket?.off('map-presence-left', onRemotePresenceLeft);
  if (drawingMode.value === 'line' && map) map.doubleClickZoom.enable();
  textboxMarkers.forEach(m => m.remove());
  textboxMarkers.clear();
  entityDomMarkers.forEach(m => m.remove());
  entityDomMarkers.clear();
  map?.remove();
  map = null;
});

watch(() => props.nodeId, (_newId, oldId) => {
  // Emit presence leave for old node
  if (oldId) {
    emitPresenceLeave();
    presenceUsers.value = [];
  }
  mapboxMarkers.forEach(m => m.remove());
  mapboxMarkers.clear();
  textboxMarkers.forEach(m => m.remove());
  textboxMarkers.clear();
  entityDomMarkers.forEach(m => m.remove());
  entityDomMarkers.clear();
  markers.value = [];
  drawings.value = [];
  entities.value = [];
  loadFromData();
  if (map) {
    syncMapboxMarkers();
    syncDrawings();
    syncEntityMarkers();
    if (props.data?.center) {
      map.setCenter(props.data.center);
      map.setZoom(props.data.zoom || 5);
    }
  }
  // Emit presence join for new node
  emitPresenceJoin();
});
</script>

<style scoped>
.map-editor {
  display: flex;
  flex-direction: column;
  height: 100%;
}
.me-toolbar {
  display: flex;
  align-items: center;
  gap: 4px;
  padding: 6px 12px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-wrap: wrap;
}
.me-toolbar-group {
  display: flex;
  align-items: center;
  gap: 2px;
}
.me-toolbar-spacer {
  flex: 1;
}
.me-separator {
  width: 1px;
  height: 20px;
  background: var(--me-border);
  margin: 0 5px;
}
.me-btn {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: var(--me-radius-xs);
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  transition: all 0.15s;
  position: relative;
}
.me-btn:hover:not(:disabled) {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.me-btn.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.me-btn:disabled {
  opacity: 0.3;
  cursor: not-allowed;
}
.me-marker-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--me-accent);
  color: var(--me-bg-deep);
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  font-family: var(--me-font-mono);
}
.me-btn-comments {
  position: relative;
}
.me-comment-badge {
  position: absolute;
  top: -4px;
  right: -4px;
  background: var(--me-accent);
  color: var(--me-bg-deep);
  font-size: 10px;
  font-weight: 700;
  min-width: 16px;
  height: 16px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  font-family: var(--me-font-mono);
}
.me-style-select {
  max-width: 180px;
}
.me-search-field {
  min-width: 300px;
}

/* Drawing status bar */
.me-drawing-status {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 16px;
  background: var(--me-accent-glow);
  border-bottom: 1px solid var(--me-accent);
  font-size: 12px;
  color: var(--me-accent);
  font-weight: 500;
}
.me-status-cancel {
  margin-left: auto;
  display: flex;
  align-items: center;
  gap: 2px;
  background: none;
  border: 1px solid var(--me-accent);
  border-radius: var(--me-radius-xs);
  color: var(--me-accent);
  cursor: pointer;
  padding: 2px 8px;
  font-size: 11px;
  transition: all 0.15s;
}
.me-status-cancel:hover {
  background: var(--me-accent);
  color: var(--me-bg-deep);
}

.me-body {
  flex: 1;
  position: relative;
  overflow: hidden;
}
.me-map {
  width: 100%;
  height: 100%;
}
.me-map-crosshair :deep(.mapboxgl-canvas) {
  cursor: crosshair !important;
}

/* Sidebar */
.me-marker-sidebar {
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  width: 300px;
  background: var(--me-bg-surface);
  border-left: 1px solid var(--me-border);
  transform: translateX(100%);
  transition: transform 0.25s ease;
  z-index: 10;
  display: flex;
  flex-direction: column;
}
.me-marker-sidebar.open {
  transform: translateX(0);
}
.me-marker-sidebar-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid var(--me-border);
}
.me-marker-sidebar-header h3 {
  font-size: 14px;
  font-weight: 700;
  color: var(--me-text-primary);
  display: flex;
  align-items: center;
  gap: 6px;
}
.me-close-btn {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--me-radius-xs);
}
.me-close-btn:hover {
  color: var(--me-text-primary);
}
.me-marker-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}
.me-sidebar-section-title {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 700;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.me-sidebar-count {
  background: var(--me-accent-glow);
  color: var(--me-accent);
  font-size: 10px;
  font-weight: 700;
  padding: 0 6px;
  border-radius: 8px;
  margin-left: auto;
  font-family: var(--me-font-mono);
}
.me-marker-empty {
  padding: 12px 16px;
  text-align: center;
  color: var(--me-text-muted);
  font-size: 12px;
  font-style: italic;
  opacity: 0.6;
}
.me-marker-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  border-bottom: 1px solid var(--me-border);
  cursor: pointer;
  transition: background 0.15s;
}
.me-marker-item:hover {
  background: var(--me-accent-glow);
}
.me-marker-item-color {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}
.me-drawing-type-icon {
  color: var(--me-text-muted);
  flex-shrink: 0;
}
.me-marker-item-info {
  flex: 1;
  min-width: 0;
}
.me-marker-item-title {
  display: block;
  font-size: 13px;
  color: var(--me-text-primary);
  font-weight: 500;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.me-marker-item-coords {
  display: block;
  font-size: 11px;
  color: var(--me-text-muted);
}
.me-marker-item-delete {
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  padding: 4px;
  border-radius: var(--me-radius-xs);
  opacity: 0;
  transition: all 0.15s;
}
.me-marker-item:hover .me-marker-item-delete {
  opacity: 1;
}
.me-marker-item-delete:hover {
  color: #dc2626;
  background: rgba(220, 38, 38, 0.1);
}

/* Edit popup */
.me-popup-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
}
.me-popup {
  width: 400px;
  max-width: 90vw;
}
.me-popup-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid var(--me-border);
}
.me-popup-header h3 {
  font-size: 15px;
  font-weight: 700;
  color: var(--me-text-primary);
}
.me-popup-body {
  padding: 16px 20px;
}
.me-popup-footer {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 20px;
  border-top: 1px solid var(--me-border);
}
.me-popup-footer-spacer {
  flex: 1;
}
.me-popup-color-row {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.me-popup-opacity-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.me-color-options {
  display: flex;
  gap: 6px;
}
.me-color-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: all 0.15s;
}
.me-color-btn:hover {
  transform: scale(1.2);
}
.me-color-btn.active {
  border-color: white;
  box-shadow: 0 0 0 2px var(--me-accent);
}
.plugin-label {
  font-size: 12px;
  font-weight: 600;
  color: var(--me-text-secondary);
}
.me-btn-ghost {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  cursor: pointer;
  font-size: 13px;
}
.me-btn-ghost:hover {
  color: var(--me-text-primary);
}
.me-btn-primary {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: var(--me-accent);
  border: none;
  color: var(--me-bg-deep);
  cursor: pointer;
  font-size: 13px;
  font-weight: 600;
}
.me-btn-primary:hover {
  box-shadow: 0 0 16px var(--me-accent-glow);
}
.me-btn-danger {
  padding: 8px 16px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid rgba(248, 113, 113, 0.4);
  color: #f87171;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}
.me-btn-danger:hover {
  background: rgba(248, 113, 113, 0.1);
  border-color: #f87171;
}

/* Presence bar */
.me-presence-bar {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-right: 8px;
}
.me-presence-avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  overflow: hidden;
  border: 2px solid var(--me-border);
  flex-shrink: 0;
}
.me-presence-avatar img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.me-presence-avatar span {
  display: flex;
  width: 100%;
  height: 100%;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  font-weight: 700;
  color: white;
  font-family: var(--me-font-mono);
}

/* Entity menu */
.me-entity-menu {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm, 8px);
  padding: 8px 0;
  min-width: 200px;
  max-height: 320px;
  overflow-y: auto;
}
.me-entity-menu-title {
  padding: 6px 16px;
  font-size: 11px;
  font-weight: 700;
  color: var(--me-text-muted);
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
.me-entity-menu-item {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  padding: 8px 16px;
  background: none;
  border: none;
  color: var(--me-text-primary);
  font-size: 13px;
  cursor: pointer;
  transition: background 0.15s;
}
.me-entity-menu-item:hover {
  background: var(--me-accent-glow);
}

/* Entity type grid in popup */
.me-popup-entity-type {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.me-entity-type-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 4px;
}
.me-entity-type-btn {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  border-radius: var(--me-radius-xs);
  background: none;
  border: 1px solid var(--me-border);
  color: var(--me-text-secondary);
  font-size: 12px;
  cursor: pointer;
  transition: all 0.15s;
}
.me-entity-type-btn:hover {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
}
.me-entity-type-btn.active {
  border-color: var(--me-accent);
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.me-layers-menu {
  background: var(--me-bg-surface);
  border: 1px solid var(--me-border);
  border-radius: 8px;
  padding: 8px 0;
  min-width: 200px;
  box-shadow: 0 8px 24px rgba(0,0,0,0.3);
}
.me-layers-menu-title {
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--me-text-muted);
  padding: 4px 14px 8px;
  border-bottom: 1px solid var(--me-border);
  margin-bottom: 4px;
}
.me-layers-menu-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  cursor: pointer;
  font-size: 12px;
  color: var(--me-text-primary);
  transition: background 0.1s;
  text-transform: capitalize;
}
.me-layers-menu-item:hover {
  background: var(--me-accent-glow);
}
.me-tileset-popup .mapboxgl-popup-content {
  background: var(--me-bg-surface, #1a1a2e);
  color: var(--me-text-primary, #e0e0e0);
  border: 1px solid var(--me-border, #333);
  border-radius: 8px;
  padding: 10px 14px;
  font-family: var(--me-font-mono, monospace);
  box-shadow: 0 4px 16px rgba(0,0,0,0.4);
}
.me-tileset-popup .mapboxgl-popup-close-button {
  color: var(--me-text-muted, #888);
  font-size: 16px;
  padding: 4px 8px;
}
.me-tileset-popup .mapboxgl-popup-close-button:hover {
  color: var(--me-accent, #7c3aed);
  background: transparent;
}
.me-tileset-popup .mapboxgl-popup-tip {
  border-top-color: var(--me-bg-surface, #1a1a2e);
}
</style>
