import * as vscode from "vscode";
import { DefinitionProviderService } from "../services/definition-provider.service";

export class DefinitionProviderController implements vscode.DefinitionProvider {
  constructor(private readonly store: Map<string, vscode.Location>) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const documentText = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    const functionName = document.getText(wordRange);

    if (!functionName) {
      return null;
    }

    const storeKey = `${document.fileName}:${functionName}`;

    if (this.store.has(storeKey)) {
      return this.store.get(storeKey);
    }

    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    const definitionProviderService = new DefinitionProviderService({
      documentText,
      workspacePath,
      functionName,
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
  }
}
