import test from "node:test";
import assert from "node:assert/strict";
import { blockAt, blockChain, isBlock, isValue, parseScript, valueAt, walkBlocks } from "../parser/scriptParser";

const SAMPLE = `module Base
{
    /* a comment, with { braces } inside */
    item Hammer
    {
        DisplayCategory = Tool,
        Weight = 1.5,
        component FluidContainer
        {
            capacity = 0.5,
        }
    }
    fixing Fix Pistol
    {
        Require : Base.Pistol,
    }
}
`;

test("builds the block tree with types, names and properties", () => {
  const { root, issues } = parseScript(SAMPLE);
  assert.deepEqual(issues, []);
  const [module] = root.children.filter(isBlock);
  assert.equal(module.type, "module");
  assert.equal(module.name, "Base");
  const blocks = [...walkBlocks(root)].map((b) => `${b.type}:${b.name}`);
  assert.deepEqual(blocks, ["module:Base", "item:Hammer", "component:FluidContainer", "fixing:Fix Pistol"]);
  const hammer = [...walkBlocks(root)][1];
  const values = hammer.children.filter(isValue);
  assert.deepEqual(values.map((v) => [v.key, v.value, v.terminated]), [["DisplayCategory", "Tool", true], ["Weight", "1.5", true]]);
});

test("keeps exact offsets for keys, values and headers", () => {
  const { root } = parseScript(SAMPLE);
  const hammer = [...walkBlocks(root)][1];
  const weight = hammer.children.filter(isValue)[1];
  assert.equal(SAMPLE.slice(weight.keySpan!.start, weight.keySpan!.end), "Weight");
  assert.equal(SAMPLE.slice(weight.valueSpan!.start, weight.valueSpan!.end), "1.5");
  assert.equal(SAMPLE.slice(hammer.nameSpan!.start, hammer.nameSpan!.end), "Hammer");
  assert.equal(SAMPLE[hammer.openBrace], "{");
  assert.equal(SAMPLE[hammer.closeBrace!], "}");
});

test("accepts the colon separator in fixing blocks only", () => {
  const { root } = parseScript(SAMPLE);
  const fixing = [...walkBlocks(root)][3];
  const [require] = fixing.children.filter(isValue);
  assert.deepEqual([require.key, require.separator, require.value], ["Require", ":", "Base.Pistol"]);

  const inputs = parseScript("module Base { craftRecipe X { inputs { item 1 [Base.A] mode:keep, } } }");
  const line = [...walkBlocks(inputs.root)][2].children.filter(isValue)[0];
  assert.equal(line.key, undefined);
  assert.equal(line.text, "item 1 [Base.A] mode:keep");
});

test("ignores block comments but reports // lines, which the game reads as script", () => {
  const text = "module Base\n{\n    // old comment\n    item A\n    {\n        Weight = 1, /* note */\n    }\n}\n";
  const result = parseScript(text);
  assert.deepEqual(result.issues.map((i) => i.code), ["line-comment"]);
  assert.equal(result.comments.length, 1);
  const item = [...walkBlocks(result.root)][1];
  assert.equal(item.name, "A");
  assert.equal(item.children.filter(isValue)[0].value, "1");
});

test("does not treat // inside a value as a comment", () => {
  const result = parseScript("module Base { item A { Icon = media//x, } }");
  assert.deepEqual(result.issues, []);
});

test("reports missing commas and splits the merged statements back", () => {
  const text = "module Base\n{\n    item A\n    {\n        Weight = 1\n        Icon = Hammer,\n    }\n}\n";
  const result = parseScript(text);
  assert.deepEqual(result.issues.map((i) => i.code), ["missing-comma"]);
  assert.equal(text.slice(0, result.issues[0].span.start).split("\n").length, 5);
  const values = [...walkBlocks(result.root)][1].children.filter(isValue);
  assert.deepEqual(values.map((v) => v.key), ["Weight", "Icon"]);
});

test("reports a missing comma before a nested block", () => {
  const text = "module Base\n{\n    item A\n    {\n        Weight = 1\n        component FluidContainer\n        {\n        }\n    }\n}\n";
  const result = parseScript(text);
  assert.deepEqual(result.issues.map((i) => i.code), ["missing-comma"]);
  const blocks = [...walkBlocks(result.root)].map((b) => b.type);
  assert.deepEqual(blocks, ["module", "item", "component"]);
});

test("reports unbalanced braces and unterminated comments", () => {
  assert.deepEqual(parseScript("module Base { item A { }").issues.map((i) => i.code), ["unclosed-block"]);
  assert.deepEqual(parseScript("module Base { } }").issues.map((i) => i.code), ["unexpected-close"]);
  assert.deepEqual(parseScript("module Base { /* oops }").issues.map((i) => i.code), ["unclosed-block", "unterminated-comment"]);
});

test("reports text outside of any block", () => {
  assert.deepEqual(parseScript("stray,\nmodule Base { }").issues.map((i) => i.code), ["text-outside-block"]);
});

test("finds the block and statement at an offset", () => {
  const { root } = parseScript(SAMPLE);
  const offset = SAMPLE.indexOf("capacity") + 2;
  const block = blockAt(root, offset);
  assert.equal(block.name, "FluidContainer");
  assert.deepEqual(blockChain(block).map((b) => b.type), ["module", "item", "component"]);
  assert.equal(valueAt(block, offset)?.key, "capacity");
  assert.equal(blockAt(root, 0), root);
});
