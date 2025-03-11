import * as vscode from "vscode";
import { LocationFinder } from "./helpers/locationfinder";

// Register the definition provider and hover provider
export function activate(context: vscode.ExtensionContext) {
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    "javascript",
    {
      async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
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

        if (functionName.length > 30) {
          return;
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;

        const cwd = workspaceFolders
          ? workspaceFolders[0].uri.fsPath
          : undefined;

        const locationfinder = new LocationFinder(documentText, cwd);

        const functionLocation = await locationfinder.findFunctionLocation(
          functionName
        );

        if (functionLocation) {
          return new vscode.Location(
            vscode.Uri.file(functionLocation.file),
            new vscode.Position(functionLocation.line, 0)
          );
        }
      },
    }
  );

  const hoverProvider = vscode.languages.registerHoverProvider("javascript", {
    async provideHover(
      document: vscode.TextDocument,
      position: vscode.Position,
      token: vscode.CancellationToken
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

      if (functionName.length > 30) {
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;

      const cwd = workspaceFolders ? workspaceFolders[0].uri.fsPath : undefined;

      const locationfinder = new LocationFinder(documentText, cwd);

      const functionText = await locationfinder.getFunctionText(functionName);

      if (functionText) {
        return new vscode.Hover({
          language: "javascript",
          value: functionText,
        });
      }
    },
  });

  context.subscriptions.push(hoverProvider);
  context.subscriptions.push(definitionProvider);
}
