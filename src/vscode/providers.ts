import * as vscode from "vscode";
import { CompletionEntry, completionsAt } from "../analysis/completion";
import { DiagnosticOptions, ScriptDiagnostic, Severity, computeDiagnostics } from "../analysis/diagnostics";
import { formatScript } from "../analysis/formatter";
import { hoverAt } from "../analysis/hover";
import { referenceAt } from "../analysis/references";
import { ScriptObject } from "../analysis/scriptIndex";
import { ScriptSymbol, documentSymbols } from "../analysis/symbols";
import { ScriptSchema } from "../schema/schema";
import { DocumentCache, toRange } from "./documentCache";
import { IndexService } from "./indexService";

export const LANGUAGE_ID = "pz-scripting";
const CONFIG = "pzSyntaxExtension";
const DIAGNOSTIC_DELAY_MS = 250;
const MAX_HOVER_DEFINITIONS = 3;

const SEVERITIES: Record<Severity, vscode.DiagnosticSeverity> = {
  error: vscode.DiagnosticSeverity.Error,
  warning: vscode.DiagnosticSeverity.Warning,
  information: vscode.DiagnosticSeverity.Information,
  hint: vscode.DiagnosticSeverity.Hint,
};

const COMPLETION_KINDS: Record<CompletionEntry["kind"], vscode.CompletionItemKind> = {
  property: vscode.CompletionItemKind.Property,
  block: vscode.CompletionItemKind.Struct,
  value: vscode.CompletionItemKind.EnumMember,
  keyword: vscode.CompletionItemKind.Keyword,
  reference: vscode.CompletionItemKind.Reference,
  flag: vscode.CompletionItemKind.Constant,
  snippet: vscode.CompletionItemKind.Snippet,
};

function diagnosticOptions(): DiagnosticOptions {
  const config = vscode.workspace.getConfiguration(CONFIG);
  return {
    unknownProperties: config.get("diagnostics.unknownProperties", "warning"),
    unknownValues: config.get("diagnostics.unknownValues", "information"),
  };
}

/** Publishes diagnostics and keeps their quick fixes for the code action provider. */
export class DiagnosticsProvider implements vscode.CodeActionProvider, vscode.Disposable {
  private readonly collection = vscode.languages.createDiagnosticCollection(LANGUAGE_ID);
  private readonly fixes = new WeakMap<vscode.Diagnostic, ScriptDiagnostic>();
  private readonly timers = new Map<string, NodeJS.Timeout>();

  constructor(private readonly cache: DocumentCache, private readonly schema: ScriptSchema) {}

  schedule(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.set(key, setTimeout(() => this.update(document), DIAGNOSTIC_DELAY_MS));
  }

  update(document: vscode.TextDocument): void {
    this.timers.delete(document.uri.toString());
    if (document.languageId !== LANGUAGE_ID || document.isClosed) return;
    const results = computeDiagnostics(document.getText(), this.cache.get(document), this.schema, diagnosticOptions());
    this.collection.set(document.uri, results.map((result) => {
      const diagnostic = new vscode.Diagnostic(toRange(document, result.span), result.message, SEVERITIES[result.severity]);
      diagnostic.source = "pz-script";
      diagnostic.code = result.code;
      if (result.fix) this.fixes.set(diagnostic, result);
      return diagnostic;
    }));
  }

  clear(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    clearTimeout(this.timers.get(key));
    this.timers.delete(key);
    this.collection.delete(document.uri);
  }

  provideCodeActions(document: vscode.TextDocument, _range: vscode.Range, context: vscode.CodeActionContext): vscode.CodeAction[] {
    return context.diagnostics.flatMap((diagnostic) => {
      const result = this.fixes.get(diagnostic);
      if (!result?.fix) return [];
      const action = new vscode.CodeAction(result.fix.title, vscode.CodeActionKind.QuickFix);
      action.diagnostics = [diagnostic];
      action.isPreferred = true;
      action.edit = new vscode.WorkspaceEdit();
      for (const edit of result.fix.edits) action.edit.replace(document.uri, toRange(document, edit.span), edit.newText);
      return [action];
    });
  }

