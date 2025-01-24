import * as vscode from "vscode";
import * as path from "path";
import { DiagnosticProvider } from "./providers/diagnostic";
import { provideDefinition } from "./providers/definition";
import { provideDocumentFormattingEdits } from "./providers/editing";
import { PZCompletionItemProvider } from "./providers/completion";
import { PZHoverProvider } from "./providers/hover";
import { itemCache } from "./providers/cache";

export const defaultDir = path.normalize(
  "C:/Program Files (x86)/Steam/steamapps/common/ProjectZomboid/media/scripts/"
);

export function activate(context: vscode.ExtensionContext) {
  console.log('Extension "pz-syntax-extension" is now active!');
  const diagnosticProvider = new DiagnosticProvider();
  const watcher = vscode.workspace.createFileSystemWatcher("**/*.txt");
  watcher.onDidChange((uri) => {
    itemCache.clearForFile(uri.fsPath);
    console.log(`Cache invalidé pour : ${uri.fsPath}`);
  });

  watcher.onDidDelete((uri) => {
    itemCache.clearForFile(uri.fsPath);
    console.log(`Cache invalidé pour : ${uri.fsPath}`);
  });
  if (vscode.window.activeTextEditor) {
    diagnosticProvider.updateDiagnostics(
      vscode.window.activeTextEditor.document
    );
  }

  context.subscriptions.push(
    watcher,
    vscode.workspace.onDidOpenTextDocument((document) => {
      if (document.languageId === "pz-scripting") {
        diagnosticProvider.updateDiagnostics(document);
      }
    }),
    vscode.workspace.onDidChangeTextDocument((event) => {
      if (event.document.languageId === "pz-scripting") {
        diagnosticProvider.updateDiagnostics(event.document);
      }
    }),
    vscode.languages.registerCompletionItemProvider(
      "pz-scripting",
      new PZCompletionItemProvider(),
      ".",
      " ",
      "\t" // Déclencheurs de complétion
    ),
    vscode.languages.registerHoverProvider(
      "pz-scripting",
      new PZHoverProvider()
    ),
    vscode.languages.registerDocumentFormattingEditProvider("pz-scripting", {
      provideDocumentFormattingEdits,
    }),
    vscode.languages.registerDefinitionProvider("pz-scripting", {
      provideDefinition,
    })
  );
}

export function deactivate() {
  console.log('Extension "pz-syntax-extension" is now deactivated.');
}
