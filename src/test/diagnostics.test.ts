import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import { applyFix, codes, diagnose, item, recipe, vanillaScripts } from "./helpers";

test("a valid 42.21 item has no diagnostics", () => {
  const text = item("DisplayCategory = Tool,", "ItemType = base:weapon,", "Weight = 1.5,", "Tags = base:hammer;base:hasmetal,", "Categories = base:blunt,");
  assert.deepEqual(diagnose(text), []);
});

test("unknown properties are reported with a typo suggestion and quick fix", () => {
  const text = item("Wieght = 1.5,");
  const [d] = diagnose(text);
  assert.equal(d.code, "unknown-property");
  assert.match(d.message, /Did you mean "Weight"\?/);
  assert.equal(applyFix(text, d), item("Weight = 1.5,"));
});

test("property names are case-insensitive, like in the game", () => {
  assert.deepEqual(codes(item("weight = 1.5,", "MAXHITCOUNT = 2,")), []);
});

test("legacy Build 41 Type is converted to ItemType", () => {
  const text = item("Type = Weapon,");
  const [d] = diagnose(text);
  assert.equal(d.code, "legacy-type");
  assert.equal(applyFix(text, d), item("ItemType = base:weapon,"));
});

test("unknown-property reports follow the configured level", () => {
  const text = item("Wieght = 1.5,");
  assert.deepEqual(diagnose(text, { unknownProperties: "off", unknownValues: "information" }), []);
  assert.equal(diagnose(text, { unknownProperties: "error", unknownValues: "information" })[0].severity, "error");
});

test("values are checked against the property kind", () => {
  assert.deepEqual(codes(item("Weight = heavy,")), ["invalid-number"]);
  assert.deepEqual(codes(item("CanStoreWater = yes,")), ["invalid-boolean"]);
});

test("numbers follow Java's float syntax", () => {
  assert.deepEqual(codes(item("Weight = 0.25f,", "MaxRange = 1e2,", "MinRange = +.5,")), []);
});

test("values in another mod namespace are not reported", () => {
  assert.deepEqual(codes(item("Tags = mymod:special;base:hammer,")), []);
});

test("nested comments are one comment, like in the game", () => {
  const text = "module Base\n{\n    /* item Old { /* note */ } */\n    item A\n    {\n        Weight = 1,\n    }\n}\n";
  assert.deepEqual(codes(text), []);
});

test("open registries (mod categories) are suggested but never reported", () => {
  assert.deepEqual(codes(item("DisplayCategory = MyModStuff,")), []);
  assert.deepEqual(codes(recipe(["item 1 [Base.Plank],"], ["category = Mechanical,"])), []);
});

test("bare install/uninstall blocks in a vehicle part get a table quick fix", () => {
  const text = "module Base\n{\n    vehicle Car\n    {\n        part GasTank\n        {\n            install\n            {\n            }\n        }\n    }\n}\n";
  const [d] = diagnose(text);
  assert.equal(d.code, "unknown-block");
  assert.ok(applyFix(text, d).includes("table install\n"));
});

test("keys the game reads are accepted even when not suggested", () => {
  assert.deepEqual(codes(item("OBSOLETE = true,")), []);
});

test("registry values: namespace hint for Build 41 tags, typo suggestions otherwise", () => {
  const text = item("Tags = Hammer;base:hasmetal,");
  const [d] = diagnose(text);
  assert.equal(d.code, "missing-namespace");
  assert.equal(d.severity, "hint");
  assert.equal(applyFix(text, d), item("Tags = base:hammer;base:hasmetal,"));

  const [typo] = diagnose(item("ItemType = base:weapn,"));
  assert.equal(typo.code, "unknown-value");
  assert.match(typo.message, /Did you mean "base:weapon"\?/);
});

test("duplicate properties are reported unless vanilla repeats them", () => {
  assert.deepEqual(codes(item("Weight = 1,", "Weight = 2,")), ["duplicate-property"]);
});

test("unknown block types and components are reported", () => {
  assert.deepEqual(codes("module Base\n{\n    itme A\n    {\n    }\n}\n"), ["unknown-block"]);
  const [component] = diagnose(item("component FluidContainr", "{", "}"));
  assert.equal(component.code, "unknown-component");
  assert.match(component.message, /FluidContainer/);
  assert.deepEqual(codes("item A\n{\n}\n"), ["outside-module"]);
});

test("missing commas and // comments come with quick fixes", () => {
  const text = item("Weight = 1", "Icon = Hammer,");
  const [comma] = diagnose(text);
  assert.equal(comma.code, "missing-comma");
  assert.deepEqual(codes(applyFix(text, comma)), []);

  const commented = item("// heavy", "Weight = 1,");
  const [comment] = diagnose(commented);
  assert.equal(comment.code, "line-comment");
  assert.equal(applyFix(commented, comment), item("/* heavy */", "Weight = 1,"));
});

test("craftRecipe lines: valid 42.21 syntax passes", () => {
  const text = recipe([
    "item 1 tags[base:hammer] mode:keep flags[Prop1;MayDegradeLight],",
    "item 2 [Base.Plank;25:Base.Thread_Sinew] flags[DontReplace] mappers[woodType],",
    "-fluid 0.2 categories[Water] mode:mixture,",
    "item variable[1:20] [Base.Basil],",
  ], ["category = Carpentry,", "Tags = AnySurfaceCraft;InHandCraft,", "SkillRequired = Woodwork:2,"], ["item 1 Base.Plank,", "item 1 mapper:woodType flags[IsBlunt],"]);
  assert.deepEqual(diagnose(text), []);
});

test("craftRecipe lines: bad resource, amount, flag and mode are reported", () => {
  assert.deepEqual(codes(recipe(["itm 1 [Base.Plank],"])), ["recipe-syntax"]);
  assert.deepEqual(codes(recipe(["item [Base.Plank],"])), ["recipe-syntax"]);
  const [flag] = diagnose(recipe(["item 1 [Base.Plank] flags[Prop3],"]));
  assert.equal(flag.code, "unknown-flag");
  assert.deepEqual(codes(recipe(["item 1 [Base.Plank] mode:mixture,"])), ["invalid-mode"]);
  assert.deepEqual(codes(recipe(["-fluid 1.0 [Water] mode:keep,"])), ["invalid-mode"]);
});

test("craftRecipe properties are shared with entity CraftRecipe components", () => {
  const text = "module Base\n{\n    entity Bench\n    {\n        component CraftRecipe\n        {\n            timedAction = BuildWallHammer,\n            time = 200,\n            inputs\n            {\n                item 1 [Base.Plank],\n            }\n        }\n    }\n}\n";
  assert.deepEqual(diagnose(text), []);
  assert.deepEqual(codes(text.replace("time = 200", "tiem = 200")), ["unknown-property"]);
});

const VANILLA = vanillaScripts();

test("no diagnostics on any vanilla script", { skip: VANILLA.length === 0 && "Project Zomboid is not installed" }, () => {
  const reports: string[] = [];
  for (const file of VANILLA) {
    const text = fs.readFileSync(file, "utf8");
    for (const d of diagnose(text)) reports.push(`${file}: ${d.message}`);
  }
  assert.equal(VANILLA.length > 500, true);
  assert.deepEqual(reports.slice(0, 5), []);
});
