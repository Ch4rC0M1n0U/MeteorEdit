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

const primeIcons = {
  'mdi-pencil': 'pi-pencil',
  'mdi-delete': 'pi-trash',
  'mdi-trash-can-outline': 'pi-trash',
  'mdi-delete-outline': 'pi-trash',
  'mdi-close': 'pi-times',
  'mdi-check': 'pi-check',
  'mdi-plus': 'pi-plus',
  'mdi-minus': 'pi-minus',
  'mdi-cog': 'pi-cog',
  'mdi-account': 'pi-user',
  'mdi-refresh': 'pi-refresh',
  'mdi-download': 'pi-download',
  'mdi-upload': 'pi-upload',
  'mdi-save': 'pi-save',
  'mdi-search': 'pi-search',
  'mdi-magnify': 'pi-search',
  'mdi-eye': 'pi-eye',
  'mdi-eye-off': 'pi-eye-slash',
  'mdi-content-copy': 'pi-copy',
  'mdi-information': 'pi-info-circle',
  'mdi-warning': 'pi-exclamation-triangle',
  'mdi-play': 'pi-play',
  'mdi-stop': 'pi-stop',
  'mdi-pause': 'pi-pause',
  'mdi-image': 'pi-image',
  'mdi-undo': 'pi-undo',
  'mdi-pencil-outline': 'pi-pencil',
  'mdi-send': 'pi-send',
  'mdi-download-outline': 'pi-download',
  'mdi-upload-outline': 'pi-upload',
};

let totalReplacements = 0;

for (const filepath of files) {
  const fullPath = path.join(root, filepath);
  if (!fs.existsSync(fullPath)) {
    console.log(`MISSING: ${filepath}`);
    continue;
  }

  let content = fs.readFileSync(fullPath, 'utf-8');
  const original = content;
  let count = 0;

  // Replace all <v-icon ...>content</v-icon>
  content = content.replace(/<v-icon([^>]*)>([\s\S]*?)<\/v-icon>/g, (match, attrs, inner) => {
    count++;
    inner = inner.trim();

    // Extract size
    const sizeM = attrs.match(/size="(\d+)"/);
    const size = sizeM ? sizeM[1] : '16';
    attrs = attrs.replace(/\s*size="\d+"/, '');

    // Extract color (both :color and color)
    const colorM = attrs.match(/:?color="([^"]+)"/);
    const colorVal = colorM ? colorM[1] : '';
    attrs = attrs.replace(/\s*:?color="[^"]+"/, '');

    // Extract class
    const classM = attrs.match(/\bclass="([^"]+)"/);
    const extraClass = classM ? classM[1] : '';
    attrs = attrs.replace(/\s*\bclass="[^"]+"/, '');

    // Extract :class
    const dclassM = attrs.match(/:class="([^"]+)"/);
    const dynClass = dclassM ? dclassM[1] : '';
    attrs = attrs.replace(/\s*:class="[^"]+"/, '');

    attrs = attrs.trim();

    // Build style
    const styleParts = [`font-size: ${size}px`];
    if (colorVal) styleParts.push(`color: ${colorVal}`);
    const styleStr = styleParts.join('; ');

    // Check if inner is dynamic ({{ expr }})
    const isDynamic = inner.includes('{{') || (inner.includes("'mdi-") && inner.includes('?'));

    if (isDynamic) {
      // Dynamic expression like {{ expr ? 'mdi-x' : 'mdi-y' }}
      const expr = inner.replace(/^\{\{/, '').replace(/\}\}$/, '').trim();
      let baseClass = 'mdi';
      if (extraClass) baseClass += ' ' + extraClass;
      let tag = '<span';
      if (dynClass) {
        tag += ` :class="['${baseClass}', ${expr}, ${dynClass}]"`;
      } else {
        tag += ` :class="['${baseClass}', ${expr}]"`;
      }
      tag += ` style="${styleStr}"`;
      if (attrs) tag += ` ${attrs}`;
      tag += '></span>';
      return tag;
    }

    // Static icon name
    const iconName = inner;
    const pi = primeIcons[iconName];

    if (pi) {
      let cls = `pi ${pi}`;
      if (extraClass) cls += ` ${extraClass}`;
      let tag = `<i class="${cls}" style="${styleStr}"`;
      if (dynClass) tag += ` :class="${dynClass}"`;
      if (attrs) tag += ` ${attrs}`;
      tag += '></i>';
      return tag;
    } else {
      let cls = `mdi ${iconName}`;
      if (extraClass) cls += ` ${extraClass}`;
      let tag = `<span class="${cls}" style="${styleStr}"`;
      if (dynClass) tag += ` :class="${dynClass}"`;
      if (attrs) tag += ` ${attrs}`;
      tag += '></span>';
      return tag;
    }
  });

  if (content !== original) {
    fs.writeFileSync(fullPath, content, 'utf-8');
    console.log(`${filepath}: ${count} v-icon replacements`);
    totalReplacements += count;
  } else {
    console.log(`${filepath}: no changes needed`);
  }
}

console.log(`\nTotal replacements: ${totalReplacements}`);
