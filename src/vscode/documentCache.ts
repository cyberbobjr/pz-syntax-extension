import * as vscode from "vscode";
import { ParseResult, parseScript } from "../parser/scriptParser";

/** Parses each document once per version. */
export class DocumentCache {
  private readonly entries = new Map<string, { version: number; parse: ParseResult }>();

  get(document: vscode.TextDocument): ParseResult {
    const key = document.uri.toString();
    const cached = this.entries.get(key);
    if (cached && cached.version === document.version) return cached.parse;
    const parse = parseScript(document.getText());
    this.entries.set(key, { version: document.version, parse });
    return parse;
  }

  forget(document: vscode.TextDocument): void {
    this.entries.delete(document.uri.toString());
  }
}

export function toRange(document: vscode.TextDocument, span: { start: number; end: number }): vscode.Range {
  return new vscode.Range(document.positionAt(span.start), document.positionAt(span.end));
}
