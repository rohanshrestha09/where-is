import * as vscode from "vscode";
import { DefinitionProviderService } from "../services/definition-provider.service";

export class HoverProviderController implements vscode.HoverProvider {
  constructor(private readonly store: Map<string, vscode.Hover>) {}

  async provideHover(document: vscode.TextDocument, position: vscode.Position) {
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

    const startTime = performance.now();

    const definitionProviderService = new DefinitionProviderService({
      documentText,
      workspacePath,
      functionName,
    });

    const functionDefinition =
      await definitionProviderService.findFunctionDefiniton();
    if (!functionDefinition) {
      return null;
    }

    const timeTaken = Math.round(performance.now() - startTime);

    if (!functionDefinition) {
      return null;
    }

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

    this.store.set(storeKey, hover);

    return hover;
  }
}
