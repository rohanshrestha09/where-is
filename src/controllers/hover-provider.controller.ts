import * as vscode from "vscode";
import { HoverProviderService } from "../services/hover-provider.service";

export class HoverProviderController {
  constructor(private readonly store: Map<string, vscode.Hover>) {}

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

  private async getFunctionPreview(options: {
    documentText: string;
    documentPath?: string;
    functionName: string;
    lineText: string;
  }) {
    const previewMode = vscode.workspace
      .getConfiguration("portPro")
      .get("previewMode");

    const hoverProviderService = new HoverProviderService(options);

    switch (previewMode) {
      case "off":
        return null;
      case "fullPreview":
        return await hoverProviderService.findFunctionBodyPreview();
      case "definitionPreview":
        return await hoverProviderService.findFunctionDefinitionPreview();
    }

    return null;
  }

  registerHoverProvider() {
    return vscode.languages.registerHoverProvider("javascript", {
      provideHover: async (document, position) => {
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

        const startTime = performance.now();

        const documentPath = this.getWorkspacePath();
        const functionPreview = await this.getFunctionPreview({
          documentText,
          documentPath,
          functionName,
          lineText,
        });
        if (!functionPreview) {
          return null;
        }

        const timeTaken = Math.round(performance.now() - startTime);

        if (!functionPreview) {
          return null;
        }

        const hover = new vscode.Hover({
          language: "javascript",
          value: functionPreview.text,
        });

        const sourceMarkdown = new vscode.MarkdownString(
          `[\`${functionPreview.filePath}:${
            functionPreview.line + 1
          }\`](${vscode.Uri.file(functionPreview.filePath)}#L${
            functionPreview.line + 1
          }) $(go-to-file)`
        );
        sourceMarkdown.supportThemeIcons = true;
        sourceMarkdown.isTrusted = true;
        hover.contents.unshift(sourceMarkdown);

        hover.contents.unshift(
          new vscode.MarkdownString(
            `\`\`\`\nTime taken: ${timeTaken}ms\n\`\`\``
          )
        );

        this.store.set(storeKey, hover);

        return hover;
      },
    });
  }
}
