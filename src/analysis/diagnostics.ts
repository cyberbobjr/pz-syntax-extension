import { ParseResult, ScriptBlock, ScriptValue, Span, isValue, walkBlocks } from "../parser/scriptParser";
import { ITEM_MODES, FLUID_MODES, RecipeToken, parseRecipeLine } from "../parser/recipeLine";
import { ScriptSchema } from "../schema/schema";
import { propertyId, schemaKeyOf } from "../schema/schemaKey";
import { closestMatch } from "./similarity";

export type Severity = "error" | "warning" | "information" | "hint";
export type ReportLevel = Severity | "off";

export interface TextEdit {
  span: Span;
  newText: string;
}

export interface QuickFix {
  title: string;
  edits: TextEdit[];
}

export interface ScriptDiagnostic {
  span: Span;
  message: string;
  severity: Severity;
  code: string;
  fix?: QuickFix;
}

export interface DiagnosticOptions {
  /** Level of "unknown property" reports (the game ignores those properties). */
  unknownProperties: ReportLevel;
  /** Level of values missing from the game registries (tags, body locations…), which mods may extend. */
  unknownValues: ReportLevel;
}

export const DEFAULT_DIAGNOSTIC_OPTIONS: DiagnosticOptions = { unknownProperties: "warning", unknownValues: "information" };

const MODULE = "module";
const IMPORTS = "imports";
const RECIPE_LINE_BLOCK = /(^|\/)(inputs|outputs)$/;
/** Java Float.parseFloat syntax: sign, exponent and f/d suffix are accepted (`0.25f`). */
const NUMBER = /^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?[fFdD]?$/;
const BOOLEAN = /^(true|false)$/i;

/** Vehicle part tables, written `table install { ... }` (a bare `install { ... }` is ignored by the game). */
const VEHICLE_TABLES = ["install", "uninstall"];

/** Build 41 `Type = Weapon` became `ItemType = base:weapon` in Build 42. */
const LEGACY_ITEM_TYPE_KEY = "type";

class DiagnosticCollector {
  readonly diagnostics: ScriptDiagnostic[] = [];

  constructor(private readonly options: DiagnosticOptions) {}

  add(span: Span, message: string, severity: Severity, code: string, fix?: QuickFix): void {
    this.diagnostics.push({ span, message, severity, code, fix });
  }

  addAt(level: ReportLevel, span: Span, message: string, code: string, fix?: QuickFix): void {
    if (level !== "off") this.add(span, message, level, code, fix);
  }

  get unknownPropertyLevel(): ReportLevel {
    return this.options.unknownProperties;
  }

  get unknownValueLevel(): ReportLevel {
    return this.options.unknownValues;
  }
}

function replaceFix(title: string, span: Span, newText: string): QuickFix {
  return { title, edits: [{ span, newText }] };
}

function didYouMean(word: string, candidates: string[]): { suffix: string; match?: string } {
  const match = closestMatch(word, candidates);
  return match ? { suffix: ` Did you mean "${match}"?`, match } : { suffix: "" };
}

