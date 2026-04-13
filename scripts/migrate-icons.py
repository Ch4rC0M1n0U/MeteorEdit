import re
import os

os.chdir(os.path.join(os.path.dirname(__file__), '..'))

files = [
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
]

prime_icons = {
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
}

total_replacements = 0

for filepath in files:
    if not os.path.exists(filepath):
        print(f'MISSING: {filepath}')
        continue

    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    original = content
    count = 0

    def get_pi_icon(icon_name):
        return prime_icons.get(icon_name)

    def replace_v_icon(match):
        nonlocal count
        count += 1
        full = match.group(0)
        attrs = match.group(1) or ''
        inner = match.group(2).strip()

        # Extract size
        size_m = re.search(r'size="(\d+)"', attrs)
        size = size_m.group(1) if size_m else '16'
        attrs = re.sub(r'\s*size="\d+"', '', attrs)

        # Extract color
        color_m = re.search(r':?color="([^"]+)"', attrs)
        color_val = color_m.group(1) if color_m else ''
        attrs = re.sub(r'\s*:?color="[^"]+"', '', attrs)

        # Extract class
        class_m = re.search(r'class="([^"]+)"', attrs)
        extra_class = class_m.group(1) if class_m else ''
        attrs = re.sub(r'\s*class="[^"]+"', '', attrs)

        # Extract :class
        dclass_m = re.search(r':class="([^"]+)"', attrs)
        dyn_class = dclass_m.group(1) if dclass_m else ''
        attrs = re.sub(r'\s*:class="[^"]+"', '', attrs)

        attrs = attrs.strip()

        # Build style
        style_parts = [f'font-size: {size}px']
        if color_val:
            style_parts.append(f'color: {color_val}')
        style_str = '; '.join(style_parts)

        # Check if inner is a static icon name or dynamic
        is_dynamic = '{{' in inner or '{' in inner

        if is_dynamic:
            # Dynamic: {{ expr }}
            expr = inner.replace('{{', '').replace('}}', '').strip()
            base_class = 'mdi'
            if extra_class:
                base_class += ' ' + extra_class
            tag = '<span'
            if dyn_class:
                tag += f' :class="[\'{base_class}\', {expr}, {dyn_class}]"'
            else:
                tag += f' :class="[\'{base_class}\', {expr}]"'
            tag += f' style="{style_str}"'
            if attrs:
                tag += f' {attrs}'
            tag += '></span>'
            return tag

        # Static icon name
        icon_name = inner
        pi = get_pi_icon(icon_name)

        if pi:
            cls = f'pi {pi}'
            if extra_class:
                cls += f' {extra_class}'
            tag = f'<i class="{cls}" style="{style_str}"'
            if dyn_class:
                tag += f' :class="{dyn_class}"'
            if attrs:
                tag += f' {attrs}'
            tag += '></i>'
        else:
            cls = f'mdi {icon_name}'
            if extra_class:
                cls += f' {extra_class}'
            tag = f'<span class="{cls}" style="{style_str}"'
            if dyn_class:
                tag += f' :class="{dyn_class}"'
            if attrs:
                tag += f' {attrs}'
            tag += '></span>'

        return tag

    # Match all <v-icon ...>content</v-icon>
    content = re.sub(
        r'<v-icon([^>]*)>(.*?)</v-icon>',
        replace_v_icon,
        content,
        flags=re.DOTALL
    )

    if content != original:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
        print(f'{filepath}: {count} v-icon replacements')
        total_replacements += count
    else:
        print(f'{filepath}: no changes needed')

print(f'\nTotal replacements: {total_replacements}')
