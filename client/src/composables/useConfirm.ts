import { ref, reactive } from 'vue';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'default';
  /** For prompt mode */
  prompt?: boolean;
  promptLabel?: string;
  promptDefault?: string;
}

interface ConfirmState {
  visible: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  variant: 'danger' | 'warning' | 'default';
  prompt: boolean;
  promptLabel: string;
  promptValue: string;
  resolve: ((value: boolean | string | null) => void) | null;
}

const state = reactive<ConfirmState>({
  visible: false,
  title: '',
  message: '',
  confirmText: 'Confirmer',
  cancelText: 'Annuler',
  variant: 'default',
  prompt: false,
  promptLabel: '',
  promptValue: '',
  resolve: null,
});

export function useConfirm() {
  function confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise((resolve) => {
      state.visible = true;
      state.title = options.title || 'Confirmation';
      state.message = options.message;
      state.confirmText = options.confirmText || 'Confirmer';
      state.cancelText = options.cancelText || 'Annuler';
      state.variant = options.variant || 'default';
      state.prompt = false;
      state.resolve = (val) => resolve(val as boolean);
    });
  }

  function prompt(options: ConfirmOptions): Promise<string | null> {
    return new Promise((resolve) => {
      state.visible = true;
      state.title = options.title || '';
      state.message = options.message;
      state.confirmText = options.confirmText || 'OK';
      state.cancelText = options.cancelText || 'Annuler';
      state.variant = options.variant || 'default';
      state.prompt = true;
      state.promptLabel = options.promptLabel || '';
      state.promptValue = options.promptDefault || '';
      state.resolve = (val) => resolve(val as string | null);
    });
  }

  function handleConfirm() {
    if (state.resolve) {
      state.resolve(state.prompt ? state.promptValue : true);
    }
    state.visible = false;
    state.resolve = null;
  }

  function handleCancel() {
    if (state.resolve) {
      state.resolve(state.prompt ? null : false);
    }
    state.visible = false;
    state.resolve = null;
  }

  return { state, confirm, prompt, handleConfirm, handleCancel };
}
