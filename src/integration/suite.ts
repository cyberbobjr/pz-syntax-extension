import * as assert from "assert";
import * as path from "path";
import * as vscode from "vscode";

// Runs inside the VS Code launched by runTest.ts: checks the extension end to end on test-fixtures/workspace.

const TIMEOUT_MS = 20000;

async function waitFor<T>(what: string, probe: () => T | undefined | Promise<T | undefined>): Promise<T> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value) return value;
    await new Promise((resolve) => setTimeout(resolve, 200));
  }
  throw new Error(`Timed out waiting for ${what}`);
}

function positionOf(document: vscode.TextDocument, text: string, delta = 0): vscode.Position {
  return document.positionAt(document.getText().indexOf(text) + delta);
}

async function check(name: string, body: () => Promise<void>): Promise<void> {
  await body();
  console.log(`  ✔ ${name}`);
}

export async function run(): Promise<void> {
  const folder = vscode.workspace.workspaceFolders![0].uri.fsPath;
  const uri = vscode.Uri.file(path.join(folder, "media", "scripts", "test_items.txt"));
  const document = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(document);

  await check("media/scripts .txt files get the pz-scripting language", async () => {
    assert.equal(document.languageId, "pz-scripting");
  });

  await check("unknown property is reported with a quick fix", async () => {
    const diagnostics = await waitFor("diagnostics", () => {
      const found = vscode.languages.getDiagnostics(uri);
      return found.length ? found : undefined;
    });
    const unknown = diagnostics.find((d) => d.code === "unknown-property");
    assert.ok(unknown, JSON.stringify(diagnostics.map((d) => d.message)));
    const actions = await vscode.commands.executeCommand<vscode.CodeAction[]>("vscode.executeCodeActionProvider", uri, unknown.range);
    assert.ok(actions.some((a) => a.title === 'Replace with "Weight"'), JSON.stringify(actions.map((a) => a.title)));
  });

  await check("completion suggests item properties", async () => {
    const list = await vscode.commands.executeCommand<vscode.CompletionList>("vscode.executeCompletionItemProvider", uri, positionOf(document, "Tags = base:wrench,", "Tags = base:wrench,".length + 1));
    const labels = list.items.map((i) => (typeof i.label === "string" ? i.label : i.label.label));
    assert.ok(labels.includes("DisplayCategory"), labels.slice(0, 20).join(","));
  });

  await check("hover documents properties", async () => {
    const hovers = await vscode.commands.executeCommand<vscode.Hover[]>("vscode.executeHoverProvider", uri, positionOf(document, "ItemType", 2));
    const text = hovers.flatMap((h) => h.contents.map((c) => (typeof c === "string" ? c : c.value))).join("\n");
    assert.match(text, /ItemType/);
  });

  await check("go to definition resolves workspace items", async () => {
    const locations = await waitFor("definition", async () => {
      const found = await vscode.commands.executeCommand<vscode.Location[]>("vscode.executeDefinitionProvider", uri, positionOf(document, "TestMod.Wrench]", 9));
      return found?.length ? found : undefined;
    });
    assert.equal(locations[0].range.start.line, 2);
  });

  await check("document symbols and formatting are provided", async () => {
    const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>("vscode.executeDocumentSymbolProvider", uri);
    assert.deepEqual(symbols[0].children.map((s) => s.name), ["Wrench", "MakeWrench"]);
    const edits = await vscode.commands.executeCommand<vscode.TextEdit[]>("vscode.executeFormatDocumentProvider", uri, { tabSize: 4, insertSpaces: true });
    assert.ok(Array.isArray(edits));
  });
}
