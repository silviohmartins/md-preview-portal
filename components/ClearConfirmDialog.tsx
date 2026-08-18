"use client";

import { useRef } from "react";
import { Dialog } from "@/components/Dialog";

type ClearConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export function ClearConfirmDialog({
  open,
  onCancel,
  onConfirm,
}: ClearConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);

  return (
    <Dialog
      open={open}
      onClose={onCancel}
      ariaLabelledBy="clear-confirm-title"
      initialFocusRef={cancelRef}
      className="w-full max-w-sm rounded-xl border border-border bg-surface p-5 shadow-2xl"
    >
        <p id="clear-confirm-title" className="text-sm font-semibold">Limpar rascunho?</p>
        <p className="mt-1 text-xs text-muted">
          Todo o conteúdo do editor e o rascunho salvo neste navegador serão apagados.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            ref={cancelRef}
            type="button"
            className="ui-pressable rounded-md px-3 py-1.5 text-xs text-muted hover:bg-pane-header"
            onClick={onCancel}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="ui-pressable rounded-md bg-red-600 px-3 py-1.5 text-xs text-white hover:bg-red-700"
            onClick={onConfirm}
          >
            Limpar rascunho
          </button>
        </div>
    </Dialog>
  );
}
