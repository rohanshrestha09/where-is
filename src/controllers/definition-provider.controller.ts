import * as vscode from "vscode";
import { DefinitionProviderService } from "../services/definition-provider.service";

export class DefinitionProviderController {
  constructor(private readonly store: Map<string, vscode.Location>) {}

  private getDocumentInfo(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const documentText = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    const word = document.getText(wordRange);
    const lineText = document.lineAt(position.line).text.trim();
    return { documentText, word, lineText };
  }

  private getWorkspacePath() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    return workspaceFolders ? workspaceFolders[0].uri.fsPath : undefined;
  }

  registerDefinitionProvider() {
    return vscode.languages.registerDefinitionProvider("javascript", {
      provideDefinition: async (
        document: vscode.TextDocument,
        position: vscode.Position
      ) => {
        const {
          documentText,
          word: functionName,
          lineText,
        } = this.getDocumentInfo(document, position);

        if (!functionName && !lineText) {
          return null;
        }

        const storeKey = `${document.fileName}:${functionName}`;

        if (this.store.has(storeKey)) {
          return this.store.get(storeKey);
        }

        const documentPath = this.getWorkspacePath();
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
