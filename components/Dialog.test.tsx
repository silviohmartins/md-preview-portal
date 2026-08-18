import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { Dialog } from "./Dialog";

afterEach(cleanup);

function DialogHarness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)}>Abrir</button>
      <Dialog open={open} onClose={() => setOpen(false)} ariaLabel="Teste" className="dialog">
        <button type="button">Primeiro</button>
        <button type="button">Último</button>
      </Dialog>
    </>
  );
}

function NestedDialogHarness() {
  const [outerOpen, setOuterOpen] = useState(true);
  const [innerOpen, setInnerOpen] = useState(false);
  return (
    <Dialog open={outerOpen} onClose={() => setOuterOpen(false)} ariaLabel="Externo" className="outer-dialog">
      <button type="button" onClick={() => setInnerOpen(true)}>Abrir interno</button>
      <Dialog open={innerOpen} onClose={() => setInnerOpen(false)} ariaLabel="Interno" className="inner-dialog">
        <button type="button">Confirmar interno</button>
      </Dialog>
    </Dialog>
  );
}

describe("Dialog", () => {
  it("traps focus, closes with Escape and restores the trigger", async () => {
    render(<DialogHarness />);
    const trigger = screen.getByText("Abrir");
    trigger.focus();
    fireEvent.click(trigger);

    await waitFor(() => expect(document.activeElement).toBe(screen.getByText("Primeiro")));
    screen.getByText("Último").focus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(document.activeElement).toBe(screen.getByText("Primeiro"));

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it("wraps backwards from the first focusable control", async () => {
    render(<DialogHarness />);
    fireEvent.click(screen.getByText("Abrir"));
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText("Primeiro")));
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(screen.getByText("Último"));
  });

  it("keeps a nested dialog interactive and Escape closes only the top layer", async () => {
    render(<NestedDialogHarness />);
    await waitFor(() => expect(screen.getByText("Abrir interno")).toBe(document.activeElement));
    fireEvent.click(screen.getByText("Abrir interno"));
    const dialogs = await screen.findAllByRole("dialog");
    const outer = dialogs.find((dialog) => dialog.getAttribute("aria-label") === "Externo")!;
    const inner = dialogs.find((dialog) => dialog.getAttribute("aria-label") === "Interno")!;
    await waitFor(() => expect(document.activeElement).toBe(screen.getByText("Confirmar interno")));
    expect(outer.inert).toBe(true);
    expect(inner.closest("[inert]")).toBeNull();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog", { name: "Interno" })).toBeNull());
    expect(screen.getByRole("dialog", { name: "Externo" })).toBeTruthy();
  });
});
