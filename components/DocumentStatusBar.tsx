import type { SaveStatus } from "@/hooks/useWorkspace";

type DocumentStatusBarProps = {
  left: string;
  right: string;
  saveStatus: SaveStatus;
};

export function DocumentStatusBar({
  left,
  right,
  saveStatus,
}: DocumentStatusBarProps) {
  return (
    <footer className="status-bar flex min-h-8 shrink-0 items-center justify-between border-t border-border bg-pane-header px-4 font-mono text-[10px] text-muted">
      <span data-testid="status-footer" data-save-status={saveStatus}>{left}</span>
      <span>{right}</span>
    </footer>
  );
}
