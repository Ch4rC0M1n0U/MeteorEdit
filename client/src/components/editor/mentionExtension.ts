import { VueRenderer } from '@tiptap/vue-3';
import tippy, { type Instance as TippyInstance } from 'tippy.js';
import Mention from '@tiptap/extension-mention';
import MentionList from './MentionList.vue';
import api, { SERVER_URL } from '../../services/api';

function getInitials(firstName: string, lastName: string): string {
  return ((firstName?.[0] || '') + (lastName?.[0] || '')).toUpperCase();
}

interface MentionUser {
  id: string;
  label: string;
  email: string;
  initials: string;
  avatarUrl: string | null;
}

export function createMentionExtension(onMention?: (userId: string, label: string) => void) {
  return Mention.configure({
    HTMLAttributes: {
      class: 'mention',
    },
    suggestion: {
      char: '@',
      allowSpaces: true,
      items: async ({ query }: { query: string }): Promise<MentionUser[]> => {
        if (query.length < 1) return [];
        try {
          const { data } = await api.get('/auth/users/search', { params: { q: query } });
          return data.map((u: any) => ({
            id: u._id,
            label: `${u.firstName} ${u.lastName}`,
            email: u.email,
            initials: getInitials(u.firstName, u.lastName),
            avatarUrl: u.avatarPath ? `${SERVER_URL}/${u.avatarPath}` : null,
          }));
        } catch {
          return [];
        }
      },
      render: () => {
        let component: VueRenderer | null = null;
        let popup: TippyInstance[] | null = null;

        return {
          onStart: (props: any) => {
            component = new VueRenderer(MentionList, {
              props,
              editor: props.editor,
            });

            if (!props.clientRect) return;

            popup = tippy('body', {
              getReferenceClientRect: props.clientRect,
              appendTo: () => document.body,
              content: component.element,
              showOnCreate: true,
              interactive: true,
              trigger: 'manual',
              placement: 'bottom-start',
            });
          },
          onUpdate: (props: any) => {
            component?.updateProps(props);
            if (props.clientRect && popup?.[0]) {
              popup[0].setProps({
                getReferenceClientRect: props.clientRect,
              });
            }
          },
          onKeyDown: (props: any) => {
            if (props.event.key === 'Escape') {
              popup?.[0]?.hide();
              return true;
            }
            return (component?.ref as any)?.onKeyDown(props) ?? false;
          },
          onExit: () => {
            popup?.[0]?.destroy();
            component?.destroy();
            popup = null;
            component = null;
          },
        };
      },
      command: ({ editor, range, props }: any) => {
        editor
          .chain()
          .focus()
          .insertContentAt(range, [
            { type: 'mention', attrs: props },
            { type: 'text', text: ' ' },
          ])
          .run();

        if (onMention) {
          onMention(props.id, props.label);
        }
      },
    },
  });
}
