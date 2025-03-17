import * as vscode from "vscode";
import { DefinitionProviderService } from "../services/definition-provider.service";

export class DefinitionProviderController {
  constructor(private readonly store: Map<string, vscode.Location>) {}

  registerDefinitionProvider() {
    return vscode.languages.registerDefinitionProvider("javascript", {
      provideDefinition: async (
        document: vscode.TextDocument,
        position: vscode.Position
      ) => {
        const documentText = document.getText();
        const wordRange = document.getWordRangeAtPosition(position);
        const functionName = document.getText(wordRange);
        const lineText = document.lineAt(position.line).text.trim();

        if (!functionName && !lineText) {
          return null;
        }

        const storeKey = `${document.fileName}:${functionName}`;

        if (this.store.has(storeKey)) {
          return this.store.get(storeKey);
        }

        const workspaceFolders = vscode.workspace.workspaceFolders;
        const documentPath = workspaceFolders
          ? workspaceFolders[0].uri.fsPath
          : undefined;

        const definitionProviderService = new DefinitionProviderService({
          documentText,
          documentPath,
          functionName,
          lineText,
        });

        const functionDefinition =
          await definitionProviderService.findFunctionDefiniton();

        if (!functionDefinition) {
          return;
        }

        const location = new vscode.Location(
          vscode.Uri.file(functionDefinition.path),
          new vscode.Position(functionDefinition.line, 0)
        );

        this.store.set(storeKey, location);

        return location;
      },
    });
  }
}
