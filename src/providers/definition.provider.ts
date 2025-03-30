import * as vscode from "vscode";
import { Configs } from "../configs";
import { DefinitionService } from "../services/definition.service";
import { RegistryTree } from "../datastructures/registry-tree";

export class DefinitionProvider implements vscode.DefinitionProvider {
  constructor(
    private readonly memento: vscode.Memento,
    private readonly store: Map<string, vscode.Location>
  ) {}

  async provideDefinition(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const documentText = document.getText();
    const wordRange = document.getWordRangeAtPosition(position);
    const lineNumber = position.line;

    const functionName = document.getText(wordRange);
    if (!functionName) return null;

    const cacheKey = `${document.uri.fsPath}:${lineNumber}:${functionName}`;
    const cachedDefinition = this.store.get(cacheKey);
    if (cachedDefinition) return cachedDefinition;

    const registryTreeJson = this.memento.get(Configs.REGISTRY_TREE_CACHE_KEY);
    if (!registryTreeJson) return;

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

    const location = new vscode.Location(
      vscode.Uri.file(functionDefinition.path),
      new vscode.Position(functionDefinition.loc.start.line - 1, 0)
    );

    this.store.set(cacheKey, location);

    return location;
  }
}
