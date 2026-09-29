import { ParseResult, ScriptBlock, Span, isBlock } from "../parser/scriptParser";

// Outline of a script: modules, then their objects and sub-blocks.

export interface ScriptSymbol {
  name: string;
  detail: string;
  /** "module" | "object" (top-level) | "block" (nested). */
  kind: "module" | "object" | "block";
  span: Span;
  selectionSpan: Span;
  children: ScriptSymbol[];
}

function toSymbol(block: ScriptBlock, depth: number, textLength: number): ScriptSymbol {
  const kind = depth === 0 ? "module" : depth === 1 ? "object" : "block";
  const end = (block.closeBrace ?? textLength - 1) + 1;
  return {
    name: block.name || block.type,
    detail: block.name ? block.type : "",
    kind,
    span: { start: block.headerSpan.start, end },
    selectionSpan: block.nameSpan ?? block.typeSpan,
    children: block.children.filter(isBlock).map((child) => toSymbol(child, depth + 1, textLength)),
  };
}

export function documentSymbols(parse: ParseResult): ScriptSymbol[] {
  return parse.root.children.filter(isBlock).map((block) => toSymbol(block, 0, parse.clean.length));
}
