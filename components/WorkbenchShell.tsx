import type { ReactNode } from "react";

type WorkbenchShellProps = {
  actions: ReactNode;
  children: ReactNode;
  inert: boolean;
  mobileDock: ReactNode;
  notices: ReactNode;
  statusBar: ReactNode;
  viewNavigation: ReactNode;
};

export function WorkbenchShell({
  actions,
  children,
  inert,
  mobileDock,
  notices,
  statusBar,
  viewNavigation,
}: WorkbenchShellProps) {
  return (
    <div className="h-[100dvh] overflow-hidden bg-background text-foreground">
      <div className="flex h-full min-h-0 flex-col" inert={inert || undefined}>
        {actions}
        {notices}
        {viewNavigation}
        {children}
        {statusBar}
        {mobileDock}
      </div>
    </div>
  );
}
