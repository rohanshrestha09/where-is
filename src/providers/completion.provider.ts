import * as vscode from "vscode";
import { Configs } from "../configs";
import { RegistryTree } from "../datastructures/registry-tree";
import { CompletionService } from "../services/completion.service";
import { ExtraUtil } from "../utils/extra.util";

export class CompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly memento: vscode.Memento) {}

  private getCompletionDetail(key: string): string {
    if (key.includes("model") || key.includes("Model")) {
      return "Model";
    } else if (key.includes("controller") || key.includes("Controller")) {
      return "Controller";
    } else if (key.includes("service") || key.includes("Service")) {
      return "Service";
    }
    return "Property";
  }

  async provideCompletionItems(document: vscode.TextDocument, position: vscode.Position) {
    const { currentWord, linePrefix } = this.getCurrentContext(document, position);

    const registryTree = this.getRegistryTree();
    if (!registryTree) return [];

    const completionService = new CompletionService(registryTree, {
      documentText: document.getText(),
      expression: linePrefix,
    });

    const completionItems = completionService.getCompletionItems(currentWord);

    return completionItems.map((key) => this.createCompletionItem(key, document, position));
  }

  private getCurrentContext(document: vscode.TextDocument, position: vscode.Position) {
    const linePrefix = document.lineAt(position).text.substring(0, position.character);

    const wordRange = document.getWordRangeAtPosition(position);
    const currentWord = wordRange ? document.getText(wordRange) : "";

    return { currentWord, linePrefix };
  }

  private getRegistryTree() {
    const cachedRegistryTreeJson = this.memento.get(Configs.REGISTRY_TREE_CACHE_KEY);
    if (!cachedRegistryTreeJson) return null;

    return RegistryTree.fromJSON(cachedRegistryTreeJson);
  }

  private getInsertText(key: string, textBeforeCursor: string) {
    if (ExtraUtil.isValidIdentifierName(key)) {
      return key;
    }

    if (textBeforeCursor.endsWith(".")) {
      return `['${key}']`;
    }

    return key;
  }

  private createCompletionItem(
    key: string,
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const { linePrefix } = this.getCurrentContext(document, position);
    const insertText = this.getInsertText(key, linePrefix);

    const completionItem = new vscode.CompletionItem(key, vscode.CompletionItemKind.Field);
    completionItem.insertText = new vscode.SnippetString(insertText);
    completionItem.detail = `${key} (${this.getCompletionDetail(key)})`;
    completionItem.preselect = true;
    completionItem.sortText = `!0000_${key}`;
    completionItem.filterText = key;

    if (!ExtraUtil.isValidIdentifierName(key) && linePrefix.endsWith(".")) {
      this.handleInvalidIdentifierName(completionItem, document, position);
    }

    return completionItem;
  }

  private handleInvalidIdentifierName(
    completionItem: vscode.CompletionItem,
    document: vscode.TextDocument,
    position: vscode.Position
  ) {
    const { linePrefix } = this.getCurrentContext(document, position);

    if (!linePrefix.endsWith(".")) return;

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
