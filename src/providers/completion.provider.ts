import * as vscode from "vscode";
import { Configs } from "../configs";
import { RegistryTree } from "../datastructures/registry-tree";
import { CompletionService } from "../services/completion.service";

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly memento: vscode.Memento) {}

  async provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const { currentWord, linePrefix } = this.getCurrentContext(
      document,
      position
    );

    const registryTree = this.getRegistryTree();
    if (!registryTree) return [];

    const completionService = new CompletionService(registryTree, {
      documentText: document.getText(),
      expression: linePrefix,
    });

    const completionItems = completionService.getCompletionItems(currentWord);

    return completionItems.map((key) =>
      this.createCompletionItem(key, document, position)
    );
  }

  private getCurrentContext(
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const wordRange = document.getWordRangeAtPosition(position);
    const currentWord = wordRange ? document.getText(wordRange) : "";
    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);

    return { currentWord, linePrefix };
  }

  private getRegistryTree() {
    const cachedRegistryTreeJson = this.memento.get(
      Configs.REGISTRY_TREE_CACHE_KEY
    );
    if (!cachedRegistryTreeJson) return null;

    return RegistryTree.fromJSON(cachedRegistryTreeJson);
  }

  private createCompletionItem(
    key: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const completionItem = new vscode.CompletionItem(
      key,
      vscode.CompletionItemKind.Field
    );

    completionItem.insertText = key.includes("-") ? `['${key}']` : key;

    completionItem.detail = key.includes("-") ? `['${key}']` : key;

    completionItem.preselect = true;

    if (key.includes("-")) {
      this.handleHyphenatedKey(completionItem, document, position);
    }

    return completionItem;
  }

  private handleHyphenatedKey(
    completionItem: vscode.CompletionItem,
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const line = document.lineAt(position);
    const textBeforeCursor = line.text.substring(0, position.character);

    if (!textBeforeCursor.endsWith(".")) return;

    const range = new vscode.Range(
      position.line,
      position.character - 1,
      position.line,
      position.character
    );

    const textDelete = vscode.TextEdit.delete(range);

    completionItem.additionalTextEdits = [textDelete];
  }
}
