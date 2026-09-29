import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import { formatScript } from "../analysis/formatter";
import { blockChain, isValue, parseScript, walkBlocks } from "../parser/scriptParser";
import { vanillaScripts } from "./helpers";

/** Everything the game reads from a script: block chains and statements. */
function meaning(text: string): string[] {
  const { root } = parseScript(text);
  return [...walkBlocks(root)].flatMap((block) => {
    const path = blockChain(block).map((b) => `${b.type} ${b.name}`).join(" > ");
    return [path, ...block.children.filter(isValue).map((v) => `${path} :: ${v.key ?? ""}|${v.value ?? v.text}`)];
  });
}

test("re-indents blocks and aligns consecutive properties", () => {
  const input = "module Base\n{\nitem Hammer\n{\nWeight=1.5,\n  DisplayCategory =   Tool,\ncomponent FluidContainer\n{\ncapacity = 1,\n}\n}\n}\n";
  const expected = [
    "module Base",
    "{",
    "    item Hammer",
    "    {",
    "        Weight          = 1.5,",
    "        DisplayCategory = Tool,",
    "        component FluidContainer",
    "        {",
    "            capacity = 1,",
    "        }",
    "    }",
    "}",
    "",
  ].join("\n");
  assert.equal(formatScript(input), expected);
});

test("can keep single spaces instead of aligning, and use tabs", () => {
  const input = "module Base\n{\n  item A\n  {\n    Weight = 1,\n    DisplayCategory = Tool,\n  }\n}";
  assert.equal(
    formatScript(input, { indent: "\t", alignValues: false }),
    "module Base\n{\n\titem A\n\t{\n\t\tWeight = 1,\n\t\tDisplayCategory = Tool,\n\t}\n}",
  );
});

test("leaves comments, recipe lines and CRLF line endings intact", () => {
  const input = "module Base\r\n{\r\n/* multi\r\n   line */\r\ncraftRecipe A\r\n{\r\ninputs\r\n{\r\nitem 1 [Base.Plank]  flags[Prop1],\r\n}\r\n}\r\n}";
  const output = formatScript(input);
  assert.equal(output.split("\r\n")[3], "   line */");
  assert.ok(output.includes("            item 1 [Base.Plank]  flags[Prop1],"));
  assert.ok(!/[^\r]\n/.test(output));
});

test("formatting is idempotent", () => {
  const input = "module Base {\nitem A {\nWeight = 1,\n}\n}\n";
  const once = formatScript(input);
  assert.equal(formatScript(once), once);
});

const VANILLA = vanillaScripts();

test("formatting never changes what the game reads, on every vanilla script", { skip: VANILLA.length === 0 && "Project Zomboid is not installed" }, () => {
  const broken: string[] = [];
  for (const file of VANILLA) {
    const text = fs.readFileSync(file, "utf8");
    const formatted = formatScript(text);
    if (JSON.stringify(meaning(formatted)) !== JSON.stringify(meaning(text))) broken.push(`${file}: meaning changed`);
    else if (formatScript(formatted) !== formatted) broken.push(`${file}: not idempotent`);
  }
  assert.deepEqual(broken.slice(0, 5), []);
});
