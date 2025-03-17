import * as vscode from "vscode";
import { DefinitionProviderService } from "../services/definition-provider.service";

export class HoverProviderController {
  constructor(private readonly store: Map<string, vscode.Hover>) {}

  registerHoverProvider() {
    return vscode.languages.registerHoverProvider("javascript", {
      provideHover: async (document, position) => {
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

        const startTime = performance.now();

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
      },
    });
  }
}
