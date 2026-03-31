import { Node, mergeAttributes } from '@tiptap/core';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (type: string) => ReturnType;
      toggleCallout: (type: string) => ReturnType;
    };
  }
}

export const Callout = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'info',
        parseHTML: (element: HTMLElement) => element.getAttribute('data-callout-type') || 'info',
        renderHTML: (attributes: Record<string, string>) => ({ 'data-callout-type': attributes.type }),
      },
    };
  },

  parseHTML() {
    return [{ tag: 'div[data-callout-type]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: `callout callout--${HTMLAttributes['data-callout-type'] || 'info'}` }), 0];
  },

  addCommands() {
    return {
      setCallout: (type: string) => ({ commands }) => {
        return commands.wrapIn(this.name, { type });
      },
      toggleCallout: (type: string) => ({ commands, editor }) => {
        if (editor.isActive('callout', { type })) {
          return commands.lift(this.name);
        }
        return commands.wrapIn(this.name, { type });
      },
    };
  },
});