  dispose(): void {
    this.timers.forEach((t) => clearTimeout(t));
    this.collection.dispose();
  }
}

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly cache: DocumentCache, private readonly schema: ScriptSchema, private readonly indexService: IndexService) {}

  provideCompletionItems(document: vscode.TextDocument, position: vscode.Position): vscode.CompletionList {
    const offset = document.offsetAt(position);
    const index = this.indexService.index;
    const entries = completionsAt(document.getText(), this.cache.get(document), offset, this.schema, { objects: (types) => index.all(types) });
    // While indexing, ids may be missing: marking the list incomplete makes VS Code ask again on the next keystroke.
    return new vscode.CompletionList(entries.map((entry) => this.toItem(document, entry)), this.indexService.isBuilding);
  }

  private toItem(document: vscode.TextDocument, entry: CompletionEntry): vscode.CompletionItem {
    const item = new vscode.CompletionItem(entry.label, COMPLETION_KINDS[entry.kind]);
    item.detail = entry.detail;
    if (entry.documentation) item.documentation = new vscode.MarkdownString(entry.documentation);
    if (entry.insertText) item.insertText = entry.snippet ? new vscode.SnippetString(entry.insertText) : entry.insertText;
    item.sortText = entry.sortText;
    item.range = toRange(document, entry.replace);
    if (entry.retrigger) item.command = { command: "editor.action.triggerSuggest", title: "Suggest values" };
    return item;
  }
}

async function resolveReference(document: vscode.TextDocument, position: vscode.Position, cache: DocumentCache, indexService: IndexService): Promise<{ objects: ScriptObject[]; range: vscode.Range } | undefined> {
  const reference = referenceAt(document.getText(), cache.get(document), document.offsetAt(position));
  if (!reference) return undefined;
  await indexService.whenReady();
  const objects = indexService.index.find(reference.name, reference.module, reference.types);
  return objects.length ? { objects, range: toRange(document, reference.span) } : undefined;
}

export class HoverProvider implements vscode.HoverProvider {
  constructor(private readonly cache: DocumentCache, private readonly schema: ScriptSchema, private readonly indexService: IndexService) {}

  async provideHover(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Hover | undefined> {
    const offset = document.offsetAt(position);
    const doc = hoverAt(document.getText(), this.cache.get(document), offset, this.schema);
    if (doc) return new vscode.Hover(new vscode.MarkdownString(doc));
    const resolved = await resolveReference(document, position, this.cache, this.indexService);
    if (!resolved) return undefined;
    const markdown = new vscode.MarkdownString();
    for (const object of resolved.objects.slice(0, MAX_HOVER_DEFINITIONS)) {
      const file = vscode.workspace.asRelativePath(object.file);
      markdown.appendMarkdown(`**${object.module}.${object.name}** — ${object.type} · \`${file}\`\n`);
      const preview = this.indexService.preview(object);
      if (preview) markdown.appendCodeblock(preview, LANGUAGE_ID);
    }
    if (resolved.objects.length > MAX_HOVER_DEFINITIONS) markdown.appendMarkdown(`\n*…and ${resolved.objects.length - MAX_HOVER_DEFINITIONS} other definitions*`);
    return new vscode.Hover(markdown, resolved.range);
  }
}

export class DefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly cache: DocumentCache, private readonly indexService: IndexService) {}

  async provideDefinition(document: vscode.TextDocument, position: vscode.Position): Promise<vscode.Location[] | undefined> {
    const resolved = await resolveReference(document, position, this.cache, this.indexService);
    if (!resolved) return undefined;
    return Promise.all(resolved.objects.map((object) => this.indexService.location(object)));
  }
}

export class FormattingProvider implements vscode.DocumentFormattingEditProvider {
  constructor(private readonly cache: DocumentCache) {}

  provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
    const text = document.getText();
    const alignValues = vscode.workspace.getConfiguration(CONFIG).get("format.alignValues", true);
    const indent = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
    const formatted = formatScript(text, { indent, alignValues }, this.cache.get(document));
    if (formatted === text) return [];
    return [vscode.TextEdit.replace(new vscode.Range(document.positionAt(0), document.positionAt(text.length)), formatted)];
  }
}

const SYMBOL_KINDS: Record<ScriptSymbol["kind"], vscode.SymbolKind> = {
  module: vscode.SymbolKind.Module,
  object: vscode.SymbolKind.Class,
  block: vscode.SymbolKind.Struct,
};

export class SymbolProvider implements vscode.DocumentSymbolProvider {
  constructor(private readonly cache: DocumentCache) {}

  provideDocumentSymbols(document: vscode.TextDocument): vscode.DocumentSymbol[] {
    const convert = (symbol: ScriptSymbol): vscode.DocumentSymbol => {
      const result = new vscode.DocumentSymbol(symbol.name, symbol.detail, SYMBOL_KINDS[symbol.kind], toRange(document, symbol.span), toRange(document, symbol.selectionSpan));
      result.children = symbol.children.map(convert);
      return result;
    };
    return documentSymbols(this.cache.get(document)).map(convert);
  }
}
