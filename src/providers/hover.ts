import * as vscode from "vscode";
import { Position, TextDocument } from "vscode";
import { PROPERTY_DESCRIPTIONS, CRAFT_RECIPE_DESCRIPTIONS } from "../models/constants";
import { provideDefinition } from "./definition";
import path from "path";
import {getBlockType} from '../utils/contextHelper';
import { itemBlockRegex } from "../models/regexPatterns";

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
    if (this.isPropertyDescription(word, document, position)) {
      const contents = new vscode.MarkdownString();
      contents.appendMarkdown(`**${word}**  \n`);
      contents.appendMarkdown(this.getPropertyDescription(word, document, position));
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

  private isPropertyDescription(word: string, document: TextDocument, position: Position): boolean {
    const blockType = getBlockType(document, position);
    
    if (blockType === 'item') {
        return !!PROPERTY_DESCRIPTIONS[word];
    }
    
    if (blockType === 'craftRecipe') {
        return !!CRAFT_RECIPE_DESCRIPTIONS[word];
    }
    
    return false;
  }

  private getPropertyDescription(word: string, document: TextDocument, position: Position): string {
    const blockType = getBlockType(document, position);
    
    if (blockType === 'item') {
        return PROPERTY_DESCRIPTIONS[word] || "";
    }
    
    if (blockType === 'craftRecipe') {
        return CRAFT_RECIPE_DESCRIPTIONS[word] || "";
    }
    
    return "";
  }

  private extractItemContent(
    doc: TextDocument,
    startPosition: Position
  ): string | null {
    const text = doc.getText();
    const startOffset = doc.offsetAt(startPosition);

    // Reset lastIndex pour s'assurer que la recherche commence du début
    itemBlockRegex.lastIndex = 0;
    
    let bestMatch: { text: string, distance: number } | null = null;
    let match;

    // Chercher tous les blocs items
    while ((match = itemBlockRegex.exec(text)) !== null) {
      const matchStart = match.index;
      const matchEnd = matchStart + match[0].length;
      
      // Calculer la distance entre la position du curseur et le début du bloc
      const distance = Math.abs(startOffset - matchStart);

      // Si c'est le premier match ou si c'est plus proche que le précédent
      if (!bestMatch || distance < bestMatch.distance) {
        bestMatch = {
          text: match[0],
          distance: distance
        };
      }
    }

    if (bestMatch) {
      let content = bestMatch.text.trim();
      const MAX_LENGTH = 10000;
      
      // Tronquer si nécessaire
      if (content.length > MAX_LENGTH) {
        content = content.slice(0, MAX_LENGTH) + "\n// ... (trunced content)";
      }
      
      return content;
    }

    return null;
  }
}
