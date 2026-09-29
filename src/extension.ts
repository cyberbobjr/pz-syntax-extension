import * as path from "path";
import * as vscode from "vscode";
import { loadDefaultSchema } from "./schema/schema";
import { DocumentCache } from "./vscode/documentCache";
import { IndexService } from "./vscode/indexService";
import {
  CompletionProvider,
  DefinitionProvider,
  DiagnosticsProvider,
  FormattingProvider,
  HoverProvider,
  LANGUAGE_ID,
  SymbolProvider,
} from "./vscode/providers";

const CONFIG = "pzSyntaxExtension";
/** Same test as the language's firstLine: plain .txt files starting with `module X` are scripts. */
const MODULE_FIRST_LINE = /^\s*module\s+\w+\s*\{?/;

function matchesConfiguredName(fileName: string): boolean {
  const patterns = vscode.workspace.getConfiguration(CONFIG).get<string[]>("pzFilenames", []);
  return patterns.some((pattern) => {
    try {
      return new RegExp(pattern).test(fileName);
    } catch {
      return pattern === fileName;
    }
  });
}

/** Switches plaintext documents to Project Zomboid scripts when their name or first line says so. */
function detectLanguage(document: vscode.TextDocument): void {
  if (document.languageId !== "plaintext" || document.lineCount === 0) return;
  if (matchesConfiguredName(path.basename(document.fileName)) || MODULE_FIRST_LINE.test(document.lineAt(0).text)) {
    void vscode.languages.setTextDocumentLanguage(document, LANGUAGE_ID);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const output = vscode.window.createOutputChannel("PZ Script");
  const schema = loadDefaultSchema();
  const cache = new DocumentCache();
  const indexService = new IndexService(output);
  const diagnostics = new DiagnosticsProvider(cache, schema);
  output.appendLine(`Project Zomboid script support for build ${schema.gameVersion}`);

  const selector: vscode.DocumentSelector = { language: LANGUAGE_ID };
  context.subscriptions.push(
    output,
    indexService,
    diagnostics,
    vscode.languages.registerCompletionItemProvider(selector, new CompletionProvider(cache, schema, indexService), " ", "=", "[", ";", ":", "."),
    vscode.languages.registerHoverProvider(selector, new HoverProvider(cache, schema, indexService)),
    vscode.languages.registerDefinitionProvider(selector, new DefinitionProvider(cache, indexService)),
    vscode.languages.registerDocumentFormattingEditProvider(selector, new FormattingProvider(cache)),
    vscode.languages.registerDocumentSymbolProvider(selector, new SymbolProvider(cache)),
    vscode.languages.registerCodeActionsProvider(selector, diagnostics, { providedCodeActionKinds: [vscode.CodeActionKind.QuickFix] }),
    vscode.workspace.onDidOpenTextDocument((document) => {
      detectLanguage(document);
      diagnostics.update(document);
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId !== LANGUAGE_ID) return;
      diagnostics.schedule(event.document);
      indexService.scheduleDocument(event.document);
    }),
    vscode.workspace.onDidSaveTextDocument((document) => {
      if (document.languageId === LANGUAGE_ID) indexService.indexDocument(document);
    }),
    vscode.workspace.onDidCloseTextDocument((document) => {
      cache.forget(document);
      diagnostics.clear(document);
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(`${CONFIG}.searchDirectories`)) void indexService.rebuild();
      if (event.affectsConfiguration(`${CONFIG}.diagnostics`)) {
        vscode.workspace.textDocuments.forEach((document) => diagnostics.update(document));
      }
    }),
    vscode.commands.registerCommand("pzSyntaxExtension.reindex", () => indexService.rebuild()),
  );

  vscode.workspace.textDocuments.forEach((document) => {
    detectLanguage(document);
    diagnostics.update(document);
  });
  void vscode.window.withProgress({ location: vscode.ProgressLocation.Window, title: "PZ: indexing scripts" }, () => indexService.rebuild());
}

export function deactivate(): void {
  // Disposables registered in activate() are released by VS Code.
}
