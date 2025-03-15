import * as vscode from "vscode";
import { HoverProviderService } from "../services/hover-provider.service";

export class HoverProviderController {
  registerHoverProvider() {
    return vscode.languages.registerHoverProvider("javascript", {
      async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        // read text of whole document
        const documentText = document.getText();

        // find the word under the cursor
        const wordRange = document.getWordRangeAtPosition(position);
        const word = document.getText(wordRange);

        // Get the entire line where the cursor is positioned
        const lineText = document.lineAt(position.line).text.trim();

        if (!word && !lineText) {
          return null;
        }

        const functionName = word;

        const workspaceFolders = vscode.workspace.workspaceFolders;

        const documentPath = workspaceFolders
          ? workspaceFolders[0].uri.fsPath
          : undefined;

        const hoverProviderService = new HoverProviderService({
          documentText,
          documentPath,
          functionName,
          lineText,
        });

        const functionPreview =
          await hoverProviderService.findFunctionDefinitionPreview();

        if (!functionPreview) {
          return;
        }

        return new vscode.Hover({
          language: "javascript",
          value: functionPreview,
        });
      },
    });
  }
}
