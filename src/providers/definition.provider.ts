import * as vscode from "vscode";
import { DefinitionService } from "../services/definition.service";

export class DefinitionProvider implements vscode.DefinitionProvider {
  constructor(private readonly store: Map<string, vscode.Location>) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const documentText = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    const functionName = document.getText(wordRange);
    const lineNumber = position.line;

    if (!functionName) return null;

    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    const definitionService = new DefinitionService({
      documentText,
      workspacePath,
      functionName,
      lineNumber,
    });

    const functionCallExpression =
      definitionService.findFunctionCallExpression();

    if (functionCallExpression && this.store.has(functionCallExpression)) {
      return this.store.get(functionCallExpression);
    }

    const functionDefinition = await definitionService.findFunctionDefiniton();

    if (!functionDefinition) return;

    const location = new vscode.Location(
      vscode.Uri.file(functionDefinition.path),
      new vscode.Position(functionDefinition.line - 1, 0)
    );

    if (functionCallExpression) {
      this.store.set(functionCallExpression, location);
    }

    return location;
  }
}
