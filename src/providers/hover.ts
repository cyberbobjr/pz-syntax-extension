import * as vscode from "vscode";
import { Position, TextDocument } from "vscode";
import { PROPERTY_DESCRIPTIONS } from "../models/constants";
import { provideDefinition } from "./definition";
import path from "path";

export class PZHoverProvider implements vscode.HoverProvider {
  async provideHover(
    document: TextDocument,
    position: Position,
    token: vscode.CancellationToken
  ): Promise<vscode.Hover | null> {
    const range = document.getWordRangeAtPosition(position);
    if (!range) return null;

    const word = document.getText(range);

    // 1. Hover pour les propriétés (PROPERTY_DESCRIPTIONS)
    if (this.isPropertyDescription(word)) {
      const contents = new vscode.MarkdownString();
      contents.appendMarkdown(`**${word}**  \n`);
      contents.appendMarkdown(this.getPropertyDescription(word));
      return new vscode.Hover(contents);
    }

    // 2. Hover pour les Base.ITEM
    const baseItemRange = document.getWordRangeAtPosition(
      position,
      /\bBase\.(\w+)\b/i
    );
    if (baseItemRange) {
      const fullItemName = document.getText(baseItemRange);
      const itemName = fullItemName.split(".")[1].toLowerCase();

      // Utiliser le cache ou chercher la définition
      const locations = await provideDefinition(document, position, token);
      if (!locations || !Array.isArray(locations) || locations.length === 0) {
        return new vscode.Hover(
          `Aucune définition trouvée pour ${fullItemName}`
        );
      }

      // Récupérer et formater le contenu
      const contents = new vscode.MarkdownString();
      contents.appendMarkdown(`### ${fullItemName}\n`);

      for (const location of locations.slice(0, 3)) {
        // Limite à 3 résultats
        const doc = await vscode.workspace.openTextDocument(location.uri);
        const itemContent = this.extractItemContent(doc, location.range.start);

        if (itemContent) {
          contents.appendMarkdown(
            `#### ${path.basename(location.uri.fsPath)}\n`
          );
          contents.appendMarkdown("```lua\n" + itemContent + "\n```\n");
        }
      }

      if (locations.length > 3) {
        contents.appendMarkdown(
          `\n*... et ${locations.length - 3} autres définitions*`
        );
      }

      return new vscode.Hover(contents);
    }

    return null;
  }

  private isPropertyDescription(word: string): boolean {
    return !!PROPERTY_DESCRIPTIONS[word];
  }

  private getPropertyDescription(word: string): string {
    return PROPERTY_DESCRIPTIONS[word] || "";
  }

  private extractItemContent(
    doc: TextDocument,
    startPosition: Position
  ): string | null {
    const text = doc.getText();
    const startOffset = doc.offsetAt(startPosition);

    // Trouver le début du bloc item
    const itemStart = text.lastIndexOf("item", startOffset);
    if (itemStart === -1) return null;

    // Trouver l'accolade ouvrante
    const braceStart = text.indexOf("{", itemStart);
    if (braceStart === -1) return null;

    // Parcourir pour trouver l'accolade fermante
    let braceCount = 1;
    let currentPos = braceStart + 1;
    const MAX_LENGTH = 1000; // Limite de taille

    while (
      currentPos < text.length &&
      braceCount > 0 &&
      currentPos - itemStart < MAX_LENGTH
    ) {
      const char = text[currentPos];
      if (char === "{") braceCount++;
      if (char === "}") braceCount--;
      currentPos++;
    }

    if (braceCount !== 0) return null; // Bloc mal formé

    // Extraire et formater
    let content = text
      .slice(itemStart, currentPos)
      .replace(/\r?\n/g, "\n")
      .trim();

    // Tronquer si nécessaire
    if (content.length > MAX_LENGTH) {
      content = content.slice(0, MAX_LENGTH) + "\n// ... (contenu tronqué)";
    }

    return content;
  }
}
