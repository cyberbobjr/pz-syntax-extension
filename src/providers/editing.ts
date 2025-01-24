import * as vscode from "vscode";

export function provideDocumentFormattingEdits(
  document: vscode.TextDocument
): vscode.TextEdit[] {
  const formattedText = formatText(document.getText());

  // Créer un TextEdit pour remplacer tout le document
  const firstLine = document.lineAt(0);
  const lastLine = document.lineAt(document.lineCount - 1);
  const textRange = new vscode.Range(firstLine.range.start, lastLine.range.end);

  return [vscode.TextEdit.replace(textRange, formattedText)];
}

function formatText(text: string): string {
  const lines = text.split("\n");
  let formattedLines: string[] = [];
  let indentLevel = 0;
  let inCommentBlock = false;
  let commentNestingLevel = 0; // Compteur pour les commentaires imbriqués
  let blockLines: string[] = [];
  let nestedBlockIndentLevel = 0;

  for (let line of lines) {
    line = line.trim();

    // Gestion des commentaires imbriqués
    if (line.includes("/*")) {
      commentNestingLevel += (line.match(/\/\*/g) || []).length; // Compter les ouvertures de commentaires
      inCommentBlock = true;
    }
    if (line.includes("*/")) {
      commentNestingLevel -= (line.match(/\*\//g) || []).length; // Compter les fermetures de commentaires
      if (commentNestingLevel <= 0) {
        inCommentBlock = false;
        commentNestingLevel = 0; // Réinitialiser le compteur
      }
    }

    // Si nous sommes dans un commentaire, ajouter la ligne sans formatage
    if (inCommentBlock || commentNestingLevel > 0) {
      formattedLines.push(line);
      continue;
    }

    // Gestion des commentaires sur une ligne
    if (line.startsWith("//")) {
      formattedLines.push(line);
      continue;
    }

    // Gestion des blocs
    if (line.endsWith("{")) {
      formattedLines.push(" ".repeat(indentLevel * 4) + line);
      indentLevel++;
      blockLines = [];
      nestedBlockIndentLevel = indentLevel;
    } else if (line.endsWith("}")) {
      indentLevel--;
      if (blockLines.length > 0) {
        formattedLines.push(
          ...alignEquals(blockLines, nestedBlockIndentLevel - 1)
        );
        blockLines = [];
      }
      formattedLines.push(" ".repeat(indentLevel * 4) + line);
    } else if (line.includes("=")) {
      blockLines.push(line);
    } else {
      if (blockLines.length > 0) {
        formattedLines.push(
          ...alignEquals(blockLines, nestedBlockIndentLevel - 1)
        );
        blockLines = [];
      }
      formattedLines.push(" ".repeat(indentLevel * 4) + line);
    }
  }

  return formattedLines.join("\n");
}

function alignEquals(lines: string[], indentLevel: number): string[] {
  const maxKeyLength = Math.max(
    ...lines.map((line) => line.split("=")[0].trim().length)
  );
  return lines.map((line) => {
    const [key, value] = line.split("=").map((part) => part.trim());
    return (
      " ".repeat((indentLevel + 1) * 4) +
      key.padEnd(maxKeyLength) +
      " = " +
      value
    );
  });
}
