import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { HomePage } from "./HomePage";

const { exportMarkdownToPdfMock, saveMock, workspaceControl } = vi.hoisted(() => ({
  exportMarkdownToPdfMock: vi.fn().mockResolvedValue(undefined),
  saveMock: vi.fn().mockResolvedValue(undefined),
  workspaceControl: {
    activePath: null as string | null,
    dirty: false,
    folderName: null as string | null,
    workspaceId: "standalone-draft",
    isFolderOpen: false,
    saveStatus: "saved" as "saved" | "unsaved" | "saving" | "error",
    saving: false,
  },
}));

vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: () =>
      function EditorStub(props: { onChange(value: string): void }) {
        return React.createElement(
          "button",
          {
            type: "button",
            "data-testid": "edit-markdown",
            onClick: () => props.onChange("# editado agora"),
          },
          "Editar",
        );
      },
  };
});

vi.mock("@/hooks/useWorkspace", async () => {
  const React = await import("react");
  return {
    useWorkspace: () => {
      const [markdown, setMarkdown] = React.useState("# conteúdo anterior");
      return {
        markdown,
        setMarkdown,
        hydrated: true,
        storageWarning: null,
        fsError: null,
        clearDocument: vi.fn(),
        files: [],
        activePath: workspaceControl.activePath,
        folderName: workspaceControl.folderName,
        workspaceId: workspaceControl.workspaceId,
        isFolderOpen: workspaceControl.isFolderOpen,
        dirty: workspaceControl.dirty,
        saving: workspaceControl.saving,
        saveStatus: workspaceControl.saveStatus,
        capabilities: {
          canOverwriteInPlace: true,
          canPersistDirectoryHandle: true,
        },
        openFolder: vi.fn(),
        openFile: vi.fn(),
        save: saveMock,
        closeFolder: vi.fn(),
      };
    },
  };
});

vi.mock("@/lib/exportPdf", () => ({
  exportMarkdownToPdf: exportMarkdownToPdfMock,
}));

vi.mock("@/hooks/useCopyMarkdown", () => ({
  useCopyMarkdown: () => ({
    copy: vi.fn(),
    canCopy: true,
    copyButtonLabel: "Copiar",
  }),
}));

vi.mock("@/hooks/useScrollSync", () => ({ useScrollSync: vi.fn() }));
vi.mock("@/components/Toolbar", () => ({ Toolbar: () => null }));
vi.mock("@/components/CapabilityBanner", () => ({
  CapabilityBanner: () => null,
}));
vi.mock("@/components/FileTree", () => ({ FileTree: () => null }));
vi.mock("@/components/FileTreeCollapsed", () => ({
  FileTreeCollapsed: () => null,
}));
vi.mock("@/components/Preview", () => ({ Preview: () => null }));
vi.mock("@/components/PreviewOverlay", () => ({
  PreviewOverlay: () => null,
}));
vi.mock("@/components/ClearConfirmDialog", () => ({
  ClearConfirmDialog: () => null,
}));
vi.mock("@/components/DirtyConfirmDialog", () => ({
  DirtyConfirmDialog: () => null,
}));
vi.mock("@/components/SplitPane", () => ({
  SplitPane: ({
    left,
    rightHeaderAction,
  }: {
    left: ReactNode;
    rightHeaderAction: ReactNode;
  }) => (
    <div>
      {left}
      {rightHeaderAction}
    </div>
  ),
}));

describe("HomePage regression baseline", () => {
  beforeEach(() => {
    workspaceControl.activePath = null;
    workspaceControl.dirty = false;
    workspaceControl.folderName = null;
    workspaceControl.isFolderOpen = false;
    workspaceControl.saveStatus = "saved";
    workspaceControl.saving = false;
  });

  afterEach(() => {
    cleanup();
    exportMarkdownToPdfMock.mockClear();
    saveMock.mockClear();
  });

  it.each([
    ["saved", "Salvo"],
    ["unsaved", "Não salvo"],
    ["saving", "Salvando…"],
    ["error", "Falha ao salvar"],
  ] as const)("renders the %s save status explicitly", (status, label) => {
    workspaceControl.activePath = "readme.md";
    workspaceControl.dirty = status !== "saved";
    workspaceControl.folderName = "demo";
    workspaceControl.isFolderOpen = true;
    workspaceControl.saveStatus = status;
    workspaceControl.saving = status === "saving";

    render(<HomePage />);

    const footer = screen.getByTestId("status-footer");
    expect(footer.getAttribute("data-save-status")).toBe(status);
    expect(footer.textContent).toContain(label);
  });

  it("ignores Ctrl+S while a save is already running", () => {
    workspaceControl.activePath = "readme.md";
    workspaceControl.dirty = true;
    workspaceControl.folderName = "demo";
    workspaceControl.isFolderOpen = true;
    workspaceControl.saveStatus = "saving";
    workspaceControl.saving = true;
    render(<HomePage />);

    fireEvent.keyDown(window, { key: "s", ctrlKey: true });

    expect(saveMock).not.toHaveBeenCalled();
  });

  it("feeds an immediate edit to PDF export without preview debounce", async () => {
    render(<HomePage />);
    fireEvent.click(screen.getByTestId("edit-markdown"));
    fireEvent.click(screen.getByTestId("preview-export-pdf"));

    await vi.waitFor(() => {
      expect(exportMarkdownToPdfMock).toHaveBeenCalledWith(
        "# editado agora",
        "mdstudio.io",
        expect.objectContaining({
          signal: expect.any(AbortSignal),
          onProgress: expect.any(Function),
        }),
      );
    });
  });
});
