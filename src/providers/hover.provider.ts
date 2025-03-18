import * as vscode from "vscode";
import { DefinitionService } from "../services/definition.service";

export class HoverProvider implements vscode.HoverProvider {
  constructor(private readonly store: Map<string, vscode.Hover>) {}

  async provideHover(document: vscode.TextDocument, position: vscode.Position) {
    const documentText = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    const functionName = document.getText(wordRange);
    const lineNumber = position.line;

    if (!functionName) return null;

    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;

    const startTime = performance.now();

    const definitionProviderService = new DefinitionService({
      documentText,
      workspacePath,
      functionName,
      lineNumber,
    });

    const functionCallExpression =
      definitionProviderService.findFunctionCallExpression();

    if (functionCallExpression && this.store.has(functionCallExpression)) {
      return this.store.get(functionCallExpression);
    }

    const functionDefinition =
      await definitionProviderService.findFunctionDefiniton();
    if (!functionDefinition) return null;

    const timeTaken = Math.round(performance.now() - startTime);

    if (!functionDefinition) return null;

    const hover = new vscode.Hover({
      language: "javascript",
      value: functionDefinition.text,
    });

    const sourceMarkdown = new vscode.MarkdownString(
      `[\`${functionDefinition.path}:${
        functionDefinition.line
      }\`](${vscode.Uri.file(functionDefinition.path)}#L${
        functionDefinition.line
      }) $(go-to-file)`
    );
    sourceMarkdown.supportThemeIcons = true;
    sourceMarkdown.isTrusted = true;
    hover.contents.unshift(sourceMarkdown);

    hover.contents.unshift(
      new vscode.MarkdownString(
        `\`\`\`\nTime taken: ${timeTaken}ms, Line of Code: ${functionDefinition.loc}\n\`\`\``
      )
    );

    if (functionCallExpression) {
      this.store.set(functionCallExpression, hover);
    }

    return hover;
  }
}
