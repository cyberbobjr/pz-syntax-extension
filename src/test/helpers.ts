import * as fs from "fs";
import * as path from "path";
import { findVanillaScriptFolders } from "../game/gameLocator";
import { ScriptDiagnostic, computeDiagnostics, DiagnosticOptions, DEFAULT_DIAGNOSTIC_OPTIONS } from "../analysis/diagnostics";
import { parseScript } from "../parser/scriptParser";
import { loadDefaultSchema } from "../schema/schema";

export const schema = loadDefaultSchema();

export function diagnose(text: string, options: DiagnosticOptions = DEFAULT_DIAGNOSTIC_OPTIONS): ScriptDiagnostic[] {
  return computeDiagnostics(text, parseScript(text), schema, options);
}

export function codes(text: string): string[] {
  return diagnose(text).map((d) => d.code);
}

/** Wraps lines in `module Base { item Test { ... } }`. */
export function item(...lines: string[]): string {
  return `module Base\n{\n    item Test\n    {\n${lines.map((l) => `        ${l}`).join("\n")}\n    }\n}\n`;
}

export function recipe(inputs: string[], extra: string[] = [], outputs = ["item 1 Base.Plank,"]): string {
  return [
    "module Base",
    "{",
    "    craftRecipe MakeTest",
    "    {",
    "        timedAction = Making,",
    "        time = 50,",
    ...extra.map((l) => `        ${l}`),
    "        inputs",
    "        {",
    ...inputs.map((l) => `            ${l}`),
    "        }",
    "        outputs",
    "        {",
    ...outputs.map((l) => `            ${l}`),
    "        }",
    "    }",
    "}",
    "",
  ].join("\n");
}

/** Applies the edits of a quick fix to `text`. */
export function applyFix(text: string, diagnostic: ScriptDiagnostic): string {
  const edits = [...(diagnostic.fix?.edits ?? [])].sort((a, b) => b.span.start - a.span.start);
  return edits.reduce((acc, e) => acc.slice(0, e.span.start) + e.newText + acc.slice(e.span.end), text);
}

function listScripts(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listScripts(full);
    return e.name.toLowerCase().endsWith(".txt") ? [full] : [];
  });
}

/** Vanilla script files of the installed game (empty when the game is not installed). */
export function vanillaScripts(): string[] {
  const folder = process.env.PZ_SCRIPTS ?? findVanillaScriptFolders()[0];
  return folder && fs.existsSync(folder) ? listScripts(folder).sort() : [];
}
