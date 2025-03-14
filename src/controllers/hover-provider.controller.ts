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

        if (!word) {
          return null;
        }

        const functionName = word;

        const workspaceFolders = vscode.workspace.workspaceFolders;

        const cwd = workspaceFolders
          ? workspaceFolders[0].uri.fsPath
          : undefined;

        const hoverProviderService = new HoverProviderService(
          documentText,
          cwd
        );

        const functionPreview =
          await hoverProviderService.findFunctionBodyPreview(functionName);

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
