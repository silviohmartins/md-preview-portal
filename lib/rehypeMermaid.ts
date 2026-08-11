import type { Element, Root, RootContent } from "hast";

function isMermaidCode(node: RootContent): node is Element {
  return (
    node.type === "element" &&
    node.tagName === "code" &&
    Array.isArray(node.properties?.className) &&
    (node.properties!.className as unknown[]).includes("language-mermaid")
  );
}

function extractText(node: RootContent): string {
  if (node.type === "text") return node.value;
  if ("children" in node) {
    return node.children.map(extractText).join("");
  }
  return "";
}

function transform(node: Root | Element): void {
  node.children.forEach((child, index) => {
    if (
      child.type === "element" &&
      child.tagName === "pre" &&
      child.children.length === 1 &&
      isMermaidCode(child.children[0])
    ) {
      const source = extractText(child.children[0]).replace(/\n$/, "");
      const replacement: Element = {
        type: "element",
        tagName: "div",
        properties: { "data-mermaid-source": source },
        children: [],
      };
      node.children[index] = replacement;
      return;
    }
    if (child.type === "element") {
      transform(child);
    }
  });
}

/** Replaces ```mermaid code fences with a placeholder div carrying the raw
 * source in data-mermaid-source, rendered client-side by MermaidDiagram. */
export function rehypeMermaid() {
  return (tree: Root) => {
    transform(tree);
  };
}
