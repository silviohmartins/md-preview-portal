import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SplitPane } from "./SplitPane";

afterEach(cleanup);

describe("SplitPane", () => {
  it("resizes by keyboard and exposes the current ratio", () => {
    const onRatioChange = vi.fn();
    render(<SplitPane left={<div>Fonte</div>} right={<div>Resultado</div>} ratio={50} onRatioChange={onRatioChange} />);
    const divider = screen.getByRole("separator", { name: "Redimensionar editor e preview" });
    expect(divider.getAttribute("aria-valuenow")).toBe("50");
    fireEvent.keyDown(divider, { key: "ArrowRight" });
    expect(onRatioChange).toHaveBeenCalledWith(55);
    fireEvent.keyDown(divider, { key: "Home" });
    expect(onRatioChange).toHaveBeenLastCalledWith(35);
  });

  it("removes inactive panes from navigation", () => {
    const { rerender } = render(<SplitPane left={<div>Fonte</div>} right={<div>Resultado</div>} viewMode="editor" />);
    expect(screen.getByText("Fonte").closest("section")?.hidden).toBe(false);
    expect(screen.getByText("Resultado").closest("section")?.hidden).toBe(true);
    rerender(<SplitPane left={<div>Fonte</div>} right={<div>Resultado</div>} viewMode="preview" />);
    expect(screen.getByText("Fonte").closest("section")?.hidden).toBe(true);
    expect(screen.getByText("Resultado").closest("section")?.hidden).toBe(false);
  });
});
