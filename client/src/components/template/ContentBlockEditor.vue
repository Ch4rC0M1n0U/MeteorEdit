<template>
  <div class="cbe-wrap">
    <div class="cbe-toolbar" v-if="editor">
      <button class="cbe-btn" :class="{ active: editor.isActive('bold') }" @click="editor.chain().focus().toggleBold().run()" type="button">
        <span class="mdi mdi-format-bold" />
      </button>
      <button class="cbe-btn" :class="{ active: editor.isActive('italic') }" @click="editor.chain().focus().toggleItalic().run()" type="button">
        <span class="mdi mdi-format-italic" />
      </button>
      <button class="cbe-btn" :class="{ active: editor.isActive('underline') }" @click="editor.chain().focus().toggleUnderline().run()" type="button">
        <span class="mdi mdi-format-underline" />
      </button>
      <div class="cbe-sep" />
      <button class="cbe-btn cbe-btn-text" :class="{ active: editor.isActive('heading', { level: 2 }) }" @click="editor.chain().focus().toggleHeading({ level: 2 }).run()" type="button">
        <span class="mono">H2</span>
      </button>
      <button class="cbe-btn cbe-btn-text" :class="{ active: editor.isActive('heading', { level: 3 }) }" @click="editor.chain().focus().toggleHeading({ level: 3 }).run()" type="button">
        <span class="mono">H3</span>
      </button>
      <div class="cbe-sep" />
      <button class="cbe-btn" :class="{ active: editor.isActive('bulletList') }" @click="editor.chain().focus().toggleBulletList().run()" type="button">
        <span class="mdi mdi-format-list-bulleted" />
      </button>
      <button class="cbe-btn" :class="{ active: editor.isActive('orderedList') }" @click="editor.chain().focus().toggleOrderedList().run()" type="button">
        <span class="mdi mdi-format-list-numbered" />
      </button>
    </div>
    <editor-content :editor="editor" class="cbe-content" />
  </div>
</template>

<script setup lang="ts">
import { shallowRef, onMounted, onBeforeUnmount, watch } from 'vue';
import { Editor, EditorContent } from '@tiptap/vue-3';
import StarterKit from '@tiptap/starter-kit';
import { Underline } from '@tiptap/extension-underline';
import { Placeholder } from '@tiptap/extension-placeholder';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();

const props = defineProps<{
  modelValue: any;
  placeholder?: string;
}>();

const emit = defineEmits<{
  'update:modelValue': [value: any];
}>();

const editor = shallowRef<Editor | null>(null);
let skipNextUpdate = false;

onMounted(() => {
  editor.value = new Editor({
    extensions: [
      StarterKit,
      Underline,
      Placeholder.configure({ placeholder: props.placeholder || t('questionBuilder.contentPlaceholder') }),
    ],
    content: props.modelValue || '',
    onUpdate: () => {
      skipNextUpdate = true;
      emit('update:modelValue', editor.value!.getJSON());
    },
  });
});

watch(() => props.modelValue, (val) => {
  if (skipNextUpdate) {
    skipNextUpdate = false;
    return;
  }
  if (editor.value && val) {
    editor.value.commands.setContent(val, false);
  }
});

onBeforeUnmount(() => {
  editor.value?.destroy();
});
</script>

<style scoped>
.cbe-wrap {
  border: 1px solid var(--me-border);
  border-radius: 6px;
  overflow: hidden;
}
.cbe-toolbar {
  display: flex;
  align-items: center;
  gap: 1px;
  padding: 3px 6px;
  border-bottom: 1px solid var(--me-border);
  background: var(--me-bg-surface);
  flex-wrap: wrap;
}
.cbe-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  background: none;
  border: none;
  color: var(--me-text-muted);
  cursor: pointer;
  font-size: 14px;
  transition: all 0.15s;
}
.cbe-btn:hover { background: var(--me-accent-glow); color: var(--me-text-primary); }
.cbe-btn.active { background: var(--me-accent-glow); color: var(--me-accent); }
.cbe-btn-text { width: auto; padding: 0 5px; font-size: 10px; font-weight: 700; }
.cbe-sep { width: 1px; height: 16px; background: var(--me-border); margin: 0 3px; }
</style>

<style>
.cbe-content {
  min-height: 80px;
  max-height: 200px;
  overflow-y: auto;
  padding: 10px 12px;
}
.cbe-content .ProseMirror {
  min-height: 60px;
  outline: none;
  font-family: var(--me-font-body);
  font-size: 13px;
  line-height: 1.5;
  color: var(--me-text-primary);
}
.cbe-content .ProseMirror p.is-editor-empty:first-child::before {
  content: attr(data-placeholder);
  float: left;
  color: var(--me-text-muted);
  pointer-events: none;
  height: 0;
}
</style>
