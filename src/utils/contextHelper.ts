import { TextDocument, Position } from 'vscode';

export function getBlockType(document: TextDocument, position: Position): 'item' | 'craftRecipe' | 'fixing' | null {
    let currentLine = position.line;
    
    while (currentLine >= 0) {
        const line = document.lineAt(currentLine).text.trim();
        
        if (line.includes('{')) {
            const previousLine = currentLine > 0 ? document.lineAt(currentLine - 1).text.trim() : '';
            if (previousLine.startsWith('item ')) {
                return 'item';
            }
            if (previousLine.startsWith('craftRecipe ')) {
                return 'craftRecipe';
            }
            if (previousLine.startsWith('fixing ')) {
                return 'fixing';
            }
            return null;
        }
        currentLine--;
    }
    return null;
}
