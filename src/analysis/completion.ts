import { ParseResult, ScriptBlock, Span, isBlock, isValue } from "../parser/scriptParser";
import { FLUID_MODES, ITEM_MODES, parseRecipeLine } from "../parser/recipeLine";
import { KnownProperty, ScriptSchema } from "../schema/schema";
import { propertyId } from "../schema/schemaKey";
import { RECIPE_FLAG_DESCRIPTIONS, RECIPE_MODE_DESCRIPTIONS, blockDescription, propertyDescription } from "../schema/descriptions";
import { CursorContext, cursorContext } from "./context";
import { ScriptObject } from "./scriptIndex";

export type CompletionKind = "property" | "block" | "value" | "keyword" | "reference" | "flag" | "snippet";

export interface CompletionEntry {
  label: string;
  kind: CompletionKind;
  detail?: string;
  documentation?: string;
  /** Text inserted; a VS Code snippet when `snippet` is true. */
  insertText?: string;
  snippet?: boolean;
  sortText?: string;
  /** Range replaced by the completion. */
  replace: Span;
  /** Ask the editor to open completions again after inserting (e.g. after `Key = `). */
  retrigger?: boolean;
}

/** Script objects (from the index) that can be suggested as references. */
export interface ObjectSource {
  objects(types: string[]): ScriptObject[];
}

const RECIPE_LINES = /(^|\/)(inputs|outputs)$/;
const ITEM_KEY = "item";
const MAX_REFERENCES = 5000;

function rank(group: number, index: number): string {
  return `${group}${String(index).padStart(5, "0")}`;
}

function propertyDoc(schema: ScriptSchema, key: string, property: KnownProperty): string {
  const parts: string[] = [];
  const description = propertyDescription(key, property.name.toLowerCase());
  if (description) parts.push(description);
  const info = property.info;
  if (info) {
    parts.push(`Used ${info.count.toLocaleString("en-US")}× in vanilla ${schema.gameVersion}.`);
    const examples = info.values.slice(0, 5).map(([v]) => `\`${v || "(empty)"}\``);
    if (examples.length) parts.push(`Examples: ${examples.join(", ")}`);
  } else {
    parts.push(`Read by the game (${schema.gameVersion}) but not used by vanilla scripts.`);
  }
  return parts.join("\n\n");
}

function propertySnippet(property: KnownProperty): string {
  if (property.info?.kind === "boolean") return `${property.name} = \${1|true,false|},`;
  return `${property.name} = $1,`;
}

function presentKeys(block: ScriptBlock): Set<string> {
  return new Set(block.children.filter(isValue).map((v) => (v.key !== undefined ? propertyId(v.key) : "")).filter(Boolean));
}

function itemTypeOf(block: ScriptBlock): string | undefined {
  return block.children.filter(isValue).find((v) => v.key?.toLowerCase() === "itemtype")?.value;
}

function propertyCompletions(context: CursorContext, schema: ScriptSchema, replace: Span): CompletionEntry[] {
  const present = presentKeys(context.block);
  const typical = context.key === ITEM_KEY ? new Set(schema.itemTypeProperties(itemTypeOf(context.block) ?? "")) : new Set<string>();
  return schema.properties(context.key)
    .filter((p) => !present.has(p.name.toLowerCase()) || p.info?.repeatable)
    .map((p, index) => ({
      label: p.name,
      kind: "property" as const,
      detail: p.vanilla ? `${schema.block(context.key)?.type ?? context.key} property` : `${schema.block(context.key)?.type ?? context.key} property (not used by vanilla)`,
      documentation: propertyDoc(schema, context.key, p),
      insertText: propertySnippet(p),
      snippet: true,
      sortText: rank(typical.has(p.name.toLowerCase()) ? 0 : p.vanilla ? 1 : 2, index),
      replace,
      retrigger: p.info?.kind !== "number" && p.info?.kind !== "boolean",
    }));
}

function blockSnippet(type: string, named: boolean): string {
  return named ? `${type} \${1:Name}\n{\n\t$0\n}` : `${type}\n{\n\t$0\n}`;
}

function childBlockCompletions(context: CursorContext, schema: ScriptSchema, replace: Span): CompletionEntry[] {
  return schema.childBlockTypes(context.key).map((type, index) => {
    const isComponent = type.toLowerCase() === "component";
    const components = [...new Set([...schema.vanillaComponents(context.key), ...schema.componentTypes()])];
    return {
      label: type,
      kind: "block" as const,
      detail: isComponent ? "component block" : "sub-block",
      documentation: blockDescription(type),
      insertText: isComponent ? `component \${1|${components.join(",")}|}\n{\n\t$0\n}` : blockSnippet(type, false),
      snippet: true,
      sortText: rank(3, index),
      replace,
    };
  });
}

