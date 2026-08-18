"use client";

import { markdown } from "@codemirror/lang-markdown";
import { Compartment, EditorState } from "@codemirror/state";
import { oneDark } from "@codemirror/theme-one-dark";
import { EditorView } from "@codemirror/view";
import { useEffect, useRef } from "react";
import { useTheme } from "@/components/ThemeProvider";

type EditorProps = {
  value: string;
  onChange: (value: string) => void;
  /** CodeMirror scroll container (`.cm-scroller`), for scroll sync. */
  onScrollerReady?: (scroller: HTMLElement | null) => void;
};

const baseTheme = EditorView.theme({
  "&": { height: "100%", fontSize: "13px" },
  ".cm-scroller": { fontFamily: "var(--font-mono), ui-monospace, monospace" },
  ".cm-content": { padding: "16px" },
  "&.cm-focused": {
    outline: "2px solid var(--connection)",
    outlineOffset: "-2px",
  },
});

const themeCompartment = new Compartment();

export function Editor({ value, onChange, onScrollerReady }: EditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  const onScrollerReadyRef = useRef(onScrollerReady);
  const { mode } = useTheme();

  onChangeRef.current = onChange;
  onScrollerReadyRef.current = onScrollerReady;

  useEffect(() => {
    if (!containerRef.current) return;

    const updateListener = EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChangeRef.current(update.state.doc.toString());
      }
    });

    const state = EditorState.create({
      doc: value,
      extensions: [
        markdown(),
        baseTheme,
        themeCompartment.of(mode === "dark" ? oneDark : []),
        updateListener,
        EditorView.lineWrapping,
      ],
    });

    const view = new EditorView({ state, parent: containerRef.current });
    viewRef.current = view;
    onScrollerReadyRef.current?.(view.scrollDOM);

    return () => {
      onScrollerReadyRef.current?.(null);
      view.destroy();
      viewRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- mount once
  }, []);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;

    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch({
      effects: themeCompartment.reconfigure(mode === "dark" ? oneDark : []),
    });
  }, [mode]);

  return <div ref={containerRef} className="h-full min-h-0" data-testid="editor" />;
}
