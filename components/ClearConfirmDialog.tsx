"use client";

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
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg">
        <p className="text-sm font-medium">Limpar conteúdo?</p>
        <p className="mt-1 text-xs text-muted">
          O editor volta ao exemplo padrão e o rascunho salvo é removido.
        </p>
        <div className="mt-4 flex justify-end gap-2">
          <button
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
            Limpar
          </button>
        </div>
      </div>
    </div>
  );
}