function moduleLevelCompletions(schema: ScriptSchema, replace: Span): CompletionEntry[] {
  const types = ["item", "craftRecipe", "entity", "fluid", "fixing", "evolvedrecipe", "timedAction", "model", "sound", "vehicle"];
  const ordered = [...new Set([...types, ...schema.topLevelTypes()])];
  const blocks = ordered.map((type, index) => ({
    label: type,
    kind: "block" as const,
    detail: "script block",
    documentation: blockDescription(type),
    insertText: blockSnippet(type, true),
    snippet: true,
    sortText: rank(0, index),
    replace,
  }));
  return [...blocks, { label: "imports", kind: "block", detail: "imported modules", documentation: blockDescription("imports"), insertText: "imports\n{\n\t${1:Base}\n}", snippet: true, sortText: rank(1, 0), replace }];
}

function componentCompletions(context: CursorContext, schema: ScriptSchema, replace: Span): CompletionEntry[] {
  const vanilla = schema.vanillaComponents(context.key);
  const all = [...new Set([...vanilla, ...schema.componentTypes()])];
  return all.map((name, index) => ({
    label: name,
    kind: "keyword" as const,
    detail: vanilla.includes(name) ? `component used by vanilla ${schema.block(context.key)?.type ?? ""}` : "component",
    sortText: rank(vanilla.includes(name) ? 0 : 1, index),
    replace,
  }));
}

function referenceCompletions(objects: ScriptObject[], withModule: boolean, replace: Span, group = 2): CompletionEntry[] {
  const seen = new Set<string>();
  const entries: CompletionEntry[] = [];
  for (const object of objects) {
    const label = withModule ? `${object.module}.${object.name}` : object.name;
    if (seen.has(label.toLowerCase())) continue;
    seen.add(label.toLowerCase());
    entries.push({ label, kind: "reference", detail: `${object.type} (${object.file.split(/[\\/]/).slice(-2).join("/")})`, sortText: rank(group, 0) + label, replace });
    if (entries.length >= MAX_REFERENCES) break;
  }
  return entries;
}

/** Types referenced by a property value, from how vanilla writes it (`Base.X` values are items). */
function referenceTypesForValue(values: [string, number][]): { types: string[]; withModule: boolean } | undefined {
  const withModule = values.filter(([v]) => /^[A-Z]\w*\.\w+$/.test(v)).length > values.length / 2;
  return withModule ? { types: ["item"], withModule: true } : undefined;
}

function valueCompletions(context: CursorContext, schema: ScriptSchema, objects: ObjectSource | undefined, offset: number): CompletionEntry[] {
  const eq = context.prefix.indexOf("=");
  const propertyName = context.prefix.slice(0, eq).trim();
  const info = schema.property(context.key, propertyName);
  const afterEq = context.prefix.slice(eq + 1);
  const token = info?.list ? afterEq.slice(afterEq.lastIndexOf(";") + 1) : afterEq;
  const typed = token.trimStart();
  const replace = { start: offset - typed.length, end: offset };
  if (!info) return [];
  const entries: CompletionEntry[] = [];
  const suggestions = info.suggestions ?? (info.kind === "boolean" ? ["true", "false"] : info.kind === "enum" ? info.values.map(([v]) => v).filter(Boolean) : []);
  const usage = new Map(info.values);
  suggestions.forEach((value, index) => {
    const count = usage.get(value);
    entries.push({ label: value, kind: "value", detail: count ? `used ${count}× in vanilla` : info.registry ? `${info.registry}` : undefined, sortText: rank(count ? 0 : 1, index), replace });
  });
  const references = referenceTypesForValue(info.values);
  if (references && objects) entries.push(...referenceCompletions(objects.objects(references.types), references.withModule, replace));
  return entries;
}

const LINE_STARTS: [string, string, string][] = [
  ["item", "item ${1:1} [${2:Base.Plank}]", "Item line: amount then [Module.Item;...] or tags[...]"],
  ["-fluid", "-fluid ${1:1.0} [${2:Water}]", "Fluid consumed by the recipe"],
  ["+fluid", "+fluid ${1:1.0} [${2:Water}]", "Fluid added to the previous item line"],
  ["fluid", "fluid ${1:1.0} [${2:Water}]", "Fluid line"],
  ["-energy", "-energy ${1:1.0} [${2:Electric}]", "Energy consumed by the recipe"],
  ["energy", "energy ${1:1.0} [${2:Electric}]", "Energy line"],
];

function recipeLineStartCompletions(replace: Span): CompletionEntry[] {
  return LINE_STARTS.map(([label, snippet, doc], index) => ({ label, kind: "snippet" as const, insertText: snippet, snippet: true, documentation: doc, sortText: rank(0, index), replace }));
}

function recipeOptionCompletions(direction: "inputs" | "outputs", resource: string | undefined, replace: Span): CompletionEntry[] {
  const options = resource === "fluid"
    ? ["categories[$1]", "mode:${1|exact,primary,mixture,anything|}", "flags[$1]"]
    : direction === "inputs"
      ? ["tags[$1]", "flags[$1]", "mode:${1|keep,destroy,use|}", "mappers[$1]"]
      : ["flags[$1]", "mapper:$1", "chance:$1"];
  return options.map((snippet, index) => ({ label: snippet.replace(/\$\{1\|.*\|\}|\$1/, ""), kind: "keyword" as const, insertText: snippet, snippet: true, sortText: rank(0, index), replace }));
}

