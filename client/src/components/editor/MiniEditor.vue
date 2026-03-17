<template>
  <div class="mini-editor">
    <span v-if="label" class="mini-editor-label mono">{{ label }}</span>
    <div class="mini-editor-toolbar">
      <button type="button" @click="editor?.chain().focus().toggleBold().run()" :class="{ active: editor?.isActive('bold') }" title="Gras">
        <v-icon size="16">mdi-format-bold</v-icon>
      </button>
      <button type="button" @click="editor?.chain().focus().toggleItalic().run()" :class="{ active: editor?.isActive('italic') }" title="Italique">
        <v-icon size="16">mdi-format-italic</v-icon>
      </button>
      <button type="button" @click="editor?.chain().focus().toggleUnderline().run()" :class="{ active: editor?.isActive('underline') }" title="Souligné">
        <v-icon size="16">mdi-format-underline</v-icon>
      </button>
      <span class="mini-editor-sep" />
      <button type="button" @click="editor?.chain().focus().toggleBulletList().run()" :class="{ active: editor?.isActive('bulletList') }" title="Liste">
        <v-icon size="16">mdi-format-list-bulleted</v-icon>
      </button>
      <button type="button" @click="editor?.chain().focus().toggleOrderedList().run()" :class="{ active: editor?.isActive('orderedList') }" title="Liste numérotée">
        <v-icon size="16">mdi-format-list-numbered</v-icon>
      </button>
    </div>
    <EditorContent :editor="editor" class="mini-editor-content" />
  </div>
</template>

<script setup lang="ts">
import { watch, onBeforeUnmount } from 'vue';
import { useEditor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Placeholder } from '@tiptap/extension-placeholder';
import { createLanguageToolExtension } from './languageToolExtension';

const props = defineProps<{
  modelValue: string;
  label?: string;
  placeholder?: string;
  spellCheck?: boolean;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: string];
}>();

const editor = useEditor({
  content: props.modelValue || '',
  extensions: [
    StarterKit.configure({
      heading: false,
      codeBlock: false,
      blockquote: false,
      horizontalRule: false,
      code: false,
    }),
    Underline,
    Placeholder.configure({ placeholder: props.placeholder || '' }),
    ...(props.spellCheck ? [createLanguageToolExtension({ language: 'auto', enabled: true })] : []),
  ],
  onUpdate({ editor: e }) {
    emit('update:modelValue', e.getHTML());
  },
});

watch(() => props.modelValue, (val) => {
  if (editor.value && editor.value.getHTML() !== val) {
    editor.value.commands.setContent(val || '', false);
  }
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style scoped>
.mini-editor {
  border: 1px solid var(--me-border);
  border-radius: var(--me-radius-sm);
  overflow: hidden;
  background: var(--me-bg-surface);
}
.mini-editor-label {
  display: block;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 1px;
  color: var(--me-text-muted);
  padding: 8px 12px 0;
}
.mini-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 4px 8px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-elevated);
}
.mini-editor-toolbar button {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  border-radius: var(--me-radius-xs);
  transition: all 0.15s;
}
.mini-editor-toolbar button:hover {
  background: var(--me-accent-glow);
  color: var(--me-text-primary);
}
.mini-editor-toolbar button.active {
  background: var(--me-accent-glow);
  color: var(--me-accent);
}
.mini-editor-sep {
  width: 1px;
  height: 18px;
  background: var(--me-border);
  margin: 0 4px;
}
.mini-editor-content {
  min-height: 80px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 12px;
  font-size: 13px;
  line-height: 1.6;
  color: var(--me-text-primary);
}
.mini-editor-content :deep(.tiptap) {
  outline: none;
  min-height: 60px;
}
.mini-editor-content :deep(.tiptap p) {
  margin: 0 0 4px;
}
.mini-editor-content :deep(.tiptap ul),
.mini-editor-content :deep(.tiptap ol) {
  padding-left: 20px;
  margin: 4px 0;
}
.mini-editor-content :deep(.tiptap p.is-editor-empty:first-child::before) {
  content: attr(data-placeholder);
  color: var(--me-text-muted);
  pointer-events: none;
  float: left;
  height: 0;
}
</style>
