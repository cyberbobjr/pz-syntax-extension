import * as vscode from "vscode";

class ItemCache {
  private items = new Map<string, vscode.Location[]>();
  private indexedFiles = new Set<string>();
  private fileItemMap = new Map<string, string[]>();

  get(itemName: string): vscode.Location[] | undefined {
    return this.items.get(itemName.toLowerCase());
  }

  add(filePath: string, itemName: string, location: vscode.Location): void {
    const key = itemName.toLowerCase();
    const current = this.items.get(key) || [];
    current.push(location);
    this.items.set(key, current);

    const fileItems = this.fileItemMap.get(filePath) || [];
    fileItems.push(itemName);
    this.fileItemMap.set(filePath, fileItems);
  }

  isFileIndexed(filePath: string): boolean {
    return this.indexedFiles.has(filePath);
  }

  markFileAsIndexed(filePath: string): void {
    this.indexedFiles.add(filePath);
  }

  clearForFile(filePath: string): void {
    const items = this.fileItemMap.get(filePath) || [];
    items.forEach((item) => {
      const key = item.toLowerCase();
      const locations = this.items
        .get(key)
        ?.filter((l) => l.uri.fsPath !== filePath);
      if (locations?.length) this.items.set(key, locations);
      else this.items.delete(key);
    });
    this.indexedFiles.delete(filePath);
  }
}

export const itemCache = new ItemCache();
