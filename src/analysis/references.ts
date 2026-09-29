import { ParseResult, Span, isBlock } from "../parser/scriptParser";
import { parseRecipeLine } from "../parser/recipeLine";
import { propertyId } from "../schema/schemaKey";
import { cursorContext, wordAt } from "./context";
import { ENTITY_STYLE } from "./scriptIndex";

// Finds which script object the word under the cursor refers to, e.g. `Base.Plank` in a recipe line,
// `Making` in `timedAction = Making`, `Water` in `-fluid 1.0 [Water]`.

export interface Reference {
  name: string;
  module?: string;
  span: Span;
  /** Expected object types, most likely first; undefined means "any". */
  types?: string[];
}

const ITEM = ["item"];
const MODEL = ["model"];
const SOUND = ["sound"];

/** Properties whose value names another script object. */
const PROPERTY_TARGETS: Record<string, string[]> = {
  timedaction: ["timedAction"],
  entitystyle: [ENTITY_STYLE],
  metarecipe: ["craftRecipe"],
  researchablerecipes: ["craftRecipe"],
  learnedrecipes: ["craftRecipe"],
  template: ["template"],
  worldstaticmodel: MODEL,
  staticmodel: MODEL,
  weaponsprite: MODEL,
  model: MODEL,
  mesh: [],
  fluid: ["fluid"],
};

function targetsForProperty(key: string): string[] | undefined {
  const id = propertyId(key);
  if (id in PROPERTY_TARGETS) return PROPERTY_TARGETS[id];
  if (id.endsWith("sound")) return SOUND;
  return undefined;
}

function splitModule(word: string): { module?: string; name: string } {
  const dot = word.indexOf(".");
  if (dot > 0 && /^[A-Za-z_]\w*$/.test(word.slice(0, dot))) {
    return { module: word.slice(0, dot), name: word.slice(dot + 1) };
  }
  return { name: word };
}

function recipeLineTargets(lineText: string, lineStart: number, offset: number): string[] | undefined | null {
  const line = parseRecipeLine(lineText, lineStart);
  const token = line.tokens.find((t) => offset >= t.span.start && offset <= t.span.end);
  if (!token) return null;
  if (token.kind === "ids" || token.kind === "id") return line.resource === "fluid" ? ["fluid"] : line.resource === "energy" ? ["energy"] : ITEM;
  return null;
}

export function referenceAt(text: string, parse: ParseResult, offset: number): Reference | undefined {
  const word = wordAt(text, offset);
  if (!word || /^-?\d+(\.\d+)?$/.test(word.text) || /^(true|false)$/i.test(word.text)) return undefined;
  const context = cursorContext(text, parse, offset);
  if (context.inComment) return undefined;
  const { module, name } = splitModule(word.text);
  const value = context.value;

  if (value?.keySpan && offset >= value.keySpan.start && offset <= value.keySpan.end) return undefined;
  if (value?.key !== undefined && value.valueSpan) {
    const types = targetsForProperty(value.key);
    if (types && types.length === 0) return undefined;
    return { name, module, span: word.span, types };
  }
  if (value && /(inputs|outputs)$/.test(context.key)) {
    const types = recipeLineTargets(value.text, value.span.start, offset);
    return types === null ? undefined : { name, module, span: word.span, types };
  }
  // A block name is written before its "{", so the header belongs to a child of the block at the cursor.
  const header = context.block.children.filter(isBlock).find((b) => b.nameSpan && offset >= b.nameSpan.start && offset <= b.nameSpan.end);
  if (header) return { name, module, span: word.span, types: [header.type] };
  return value ? { name, module, span: word.span } : undefined;
}
