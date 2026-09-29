import { ScriptBlock, blockChain } from "../parser/scriptParser";

// A schema key identifies "what kind of block this is", independently of its name:
//   item                      top-level blocks: their type
//   craftrecipe/inputs        nested blocks: parent key + "/" + type
//   component:fluidcontainer  components: keyed by component type, wherever they appear
//   xuiskin/*                 xuiSkin children are free-form style names
// Keys are lower-case because the game compares block types and property names case-insensitively.

const MODULE_TYPE = "module";
const COMPONENT_TYPE = "component";

/** Block types that are only containers of free-form styles: their children are not checked. */
const FREE_FORM_PARENTS = new Set(["xuiskin", "xuiconfig", "xuilayout", "xuistyle", "xuidefaultstyle", "xuiglobalcolors"]);

/** Top-level types that share another type's structure. */
const TYPE_ALIASES: Record<string, string> = {
  template: "vehicle",
};

/** Numeric block types (vehicle tables) share one key; a trailing "*" (template wildcard, `passenger*`) is ignored. */
export function normalizeType(type: string): string {
  return /^\d+$/.test(type) ? "#" : type.toLowerCase().replace(/\*$/, "");
}

export function schemaKeyOfChain(chain: ScriptBlock[]): string {
  return chain.reduce((key, block) => childSchemaKey(key, block.type, block.name), "");
}

/** Schema key of a block; "" for the root and for `module` blocks. */
export function schemaKeyOf(block: ScriptBlock): string {
  return schemaKeyOfChain(blockChain(block));
}

/** xuiSkin children kept apart from the generic style entries. */
const NAMED_FREE_FORM_CHILDREN = new Set(["entity", "imports", "colors"]);

/** Key used when a `childType` block is opened inside a block of key `parentKey` ("" = module level). */
export function childSchemaKey(parentKey: string, childType: string, childName = ""): string {
  const type = normalizeType(childType);
  if (!parentKey) return type === MODULE_TYPE ? "" : (TYPE_ALIASES[type] ?? type);
  if (type === COMPONENT_TYPE && childName) return `${COMPONENT_TYPE}:${childName.toLowerCase()}`;
  const root = parentKey.split("/")[0];
  if (FREE_FORM_PARENTS.has(root)) {
    if (parentKey.includes("/")) return `${root}/*`;
    return `${root}/${NAMED_FREE_FORM_CHILDREN.has(type) ? type : "*"}`;
  }
  return `${parentKey}/${type}`;
}

/** Case-insensitive property identity; `template!` (vehicle template override) counts as `template`. */
export function propertyId(key: string): string {
  return key.toLowerCase().replace(/!$/, "");
}

export function isFreeForm(key: string): boolean {
  return FREE_FORM_PARENTS.has(key.split("/")[0]);
}
