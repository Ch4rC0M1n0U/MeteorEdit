import { Image } from '@tiptap/extension-image';
import { VueNodeViewRenderer } from '@tiptap/vue-3';
import ResizableImage from './ResizableImage.vue';

export const ResizableImageExtension = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (element) => {
          return element.getAttribute('width') || element.style.width?.replace('px', '') || null;
        },
        renderHTML: (attributes) => {
          if (!attributes.width) return {};
          return { width: attributes.width };
        },
      },
    };
  },

  addNodeView() {
    return VueNodeViewRenderer(ResizableImage);
  },
});