function mapperNames(block: ScriptBlock): string[] {
  const recipe = block.parent;
  return (recipe?.children ?? []).filter(isBlock).filter((b) => /mapper$/i.test(b.type) && b.name).map((b) => b.name);
}

function listCompletions(listKind: string, direction: "inputs" | "outputs", resource: string | undefined, context: CursorContext, schema: ScriptSchema, objects: ObjectSource | undefined, replace: Span): CompletionEntry[] {
  const simple = (values: string[], describe?: (v: string) => string | undefined): CompletionEntry[] =>
    values.map((v, index) => ({ label: v, kind: "value" as const, documentation: describe?.(v), sortText: rank(0, index), replace }));
  switch (listKind) {
    case "tags":
      return simple(schema.property("item", "Tags")?.suggestions ?? []);
    case "flags":
      return schema.recipeFlags(direction).map((flag, index) => ({ label: flag, kind: "flag" as const, documentation: RECIPE_FLAG_DESCRIPTIONS[flag.toLowerCase()], sortText: rank(RECIPE_FLAG_DESCRIPTIONS[flag.toLowerCase()] ? 0 : 1, index), replace }));
    case "categories":
      return simple(schema.statementKeywords("fluid/categories"));
    case "mappers":
      return simple(mapperNames(context.block));
    default:
      if (!objects) return [];
      if (resource === "fluid") return referenceCompletions(objects.objects(["fluid"]), false, replace, 0);
      if (resource === "energy") return referenceCompletions(objects.objects(["energy"]), false, replace, 0);
      return referenceCompletions(objects.objects(["item"]), true, replace, 0);
  }
}

function recipeLineCompletions(context: CursorContext, schema: ScriptSchema, objects: ObjectSource | undefined, offset: number): CompletionEntry[] {
  const direction = context.key.endsWith("inputs") ? "inputs" : "outputs";
  const prefix = context.prefix;
  const lastWord = /\S*$/.exec(prefix)?.[0] ?? "";
  const replaceWord = { start: offset - lastWord.length, end: offset };
  if (!/\s/.test(prefix)) return recipeLineStartCompletions(replaceWord);

  const resource = parseRecipeLine(prefix).resource;
  const open = prefix.lastIndexOf("[");
  if (open > prefix.lastIndexOf("]")) {
    const listKind = /(\w*)$/.exec(prefix.slice(0, open))?.[1] ?? "";
    const entry = prefix.slice(open + 1).split(";").pop() ?? "";
    const typed = entry.replace(/^\d+:/, "");
    return listCompletions(listKind, direction, resource, context, schema, objects, { start: offset - typed.length, end: offset });
  }
  const mode = /mode:(\w*)$/.exec(prefix);
  if (mode) {
    const modes = resource === "fluid" ? FLUID_MODES : ITEM_MODES;
    return modes.map((m, index) => ({ label: m, kind: "value" as const, documentation: RECIPE_MODE_DESCRIPTIONS[m], sortText: rank(0, index), replace: { start: offset - mode[1].length, end: offset } }));
  }
  if (direction === "outputs" && resource === "item" && /^\s*[+-]?item\s+\S+\s+\w*$/.test(prefix) && objects) {
    return referenceCompletions(objects.objects(["item"]), true, replaceWord, 0);
  }
  return recipeOptionCompletions(direction, resource, replaceWord);
}

/** Completions at `offset`. Pure: the index is passed as an ObjectSource. */
export function completionsAt(text: string, parse: ParseResult, offset: number, schema: ScriptSchema, objects?: ObjectSource): CompletionEntry[] {
  const context = cursorContext(text, parse, offset);
  if (context.inComment) return [];
  const prefix = context.prefix;
  const replaceWord = { start: context.statementStart, end: offset };

  if (prefix.includes("=")) return valueCompletions(context, schema, objects, offset);
  if (context.block.openBrace === -1) {
    return /^\w*$/.test(prefix) ? [{ label: "module", kind: "block", insertText: "module ${1:Base}\n{\n\t$0\n}", snippet: true, documentation: blockDescription("module"), replace: replaceWord }] : [];
  }
  if (RECIPE_LINES.test(context.key) && context.key.includes("craftrecipe")) return recipeLineCompletions(context, schema, objects, offset);
  const component = /^component\s+(\w*)$/i.exec(prefix);
  if (component) return componentCompletions(context, schema, { start: offset - component[1].length, end: offset });
  if (!/^[\w!]*$/.test(prefix)) return [];
  if (!context.key) return context.block.type.toLowerCase() === "module" ? moduleLevelCompletions(schema, replaceWord) : [];
  return [...propertyCompletions(context, schema, replaceWord), ...childBlockCompletions(context, schema, replaceWord)];
}
