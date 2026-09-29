import test from "node:test";
import assert from "node:assert/strict";
import { completionsAt } from "../analysis/completion";
import { hoverAt } from "../analysis/hover";
import { referenceAt } from "../analysis/references";
import { ScriptIndex, indexScript } from "../analysis/scriptIndex";
import { documentSymbols } from "../analysis/symbols";
import { parseScript } from "../parser/scriptParser";
import { parseRecipeLine } from "../parser/recipeLine";
import { schema } from "./helpers";

const CURSOR = "|";

/** Text with a "|" marking the cursor. */
function at(source: string): { text: string; offset: number } {
  const offset = source.indexOf(CURSOR);
  return { text: source.slice(0, offset) + source.slice(offset + 1), offset };
}

const LIBRARY = `module Base
{
    item Plank
    {
        ItemType = base:normal,
    }
    fluid Water
    {
    }
    timedAction Making
    {
    }
    xuiSkin default
    {
        entity ES_Bench
        {
        }
    }
}
`;

function libraryIndex(): ScriptIndex {
  const index = new ScriptIndex();
  index.setFile("lib.txt", indexScript("lib.txt", LIBRARY));
  return index;
}

function complete(source: string): ReturnType<typeof completionsAt> {
  const { text, offset } = at(source);
  const index = libraryIndex();
  return completionsAt(text, parseScript(text), offset, schema, { objects: (types) => index.all(types) });
}

const labels = (source: string): string[] => complete(source).map((c) => c.label);

test("module level suggests script blocks, root suggests module", () => {
  assert.ok(labels("module Base\n{\n    cr|\n}").includes("craftRecipe"));
  assert.deepEqual(labels("mo|"), ["module"]);
});

test("item properties: typical ones for the ItemType first, present ones excluded", () => {
  const entries = complete("module Base\n{\n    item A\n    {\n        ItemType = base:food,\n        |\n    }\n}");
  const names = entries.map((e) => e.label);
  assert.ok(!names.includes("ItemType"));
  const sorted = [...entries].sort((a, b) => (a.sortText ?? "").localeCompare(b.sortText ?? ""));
  const firstTen = sorted.slice(0, 10).map((e) => e.label.toLowerCase());
  assert.ok(firstTen.some((n) => ["hungerchange", "daysfresh", "daystotallyrotten", "calories"].includes(n)), firstTen.join(","));
  assert.ok(names.includes("component"));
});

test("values: registry suggestions, booleans and item references", () => {
  assert.ok(labels("module Base\n{\n    item A\n    {\n        ItemType = base:w|\n    }\n}").includes("base:weapon"));
  assert.ok(labels("module Base\n{\n    item A\n    {\n        Tags = base:hasmetal;base:ha|\n    }\n}").includes("base:hammer"));
  assert.deepEqual(labels("module Base\n{\n    item A\n    {\n        CanStoreWater = |\n    }\n}"), ["true", "false"]);
  const replaced = complete("module Base\n{\n    item A\n    {\n        Tags = base:hasmetal;base:ha|\n    }\n}")[0].replace;
  assert.equal(replaced.end - replaced.start, "base:ha".length);
});

test("components after the component keyword", () => {
  assert.ok(labels("module Base\n{\n    item A\n    {\n        component Fl|\n    }\n}").includes("FluidContainer"));
});

test("recipe lines: line starts, item ids, flags, tags and modes", () => {
  const recipe = (line: string): string => `module Base\n{\n    craftRecipe R\n    {\n        inputs\n        {\n            ${line}\n        }\n    }\n}`;
  assert.ok(labels(recipe("|")).includes("-fluid"));
  assert.deepEqual(labels(recipe("item 1 [Base.Pl|")), ["Base.Plank"]);
  assert.ok(labels(recipe("item 1 [Base.Plank] flags[Prop1;May|")).includes("MayDegradeLight"));
  assert.ok(labels(recipe("item 1 tags[base:ham|")).includes("base:hammer"));
  assert.ok(labels(recipe("item 1 [Base.Plank] mode:k|")).includes("keep"));
  assert.deepEqual(labels(recipe("-fluid 1.0 [Wa|")), ["Water"]);
});

