import { Span } from "./scriptParser";

// Parser for craftRecipe input/output lines, e.g.
//   item 1 tags[base:hammer] mode:keep flags[Prop1;MayDegradeLight]
//   item 2 [Base.Plank;25:Base.Thread_Sinew] mappers[woodType]
//   -fluid 0.2 categories[Water] mode:mixture
//   item variable[1:20] Base.CornSeed
// Syntax taken from zombie.scripting.entity.components.crafting.InputScript / OutputScript.

export type RecipeTokenKind =
  | "resource" // item / fluid / energy, with optional +/- prefix
  | "amount" // number or variable[min:max]
  | "ids" // [A;B;25:C]
  | "tags"
  | "categories"
  | "flags"
  | "mappers"
  | "option" // mode:x, mapper:x, chance:x, shapedIndex:x, apply:x
  | "keyword" // overlayMapper
  | "id" // direct output id: Base.Rope
  | "unknown";

export interface RecipeListEntry {
  text: string;
  span: Span;
}

export interface RecipeToken {
  kind: RecipeTokenKind;
  text: string;
  span: Span;
  /** List entries for ids/tags/categories/flags/mappers. */
  entries?: RecipeListEntry[];
  /** For options: name before ":" and value after it. */
  option?: string;
  optionValue?: string;
}

export interface RecipeLine {
  tokens: RecipeToken[];
  resource?: "item" | "fluid" | "energy";
  prefix?: "+" | "-";
}

export const RESOURCE_TYPES = ["item", "fluid", "energy"];
export const OPTIONS = ["mode", "mapper", "chance", "shapedIndex", "apply"];
export const ITEM_MODES = ["keep", "destroy", "use", "useprop1", "useprop2", "keepprop1", "keepprop2", "prop1", "prop2"];
export const FLUID_MODES = ["exact", "primary", "mixture", "anything"];
export const LIST_PREFIXES = ["tags", "categories", "flags", "mappers"];

const LIST = /^(tags|categories|flags|mappers)?\[(.*)\]$/s;

function listEntries(text: string, contentStart: number): RecipeListEntry[] {
  const entries: RecipeListEntry[] = [];
  let start = 0;
  for (let i = 0; i <= text.length; i++) {
    if (i === text.length || text[i] === ";") {
      const raw = text.slice(start, i);
      const lead = raw.length - raw.trimStart().length;
      const value = raw.trim();
      if (value) entries.push({ text: value, span: { start: contentStart + start + lead, end: contentStart + start + lead + value.length } });
      start = i + 1;
    }
  }
  return entries;
}

/** Splits a line into whitespace-separated words, keeping bracketed lists (which may contain spaces) whole. */
function words(text: string, offset: number): { text: string; span: Span }[] {
  const result: { text: string; span: Span }[] = [];
  let i = 0;
  while (i < text.length) {
    while (i < text.length && /\s/.test(text[i])) i++;
    if (i >= text.length) break;
    const start = i;
    let depth = 0;
    while (i < text.length && (depth > 0 || !/\s/.test(text[i]))) {
      if (text[i] === "[") depth++;
      else if (text[i] === "]") depth = Math.max(0, depth - 1);
      i++;
    }
    result.push({ text: text.slice(start, i), span: { start: offset + start, end: offset + i } });
  }
  return result;
}

function classify(word: { text: string; span: Span }, index: number): RecipeToken {
  const { text, span } = word;
  if (index === 0) return { kind: "resource", text, span };
  if (index === 1 && (/^-?\d+(\.\d+)?$/.test(text) || /^variable\[.*\]$/.test(text))) return { kind: "amount", text, span };
  const list = LIST.exec(text);
  if (list) {
    const prefix = list[1];
    const contentStart = span.start + (prefix ? prefix.length : 0) + 1;
    const kind: RecipeTokenKind = prefix ? (prefix as RecipeTokenKind) : "ids";
    return { kind, text, span, entries: listEntries(list[2], contentStart) };
  }
  const option = /^([A-Za-z]+):(.*)$/.exec(text);
  if (option && OPTIONS.some((o) => o.toLowerCase() === option[1].toLowerCase())) {
    return { kind: "option", text, span, option: option[1], optionValue: option[2] };
  }
  if (text === "overlayMapper") return { kind: "keyword", text, span };
  if (/^[A-Za-z0-9_]+\.[A-Za-z0-9_.]+$/.test(text) || /^[A-Za-z_][\w]*$/.test(text)) return { kind: "id", text, span };
  return { kind: "unknown", text, span };
}

export function parseRecipeLine(text: string, offset = 0): RecipeLine {
  const tokens = words(text, offset).map(classify);
  const first = tokens[0];
  const line: RecipeLine = { tokens };
  if (first) {
    const match = /^([+-]?)(\w+)$/.exec(first.text);
    const resource = match?.[2].toLowerCase();
    if (match && resource && RESOURCE_TYPES.includes(resource)) {
      line.resource = resource as RecipeLine["resource"];
      if (match[1]) line.prefix = match[1] as "+" | "-";
    }
  }
  return line;
}
