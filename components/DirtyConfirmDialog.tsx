"use client";

type DirtyConfirmDialogProps = {
  open: boolean;
  title?: string;
  description?: string;
  onCancel: () => void;
  onDiscard: () => void;
  onSave?: () => void;
  saving?: boolean;
};

export function DirtyConfirmDialog({
  open,
  title = "Alterações não salvas",
  description = "O arquivo atual tem mudanças que ainda não foram gravadas.",
  onCancel,
  onDiscard,
  onSave,
  saving = false,
}: DirtyConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="w-full max-w-sm rounded-lg border border-border bg-surface p-5 shadow-lg"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dirty-confirm-title"
        data-testid="dirty-confirm-dialog"
      >
        <p id="dirty-confirm-title" className="text-sm font-medium">
          {title}
        </p>
        <p className="mt-1 text-xs text-muted">{description}</p>
        <div className="mt-4 flex flex-wrap justify-end gap-2">
          <button
            type="button"
            className="ui-pressable rounded-md px-3 py-1.5 text-xs text-muted hover:bg-pane-header"
            onClick={onCancel}
            disabled={saving}
            data-testid="dirty-confirm-cancel"
          >
            Cancelar
          </button>
          <button
            type="button"
            className="ui-pressable rounded-md border border-border px-3 py-1.5 text-xs text-foreground hover:bg-pane-header"
            onClick={onDiscard}
            disabled={saving}
            data-testid="dirty-confirm-discard"
          >
            Descartar
          </button>
          {onSave && (
            <button
              type="button"
              className="ui-pressable rounded-md bg-foreground px-3 py-1.5 text-xs text-background hover:opacity-90 disabled:opacity-40"
              onClick={onSave}
              disabled={saving}
              data-testid="dirty-confirm-save"
            >
              {saving ? "Salvando…" : "Salvar"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
