import * as vscode from "vscode";
import { LocationFinder } from "./helpers/location-finder";
import { FunctionLocation } from "./types";
import { isKeyword } from "./helpers";
import { PreviewGenerator } from "./helpers/preview-generator";

// Register the definition provider and hover provider
export function activate(context: vscode.ExtensionContext) {
  const store = new Map<string, FunctionLocation>();

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

        if (functionName.length > 30 || isKeyword(functionName)) {
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

        if (!functionLocation) {
          return;
        }

        store.set(functionName, functionLocation);

        return new vscode.Location(
          vscode.Uri.file(functionLocation.path),
          new vscode.Position(functionLocation.line, 0)
        );
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

      if (functionName.length > 30 || isKeyword(functionName)) {
        return;
      }

      const workspaceFolders = vscode.workspace.workspaceFolders;

      const cwd = workspaceFolders ? workspaceFolders[0].uri.fsPath : undefined;

      const locationfinder = new LocationFinder(documentText, cwd);

      const functionLocation =
        store.get(functionName) ??
        (await locationfinder.findFunctionLocation(functionName));

      if (!functionLocation) {
        return;
      }

      const previewGenerator = new PreviewGenerator(functionLocation.content);

      const previewText = previewGenerator.generateFunctionDefinitionPreview(
        functionLocation.line
      );

      if (!previewText) {
        return;
      }

      return new vscode.Hover({
        language: "javascript",
        value: previewText,
      });
    },
  });

  context.subscriptions.push(hoverProvider);
  context.subscriptions.push(definitionProvider);
}