test("no completion inside comments", () => {
  assert.deepEqual(labels("module Base\n{\n    /* it| */\n}"), []);
});

test("hover documents properties, blocks, components and flags", () => {
  const hover = (source: string): string | undefined => {
    const { text, offset } = at(source);
    return hoverAt(text, parseScript(text), offset, schema);
  };
  assert.match(hover("module Base\n{\n    item A\n    {\n        Ite|mType = base:food,\n    }\n}") ?? "", /ItemType.*item property/s);
  assert.match(hover("module Base\n{\n    craf|tRecipe R\n    {\n    }\n}") ?? "", /crafting recipe/);
  assert.match(hover("module Base\n{\n    item A\n    {\n        component Fluid|Container\n        {\n        }\n    }\n}") ?? "", /component FluidContainer/);
  assert.match(hover("module Base\n{\n    craftRecipe R\n    {\n        inputs\n        {\n            item 1 [Base.A] flags[Pr|op1],\n        }\n    }\n}") ?? "", /primary hand/);
});

test("references: recipe ids, fluid lines, typed properties and headers", () => {
  const ref = (source: string): ReturnType<typeof referenceAt> => {
    const { text, offset } = at(source);
    return referenceAt(text, parseScript(text), offset);
  };
  const recipe = (line: string): string => `module Base\n{\n    craftRecipe R\n    {\n        timedAction = Mak|ing,\n        inputs\n        {\n            ${line}\n        }\n    }\n}`;
  assert.deepEqual(ref(recipe("item 1 [Base.Plank],")), { name: "Making", module: undefined, span: ref(recipe("item 1 [Base.Plank],"))!.span, types: ["timedAction"] });
  const plank = ref(recipe("item 1 [Base.Pl|ank],").replace("Mak|ing", "Making"));
  assert.equal(plank?.name, "Plank");
  assert.equal(plank?.module, "Base");
  assert.deepEqual(plank?.types, ["item"]);
  assert.deepEqual(ref(recipe("-fluid 1.0 [Wat|er],").replace("Mak|ing", "Making"))?.types, ["fluid"]);
  assert.equal(ref(recipe("item 1 [Base.Plank] fla|gs[Prop1],").replace("Mak|ing", "Making")), undefined);
  assert.equal(ref("module Base\n{\n    item A\n    {\n        Wei|ght = 1,\n    }\n}"), undefined);
});

test("index finds objects by name, module and type, including entity styles", () => {
  const index = libraryIndex();
  assert.equal(index.find("plank")[0].name, "Plank");
  assert.equal(index.find("Plank", "Other").length, 0);
  assert.equal(index.find("Water", undefined, ["item"]).length, 0);
  assert.equal(index.find("ES_Bench", undefined, ["entityStyle"])[0].type, "entityStyle");
  index.removeFile("lib.txt");
  assert.equal(index.size, 0);
});

test("document symbols follow the block tree", () => {
  const symbols = documentSymbols(parseScript(LIBRARY));
  assert.equal(symbols[0].name, "Base");
  assert.deepEqual(symbols[0].children.map((s) => `${s.detail}:${s.name}`), ["item:Plank", "fluid:Water", "timedAction:Making", "xuiSkin:default"]);
  assert.equal(symbols[0].children[3].children[0].name, "ES_Bench");
});

test("recipe line parser splits tokens and list entries with offsets", () => {
  const line = parseRecipeLine("item 2 [Base.Plank; 25:Base.Thread] tags[base:hammer] mode:keep flags[Prop1]", 10);
  assert.equal(line.resource, "item");
  assert.deepEqual(line.tokens.map((t) => t.kind), ["resource", "amount", "ids", "tags", "option", "flags"]);
  const ids = line.tokens[2].entries!;
  assert.deepEqual(ids.map((e) => e.text), ["Base.Plank", "25:Base.Thread"]);
  assert.equal(ids[1].span.start, 10 + "item 2 [Base.Plank; ".length);
  assert.equal(parseRecipeLine("-fluid 1.0 [Water]").prefix, "-");
});
