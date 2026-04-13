import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');

const files = [
  'client/src/components/editor/NoteEditor.vue',
  'client/src/components/map/MapEditor.vue',
  'client/src/components/media/MediaEditor.vue',
  'client/src/components/media/SocialSessionManager.vue',
  'client/src/components/dataset/DatasetEditor.vue',
  'client/src/components/media/MediaCreateDialog.vue',
  'client/src/components/media/AudioWaveform.vue',
  'client/src/components/media/MediaMetadataDialog.vue',
  'client/src/components/dossier/WebCheckImportDialog.vue',
  'client/src/components/media/ProfileAnalyzer.vue',
  'client/src/components/media/MediaDownloader.vue',
  'client/src/components/editor/ImageAnnotator.vue',
  'client/src/components/AiDisclaimerModal.vue',
  'client/src/components/editor/ResizableImage.vue',
  'client/src/components/editor/MiniEditor.vue',
  'client/src/components/editor/CommentSidebar.vue',
  'client/src/components/mindmap/MindmapEditor.vue',
  'client/src/components/excalidraw/ExcalidrawWrapper.vue',
];

for (const filepath of files) {
  const fullPath = path.join(root, filepath);
  if (!fs.existsSync(fullPath)) continue;

  let content = fs.readFileSync(fullPath, 'utf-8');
  const original = content;

  // Check what Vuetify tags remain
  const vuetifyTags = content.match(/<\/?v-[a-z][\w-]*/g);
  if (!vuetifyTags || vuetifyTags.length === 0) continue;

  const unique = [...new Set(vuetifyTags.filter(t => t.startsWith('<v-')))];
  console.log(`${filepath}: remaining tags: ${unique.join(', ')}`);
}
