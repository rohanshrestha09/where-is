import * as vscode from "vscode";
import {
  AutocompletionService,
  Completion,
} from "../services/autocompletion.service";
import { RegistryTree } from "../datastructures/registry-tree";
import { Configs } from "../configs";

export class AutocompletionProvider implements vscode.CompletionItemProvider {
  constructor(private readonly memento: vscode.Memento) {}

  provideCompletionItems(
    document: vscode.TextDocument,
    position: vscode.Position,
    token: vscode.CancellationToken,
    context: vscode.CompletionContext
  ): vscode.CompletionItem[] {
    const linePrefix = document
      .lineAt(position)
      .text.substring(0, position.character);
    const currentPath = linePrefix.split("/").filter(Boolean);
    const lastSegment = currentPath.pop() || "";

    const registryTreeJson = this.memento.get(Configs.REGISTRY_TREE_CACHE_KEY);
    if (!registryTreeJson) return [];

    const autocompletionService = new AutocompletionService(
      RegistryTree.fromJSON(registryTreeJson)
    );

    let completions: Completion[];
    if (currentPath.length > 0) {
      completions = autocompletionService.getCompletionsByPath(currentPath);
    } else {
      completions = autocompletionService.getCompletions(lastSegment);
    }

    return completions.map((completion) => {
      const item = new vscode.CompletionItem(
        completion.label,
        vscode.CompletionItemKind.Reference
      );

      item.detail = completion.detail;
      item.documentation = completion.path.join("/");
      item.insertText = completion.label;

      // Sort completions alphabetically
      item.sortText = completion.label.toLowerCase();

      return item;
    });
  }
}
