import test from "node:test";
import assert from "node:assert/strict";
import * as fs from "fs";
import * as path from "path";
import { INITIAL, IGrammar, Registry, parseRawGrammar } from "vscode-textmate";
import { OnigScanner, OnigString, loadWASM } from "vscode-oniguruma";

const ROOT = path.join(__dirname, "..", "..");

async function loadGrammar(): Promise<IGrammar> {
  const wasm = fs.readFileSync(path.join(ROOT, "node_modules", "vscode-oniguruma", "release", "onig.wasm"));
  await loadWASM(wasm.buffer.slice(wasm.byteOffset, wasm.byteOffset + wasm.byteLength));
  const registry = new Registry({
    onigLib: Promise.resolve({ createOnigScanner: (s: string[]) => new OnigScanner(s), createOnigString: (s: string) => new OnigString(s) }),
    loadGrammar: async () => {
      const file = path.join(ROOT, "syntaxes", "pz-scripting.tmLanguage.json");
      return parseRawGrammar(fs.readFileSync(file, "utf8"), file);
    },
  });
  const grammar = await registry.loadGrammar("source.pz-script");
  if (!grammar) throw new Error("grammar not loaded");
  return grammar;
}

/** Innermost scope of each token of each line, as "text => scope". */
function scopes(grammar: IGrammar, text: string): string[] {
  let state = INITIAL;
  const result: string[] = [];
  for (const line of text.split("\n")) {
    const { tokens, ruleStack } = grammar.tokenizeLine(line, state);
    state = ruleStack;
    for (const token of tokens) {
      const value = line.slice(token.startIndex, token.endIndex);
      if (value.trim()) result.push(`${value.trim()} => ${token.scopes[token.scopes.length - 1]}`);
    }
  }
  return result;
}

test("highlights headers, properties, values, recipe lines and invalid // comments", async () => {
  const grammar = await loadGrammar();
  const tokens = scopes(grammar, [
    "module Base",
    "{",
    "    item Hammer",
    "    {",
    "        Weight = 1.5,",
    "        Tags = base:hammer,",
    "        CanStoreWater = true,",
    "        ReplaceOnUse = Base.Plank,",
    "        /* note */",
    "        // not a comment",
    "    }",
    "    craftRecipe MakePlank",
    "    {",
    "        inputs",
    "        {",
    "            item 1 tags[base:saw] mode:keep flags[Prop1],",
    "        }",
    "    }",
    "}",
  ].join("\n"));
  const expect = (token: string): void => assert.ok(tokens.includes(token), `${token}\nnot in:\n${tokens.join("\n")}`);
  expect("module => keyword.control.module.pz");
  expect("Base => entity.name.namespace.pz");
  expect("item => storage.type.block.pz");
  expect("Hammer => entity.name.type.pz");
  expect("Weight => support.type.property-name.pz");
  expect("1.5 => constant.numeric.pz");
  expect("hammer => variable.other.constant.pz");
  expect("true => constant.language.boolean.pz");
  expect("Plank => entity.name.class.pz");
  expect("note => comment.block.pz");
  expect("// not a comment => invalid.illegal.line-comment.pz");
  expect("inputs => storage.type.block.pz");
  expect("item => keyword.other.recipe-resource.pz");
  expect("tags => keyword.other.recipe-list.pz");
  expect("mode => keyword.other.recipe-option.pz");
  expect("keep => constant.language.recipe-option.pz");
  expect("flags => keyword.other.recipe-list.pz");
});
