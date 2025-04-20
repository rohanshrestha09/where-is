import * as vscode from "vscode";
import { Configs } from "../configs";
import { DefinitionService } from "../services/definition.service";
import { RegistryTree } from "../datastructures/registry-tree";

export class HoverProvider implements vscode.HoverProvider {
  constructor(
    private readonly memento: vscode.Memento,
    private readonly store: Map<string, vscode.Hover>
  ) {}

  async provideHover(document: vscode.TextDocument, position: vscode.Position) {
    const documentText = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    const lineNumber = position.line;

    const functionName = document.getText(wordRange);
    if (!functionName) return;

    const cacheKey = `${document.uri.fsPath}:${lineNumber}:${functionName}`;
    const cachedHover = this.store.get(cacheKey);
    if (cachedHover) return cachedHover;

    const registryTreeJson = this.memento.get(Configs.REGISTRY_TREE_CACHE_KEY);
    if (!registryTreeJson) return;

    const startTime = performance.now();

    const definitionService = new DefinitionService(
      RegistryTree.fromJSON(registryTreeJson),
      {
        documentText,
        functionName,
        lineNumber,
      }
    );

    const functionDefinition = await definitionService.findFunctionDefiniton();
    if (!functionDefinition) return;

    const timeTaken = Math.round(performance.now() - startTime);

    const hover = new vscode.Hover({
      language: "javascript",
      value: functionDefinition.text,
    });

    const sourceMarkdown = new vscode.MarkdownString(
      `[\`${functionDefinition.path}:${
        functionDefinition.loc.start.line
      }\`](${vscode.Uri.file(functionDefinition.path)}#L${
        functionDefinition.loc.start.line
      }) $(go-to-file)`
    );
    sourceMarkdown.supportThemeIcons = true;
    sourceMarkdown.isTrusted = true;
    hover.contents.unshift(sourceMarkdown);

    hover.contents.unshift(
      new vscode.MarkdownString(
        `\`\`\`\nTime taken: ${timeTaken}ms, Line of Code: ${
          functionDefinition.loc.end.line -
          functionDefinition.loc.start.line +
          1
        }\n\`\`\``
      )
    );

    this.store.set(cacheKey, hover);

    return hover;
  }
}
