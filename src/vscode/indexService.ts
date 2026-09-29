import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ScriptIndex, ScriptObject, indexScript } from "../analysis/scriptIndex";
import { findVanillaScriptFolders } from "../game/gameLocator";
import { isBlock, parseScript } from "../parser/scriptParser";

// Keeps the ScriptIndex up to date with: the configured script folders (default: the game's media/scripts),
// the workspace's media/scripts files and the open Project Zomboid documents.

const WORKSPACE_SCRIPTS = "**/media/scripts/**/*.txt";
const MAX_PREVIEW_LINES = 40;
/** Files indexed between two yields to the event loop, so indexing never freezes the extension host. */
const FILES_PER_BATCH = 50;
const EDIT_REINDEX_DELAY_MS = 500;

function listScripts(dir: string): string[] {
  let entries: fs.Dirent[];
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch {
    return [];
  }
  return entries.flatMap((e) => {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) return listScripts(full);
    return e.name.toLowerCase().endsWith(".txt") ? [full] : [];
  });
}

export class IndexService implements vscode.Disposable {
  readonly index = new ScriptIndex();
  private readonly disposables: vscode.Disposable[] = [];
  private readonly editTimers = new Map<string, NodeJS.Timeout>();
  private ready: Promise<void> = Promise.resolve();
  private building = false;

  constructor(private readonly output: vscode.OutputChannel) {
    const watcher = vscode.workspace.createFileSystemWatcher(WORKSPACE_SCRIPTS);
    watcher.onDidChange((uri) => this.indexFile(uri.fsPath));
    watcher.onDidCreate((uri) => this.indexFile(uri.fsPath));
    watcher.onDidDelete((uri) => this.index.removeFile(uri.fsPath));
    this.disposables.push(watcher);
  }

  /** Folders indexed on start: the setting, or the installed game's scripts. */
  scriptFolders(): string[] {
    const configured = vscode.workspace.getConfiguration("pzSyntaxExtension").get<string[]>("searchDirectories", []);
    const folders = configured.filter((f) => typeof f === "string" && f.trim()).map((f) => path.normalize(f.trim()));
    return folders.length ? folders : findVanillaScriptFolders();
  }

  rebuild(): Promise<void> {
    this.building = true;
    this.ready = this.build().finally(() => {
      this.building = false;
    });
    return this.ready;
  }

  whenReady(): Promise<void> {
    return this.ready;
  }

  get isBuilding(): boolean {
    return this.building;
  }

  private async build(): Promise<void> {
    const started = Date.now();
    const folders = this.scriptFolders();
    if (!folders.length) {
      this.output.appendLine("No Project Zomboid scripts folder found: set pzSyntaxExtension.searchDirectories to index vanilla scripts.");
    }
    const files = folders.flatMap(listScripts);
    const workspaceFiles = (await vscode.workspace.findFiles(WORKSPACE_SCRIPTS, "**/node_modules/**")).map((u) => u.fsPath);
    const all = [...files, ...workspaceFiles];
    for (let i = 0; i < all.length; i++) {
      this.indexFile(all[i]);
      if (i % FILES_PER_BATCH === FILES_PER_BATCH - 1) await new Promise((resolve) => setImmediate(resolve));
    }
    // Open documents may hold unsaved edits: their content wins over the files on disk.
    vscode.workspace.textDocuments.filter((d) => d.languageId === "pz-scripting").forEach((d) => this.indexDocument(d));
    this.output.appendLine(`Indexed ${this.index.size} script objects from ${all.length} files in ${Date.now() - started} ms (${folders.join(", ") || "no game folder"}).`);
  }

  /** Re-indexes an edited document shortly after typing stops, so offsets match the live text. */
  scheduleDocument(document: vscode.TextDocument): void {
    const key = document.uri.toString();
    clearTimeout(this.editTimers.get(key));
    this.editTimers.set(key, setTimeout(() => {
      this.editTimers.delete(key);
      if (!document.isClosed) this.indexDocument(document);
    }, EDIT_REINDEX_DELAY_MS));
  }

  /** Current text of a file: the open document (possibly unsaved) or the file on disk. */
  private currentText(file: string): string | undefined {
    const open = vscode.workspace.textDocuments.find((d) => d.uri.scheme === "file" && d.uri.fsPath.toLowerCase() === file.toLowerCase());
    if (open) return open.getText();
    try {
      return fs.readFileSync(file, "utf8");
    } catch {
      return undefined;
    }
  }

  indexFile(file: string): void {
    try {
      this.index.setFile(file, indexScript(file, fs.readFileSync(file, "utf8")));
    } catch (error) {
      this.index.removeFile(file);
      this.output.appendLine(`Cannot index ${file}: ${(error as Error).message}`);
    }
  }

  indexDocument(document: vscode.TextDocument): void {
    if (document.uri.scheme === "file") this.index.setFile(document.uri.fsPath, indexScript(document.uri.fsPath, document.getText()));
  }

  async location(object: ScriptObject): Promise<vscode.Location> {
    const document = await vscode.workspace.openTextDocument(vscode.Uri.file(object.file));
    return new vscode.Location(document.uri, new vscode.Range(document.positionAt(object.span.start), document.positionAt(object.span.end)));
  }

  /** Source of the object's block (truncated), for hovers. */
  preview(object: ScriptObject): string | undefined {
    const text = this.currentText(object.file);
    if (text === undefined) return undefined;
    const stack = [parseScript(text).root];
    while (stack.length) {
      const block = stack.pop()!;
      if (block.headerSpan.start === object.span.start && block.closeBrace !== undefined) {
        const lines = text.slice(block.headerSpan.start, block.closeBrace + 1).split(/\r?\n/);
        const indent = Math.min(...lines.slice(1).filter((l) => l.trim()).map((l) => l.length - l.trimStart().length));
        const body = lines.map((l, i) => (i === 0 ? l : l.slice(Number.isFinite(indent) ? indent : 0)));
        return body.length > MAX_PREVIEW_LINES ? [...body.slice(0, MAX_PREVIEW_LINES), "..."].join("\n") : body.join("\n");
      }
      stack.push(...block.children.filter(isBlock));
    }
    return undefined;
  }

  dispose(): void {
    this.editTimers.forEach((t) => clearTimeout(t));
    this.disposables.forEach((d) => d.dispose());
  }
}
