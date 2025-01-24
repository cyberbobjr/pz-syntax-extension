import * as vscode from "vscode";
import { VALID_KEYWORDS } from "../models/constants";

export class DiagnosticProvider {
  private diagnosticCollection: vscode.DiagnosticCollection;

  constructor() {
    this.diagnosticCollection =
      vscode.languages.createDiagnosticCollection("pz-scripting");
  }

  public updateDiagnostics(document: vscode.TextDocument): void {
    const diagnostics: vscode.Diagnostic[] = [];
    let currentBlock: string | null = null;
    let currentComponent: string | null = null;

    for (let i = 0; i < document.lineCount; i++) {
      const line = document.lineAt(i);
      const text = line.text.trim();

      if (!text || text.startsWith("/*") || text.startsWith("//")) {
        continue;
      }

      if (
        text.startsWith("craftRecipe") ||
        text.startsWith("item") ||
        text.startsWith("fixing") ||
        text.startsWith("component")
      ) {
        currentBlock = text.split(/\s+/)[0];
        currentComponent = null;
        continue;
      }

      if (text.startsWith("component")) {
        currentComponent = "component";
        continue;
      }

      if (currentBlock || currentComponent) {
        const activeBlock = currentComponent || currentBlock;
        const assignment = text.includes("=")
          ? text.split("=")[0].trim()
          : text.trim().match(/^-?\w+/)?.[0] || "";

        if (
          assignment &&
          activeBlock &&
          !this.isValidKeyword(assignment, activeBlock)
        ) {
          if (!/^[{},\[\]]+$/.test(assignment)) {
            const startIndex = line.text.indexOf(assignment);
            if (startIndex !== -1) {
              const range = new vscode.Range(
                i,
                startIndex,
                i,
                startIndex + assignment.length
              );
              const diagnostic = new vscode.Diagnostic(
                range,
                `Unknown keyword: ${assignment} in ${activeBlock}`,
                vscode.DiagnosticSeverity.Warning
              );
              diagnostics.push(diagnostic);
            }
          }
        }
      }

      if (text === "}" && currentComponent) {
        currentComponent = null;
      }
    }

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  private isValidKeyword(word: string, block: string): boolean {
    if (/^[{},\[\]"0-9]+$/.test(word) || word.includes('"')) {
      return true;
    }

    const blockKeywords = [
      "craftRecipe",
      "item",
      "fixing",
      "component",
      "inputs",
      "outputs",
      "itemMapper",
    ];
    if (blockKeywords.includes(word)) {
      return true;
    }

    if (word.startsWith("Base.") || word.includes("tags[")) {
      return true;
    }

    const keywords = VALID_KEYWORDS[block as keyof typeof VALID_KEYWORDS];
    return keywords ? keywords.includes(word) : true;
  }

  public dispose(): void {
    this.diagnosticCollection.dispose();
  }
}