function checkParseIssues(parse: ParseResult, text: string, out: DiagnosticCollector): void {
  for (const issue of parse.issues) {
    let fix: QuickFix | undefined;
    if (issue.code === "missing-comma") {
      fix = replaceFix('Add ","', issue.span, ",");
    } else if (issue.code === "line-comment") {
      const body = text.slice(issue.span.start + 2, issue.span.end).trim().replace(/\*\//g, "* /");
      fix = replaceFix("Convert to a /* */ comment", issue.span, `/* ${body} */`);
    }
    out.add(issue.span, issue.message, issue.severity, issue.code, fix);
  }
}

function checkBlockHeader(block: ScriptBlock, key: string, schema: ScriptSchema, out: DiagnosticCollector): void {
  const parent = block.parent;
  if (!parent) return;
  const parentKey = schemaKeyOf(parent);
  const isModuleLevel = parent.openBrace !== -1 && parent.type.toLowerCase() === MODULE && !parentKey;

  if (parent.openBrace === -1) {
    if (block.type.toLowerCase() !== MODULE) {
      out.add(block.typeSpan, `"${block.type}" must be inside a module block: module Base { ... }`, "warning", "outside-module");
    }
    return;
  }
  if (isModuleLevel) {
    if (block.type.toLowerCase() === IMPORTS) return;
    if (!schema.topLevelType(block.type)) {
      const hint = didYouMean(block.type, schema.topLevelTypes());
      const fix = hint.match ? replaceFix(`Replace with "${hint.match}"`, block.typeSpan, hint.match) : undefined;
      out.add(block.typeSpan, `Unknown block type "${block.type}": the game ignores it.${hint.suffix}`, "warning", "unknown-block", fix);
    } else if (!block.name) {
      out.add(block.typeSpan, `"${block.type}" needs a name, e.g. ${block.type} MyName`, "warning", "missing-name");
    }
    return;
  }
  if (block.type.toLowerCase() === "component") {
    if (!block.name) {
      out.add(block.typeSpan, "component needs a type, e.g. component FluidContainer", "warning", "missing-name");
    } else if (!schema.componentType(block.name)) {
      const hint = didYouMean(block.name, schema.componentTypes());
      const fix = hint.match && block.nameSpan ? replaceFix(`Replace with "${hint.match}"`, block.nameSpan, hint.match) : undefined;
      out.add(block.nameSpan ?? block.typeSpan, `Unknown component "${block.name}".${hint.suffix}`, "warning", "unknown-component", fix);
    }
    return;
  }
  if (parentKey === "vehicle/part" && VEHICLE_TABLES.includes(block.type.toLowerCase())) {
    const fix = replaceFix(`Replace with "table ${block.type}"`, block.typeSpan, `table ${block.type}`);
    out.add(block.typeSpan, `The game only reads "table ${block.type} { ... }" in a vehicle part: this block is ignored`, "warning", "unknown-block", fix);
    return;
  }
  if (schema.isStrict(parentKey) && !schema.block(key)) {
    const allowed = schema.childBlockTypes(parentKey);
    if (!allowed.some((t) => t.toLowerCase() === block.type.toLowerCase())) {
      const hint = didYouMean(block.type, allowed);
      const fix = hint.match ? replaceFix(`Replace with "${hint.match}"`, block.typeSpan, hint.match) : undefined;
      const where = schema.block(parentKey)?.type ?? parent.type;
      out.add(block.typeSpan, `Unknown block "${block.type}" in ${where}.${hint.suffix}`, "warning", "unknown-block", fix);
    }
  }
}

function legacyTypeFix(value: ScriptValue, schema: ScriptSchema): QuickFix | undefined {
  const itemTypes = schema.property("item", "ItemType")?.suggestions ?? [];
  const target = `base:${(value.value ?? "").toLowerCase()}`;
  if (!value.keySpan || !value.valueSpan || !itemTypes.includes(target)) return undefined;
  return {
    title: `Replace with ItemType = ${target}`,
    edits: [
      { span: value.keySpan, newText: "ItemType" },
      { span: value.valueSpan, newText: target },
    ],
  };
}

function checkProperty(value: ScriptValue, key: string, schema: ScriptSchema, out: DiagnosticCollector): void {
  if (value.key === undefined || !value.keySpan) return;
  const id = propertyId(value.key);
  if (!id) {
    out.add(value.span, "Missing property name before \"=\"", "error", "missing-key");
    return;
  }
  if (!schema.isKnownProperty(key, value.key)) {
    if (!schema.isStrict(key)) return;
    if (key === "item" && id === LEGACY_ITEM_TYPE_KEY) {
      out.addAt(out.unknownPropertyLevel, value.keySpan, 'Build 42 no longer reads "Type": use ItemType with a namespaced value, e.g. ItemType = base:weapon', "legacy-type", legacyTypeFix(value, schema));
      return;
    }
    const hint = didYouMean(value.key, schema.properties(key).map((p) => p.name));
    const fix = hint.match ? replaceFix(`Replace with "${hint.match}"`, value.keySpan, hint.match) : undefined;
    const where = schema.block(key)?.type ?? key;
    out.addAt(out.unknownPropertyLevel, value.keySpan, `Unknown property "${value.key}" in ${where}: the game ignores it.${hint.suffix}`, "unknown-property", fix);
    return;
  }
  checkValue(value, key, schema, out);
}

function checkValue(value: ScriptValue, key: string, schema: ScriptSchema, out: DiagnosticCollector): void {
  const info = schema.property(key, value.key ?? "");
  const text = value.value ?? "";
  if (!info || !value.valueSpan || !text) return;
  if (info.kind === "boolean" && !BOOLEAN.test(text)) {
    out.add(value.valueSpan, `${info.name} expects true or false`, "warning", "invalid-boolean");
    return;
  }
  if (info.kind === "number" && !NUMBER.test(text)) {
    out.add(value.valueSpan, `${info.name} expects a number (e.g. ${info.values[0]?.[0] ?? "1.0"})`, "warning", "invalid-number");
    return;
  }
  if (info.suggestions?.length && !info.open) checkRegistryValue(value, info.name, info.suggestions, Boolean(info.list), info.registry ?? "registry", out);
}

function checkRegistryValue(value: ScriptValue, name: string, suggestions: string[], isList: boolean, registry: string, out: DiagnosticCollector): void {
  const valueSpan = value.valueSpan!;
  const text = value.value ?? "";
  const known = new Map(suggestions.map((s) => [s.toLowerCase(), s]));
  const namespaced = suggestions.some((s) => s.includes(":"));
  let offset = 0;
  for (const part of isList ? text.split(";") : [text]) {
    const token = part.trim();
    const start = valueSpan.start + offset + part.indexOf(token);
    offset += part.length + 1;
    if (!token || known.has(token.toLowerCase())) continue;
    // Values in another namespace (`mymod:thing`) come from a mod registry.
    if (/^\w+:/.test(token) && !token.toLowerCase().startsWith("base:")) continue;
    const span = { start, end: start + token.length };
    const withNamespace = `base:${token.toLowerCase()}`;
    if (namespaced && !token.includes(":") && known.has(withNamespace)) {
      if (out.unknownValueLevel !== "off") {
        out.add(span, `Build 42 writes ${name} values with a namespace: ${withNamespace}`, "hint", "missing-namespace", replaceFix(`Replace with "${withNamespace}"`, span, withNamespace));
      }
      continue;
    }
    const hint = didYouMean(token, suggestions);
    const fix = hint.match ? replaceFix(`Replace with "${hint.match}"`, span, hint.match) : undefined;
    out.addAt(out.unknownValueLevel, span, `"${token}" is not a vanilla ${registry} value (fine if a mod registers it).${hint.suffix}`, "unknown-value", fix);
  }
}

function checkDuplicates(block: ScriptBlock, key: string, schema: ScriptSchema, out: DiagnosticCollector): void {
  if (!schema.isStrict(key)) return;
  const seen = new Map<string, ScriptValue>();
  for (const child of block.children) {
    if (!isValue(child) || child.key === undefined || !child.keySpan) continue;
    const id = propertyId(child.key);
    if (seen.has(id) && !schema.property(key, child.key)?.repeatable) {
      out.add(child.keySpan, `"${child.key}" is already set in this block: the game keeps the last value`, "warning", "duplicate-property");
    }
    seen.set(id, child);
  }
}

function checkRecipeToken(token: RecipeToken, direction: "inputs" | "outputs", resource: string | undefined, schema: ScriptSchema, out: DiagnosticCollector): void {
  if (token.kind === "flags") {
    const flags = schema.recipeFlags(direction);
    for (const entry of token.entries ?? []) {
      if (flags.some((f) => f.toLowerCase() === entry.text.toLowerCase())) continue;
      const hint = didYouMean(entry.text, flags);
      const fix = hint.match ? replaceFix(`Replace with "${hint.match}"`, entry.span, hint.match) : undefined;
      out.add(entry.span, `Unknown ${direction === "inputs" ? "input" : "output"} flag "${entry.text}".${hint.suffix}`, "warning", "unknown-flag", fix);
    }
  } else if (token.kind === "option" && token.option?.toLowerCase() === "mode") {
    const modes = resource === "fluid" ? FLUID_MODES : ITEM_MODES;
    const mode = token.optionValue ?? "";
    if (!modes.includes(mode.toLowerCase())) {
      out.add(token.span, `Invalid mode "${mode}" for ${resource ?? "this line"}: expected ${modes.join(", ")}`, "warning", "invalid-mode");
    }
  } else if (token.kind === "unknown") {
    out.add(token.span, `Unexpected "${token.text}" in recipe line`, "warning", "recipe-syntax");
  }
}

function checkRecipeLine(value: ScriptValue, key: string, schema: ScriptSchema, out: DiagnosticCollector): void {
  const direction = key.endsWith("inputs") ? "inputs" : "outputs";
  const line = parseRecipeLine(value.text, value.span.start);
  const [first, second] = line.tokens;
  if (!first) return;
  if (!line.resource) {
    const hint = didYouMean(first.text.replace(/^[+-]/, ""), ["item", "fluid", "energy"]);
    out.add(first.span, `Recipe line must start with item, fluid or energy (optionally prefixed by - or +).${hint.suffix}`, "error", "recipe-syntax");
    return;
  }
  if (!second || second.kind !== "amount") {
    out.add(second?.span ?? first.span, `Missing amount after "${first.text}" (e.g. ${first.text} 1 ...)`, "error", "recipe-syntax");
  }
  for (const token of line.tokens.slice(2)) checkRecipeToken(token, direction, line.resource, schema, out);
}

function checkBlockContent(block: ScriptBlock, key: string, schema: ScriptSchema, out: DiagnosticCollector): void {
  const isRecipeLines = RECIPE_LINE_BLOCK.test(key) && key.includes("craftrecipe");
  for (const child of block.children) {
    if (!isValue(child)) continue;
    if (isRecipeLines && child.key === undefined) {
      checkRecipeLine(child, key, schema, out);
    } else if (child.key !== undefined) {
      checkProperty(child, key, schema, out);
    }
  }
  checkDuplicates(block, key, schema, out);
}

/** All diagnostics of a parsed script. Pure: no VS Code dependency. */
export function computeDiagnostics(text: string, parse: ParseResult, schema: ScriptSchema, options: DiagnosticOptions = DEFAULT_DIAGNOSTIC_OPTIONS): ScriptDiagnostic[] {
  const out = new DiagnosticCollector(options);
  checkParseIssues(parse, text, out);
  for (const block of walkBlocks(parse.root)) {
    const key = schemaKeyOf(block);
    checkBlockHeader(block, key, schema, out);
    if (key) checkBlockContent(block, key, schema, out);
  }
  return out.diagnostics.sort((a, b) => a.span.start - b.span.start);
}
