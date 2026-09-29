import { ParseResult, ScriptBlock, isBlock } from "../parser/scriptParser";
import { parseRecipeLine } from "../parser/recipeLine";
import { ScriptSchema } from "../schema/schema";
import { childSchemaKey, schemaKeyOf } from "../schema/schemaKey";
import { RECIPE_FLAG_DESCRIPTIONS, RECIPE_MODE_DESCRIPTIONS, blockDescription, propertyDescription } from "../schema/descriptions";
import { cursorContext } from "./context";

// Markdown hovers for what the schema knows: block types, components, properties, recipe flags and modes.
// References to other script objects are resolved by the editor layer with the index.

function inside(offset: number, span?: { start: number; end: number }): boolean {
  return Boolean(span) && offset >= span!.start && offset <= span!.end;
}

function formatValues(values: [string, number][]): string {
  return values.slice(0, 8).map(([v, n]) => `\`${v || "(empty)"}\` (${n.toLocaleString("en-US")})`).join(", ");
}

function blockHover(block: ScriptBlock, schema: ScriptSchema, offset: number): string | undefined {
  const parentKey = block.parent ? schemaKeyOf(block.parent) : "";
  const key = childSchemaKey(parentKey, block.type, block.name);
  if (inside(offset, block.nameSpan) && block.type.toLowerCase() === "component") {
    const info = schema.block(key);
    const lines = [`**component ${schema.componentType(block.name) ?? block.name}**`];
    if (info) lines.push(`Used ${info.count.toLocaleString("en-US")}× in vanilla ${schema.gameVersion}, ${Object.keys(info.properties).length} properties.`);
    else if (!schema.componentType(block.name)) lines.push("Unknown component type.");
    return lines.join("\n\n");
  }
  if (!inside(offset, block.typeSpan)) return undefined;
  const lines = [`**${block.type}**`];
  const description = blockDescription(block.type);
  if (description) lines.push(description);
  const info = schema.block(key);
  if (info) lines.push(`${info.count.toLocaleString("en-US")} in vanilla ${schema.gameVersion} scripts.`);
  return lines.join("\n\n");
}

function propertyHover(key: string, name: string, schema: ScriptSchema): string | undefined {
  const info = schema.property(key, name);
  const known = schema.isKnownProperty(key, name);
  if (!info && !known) return undefined;
  const where = schema.block(key)?.type ?? key;
  const lines = [`**${info?.name ?? name}** — ${where} property`];
  const description = propertyDescription(key, (info?.name ?? name).toLowerCase());
  if (description) lines.push(description);
  if (info) {
    const kind = info.list ? `list of ${info.registry ?? "values"} separated by \`;\`` : info.registry ?? info.kind;
    lines.push(`*Type*: ${kind} · used ${info.count.toLocaleString("en-US")}× in vanilla ${schema.gameVersion}`);
    if (info.values.length) lines.push(`*Common values*: ${formatValues(info.values)}`);
  } else {
    lines.push(`Read by the game (${schema.gameVersion}), not used by vanilla scripts.`);
  }
  return lines.join("\n\n");
}

function recipeLineHover(lineText: string, lineStart: number, offset: number): string | undefined {
  const line = parseRecipeLine(lineText, lineStart);
  for (const token of line.tokens) {
    if (!inside(offset, token.span)) continue;
    if (token.kind === "flags") {
      const entry = token.entries?.find((e) => inside(offset, e.span));
      const description = entry && RECIPE_FLAG_DESCRIPTIONS[entry.text.toLowerCase()];
      return entry ? `**${entry.text}** — recipe flag${description ? `\n\n${description}` : ""}` : undefined;
    }
    if (token.kind === "option" && token.option?.toLowerCase() === "mode") {
      const description = RECIPE_MODE_DESCRIPTIONS[(token.optionValue ?? "").toLowerCase()];
      return `**mode:${token.optionValue}**${description ? `\n\n${description}` : ""}`;
    }
  }
  return undefined;
}

export function hoverAt(text: string, parse: ParseResult, offset: number, schema: ScriptSchema): string | undefined {
  const context = cursorContext(text, parse, offset);
  if (context.inComment) return undefined;
  const header = context.block.children.filter(isBlock).find((b) => inside(offset, b.headerSpan));
  if (header) return blockHover(header, schema, offset);
  const value = context.value;
  if (!value) return undefined;
  if (value.key !== undefined && inside(offset, value.keySpan)) return propertyHover(context.key, value.key, schema);
  if (value.key === undefined && /(inputs|outputs)$/.test(context.key)) return recipeLineHover(value.text, value.span.start, offset);
  return undefined;
}
