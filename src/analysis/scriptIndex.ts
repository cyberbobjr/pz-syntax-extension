import { ParseResult, ScriptBlock, Span, isBlock, parseScript } from "../parser/scriptParser";

// Index of the named script objects (items, recipes, fluids, entity styles…) across files,
// used for go-to-definition, hovers on references and completion of item ids.

export interface ScriptObject {
  /** Block type as written (`item`, `craftRecipe`…); `entityStyle` for xuiSkin entity styles. */
  type: string;
  name: string;
  module: string;
  file: string;
  /** Header span (type + name) in the file. */
  span: Span;
}

export const ENTITY_STYLE = "entityStyle";

function namedChildren(block: ScriptBlock): ScriptBlock[] {
  return block.children.filter(isBlock).filter((b) => b.name && b.type.toLowerCase() !== "imports");
}

export function indexScript(file: string, text: string, parsed?: ParseResult): ScriptObject[] {
  const { root } = parsed ?? parseScript(text);
  const objects: ScriptObject[] = [];
  for (const module of root.children.filter(isBlock)) {
    if (module.type.toLowerCase() !== "module") continue;
    for (const block of namedChildren(module)) {
      objects.push({ type: block.type, name: block.name, module: module.name, file, span: block.headerSpan });
      if (block.type.toLowerCase() === "xuiskin") {
        for (const style of namedChildren(block).filter((b) => b.type.toLowerCase() === "entity")) {
          objects.push({ type: ENTITY_STYLE, name: style.name, module: module.name, file, span: style.headerSpan });
        }
      }
    }
  }
  return objects;
}

export class ScriptIndex {
  private readonly byFile = new Map<string, ScriptObject[]>();
  private byName = new Map<string, ScriptObject[]>();
  private dirty = false;

  setFile(file: string, objects: ScriptObject[]): void {
    this.byFile.set(file, objects);
    this.dirty = true;
  }

  removeFile(file: string): void {
    if (this.byFile.delete(file)) this.dirty = true;
  }

  hasFile(file: string): boolean {
    return this.byFile.has(file);
  }

  get size(): number {
    return [...this.byFile.values()].reduce((sum, objects) => sum + objects.length, 0);
  }

  private names(): Map<string, ScriptObject[]> {
    if (this.dirty) {
      const byName = new Map<string, ScriptObject[]>();
      for (const objects of this.byFile.values()) {
        for (const object of objects) {
          const key = object.name.toLowerCase();
          byName.set(key, [...(byName.get(key) ?? []), object]);
        }
      }
      this.byName = byName;
      this.dirty = false;
    }
    return this.byName;
  }

  /** Objects named `name` (case-insensitive), optionally restricted to a module and to types, preferred types first. */
  find(name: string, module?: string, types?: string[]): ScriptObject[] {
    const candidates = (this.names().get(name.toLowerCase()) ?? []).filter((o) => !module || o.module.toLowerCase() === module.toLowerCase());
    if (!types?.length) return candidates;
    const wanted = types.map((t) => t.toLowerCase());
    const matching = candidates.filter((o) => wanted.includes(o.type.toLowerCase()));
    return matching.length ? matching : [];
  }

  all(types?: string[]): ScriptObject[] {
    const wanted = types?.map((t) => t.toLowerCase());
    return [...this.byFile.values()].flat().filter((o) => !wanted || wanted.includes(o.type.toLowerCase()));
  }
}
