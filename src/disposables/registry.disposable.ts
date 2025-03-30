import * as vscode from "vscode";
import { Configs } from "../configs";
import { RegistryService } from "../services/registry.service";
import { RegistryTree } from "../datastructures/registry-tree";

export class RegistryDisposable implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly memento: vscode.Memento) {
    this.initializeRegistry();
  }

  private async initializeRegistry() {
    await this.buildRegistryTree();

    this.disposables.push(
      vscode.commands.registerCommand(
        Configs.REGISTRY_TREE_REFRESH_COMMAND,
        () => this.handleRefreshRegistry()
      )
    );

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document === vscode.window.activeTextEditor?.document) {
          this.buildRegistryTreeForDocument(event.document);
        }
      })
    );
  }

  private async handleRefreshRegistry() {
    try {
      const startTime = performance.now();
      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: "Refreshing registry...",
          cancellable: false,
        },
        async () => {
          await this.buildRegistryTree();
          const duration = Math.round(performance.now() - startTime);
          vscode.window.showInformationMessage(
            `Registry refreshed in ${duration}ms`
          );
        }
      );
    } catch (error) {
      vscode.window.showErrorMessage(
        `Failed to refresh registry: ${(error as Error).message}`
      );
    }
  }

  private async buildRegistryTree() {
    const workspacePath = vscode.workspace.workspaceFolders?.[0].uri.fsPath;
    if (!workspacePath) return;

    const registryService = new RegistryService();
    const registryTree = await registryService.generateCompleteRegistryTree(
      workspacePath
    );

    await this.updateCachedRegistryTree(registryTree);
  }

  private async buildRegistryTreeForDocument(document: vscode.TextDocument) {
    const cachedRegistryTree = this.getCachedRegistryTree();
    if (!cachedRegistryTree) return;

    const registryService = new RegistryService();
    const partialRegistryTree =
      await registryService.generatePartialRegistryTree(document.uri.fsPath);
    if (!partialRegistryTree) return null;

    cachedRegistryTree.merge(partialRegistryTree);

    await this.updateCachedRegistryTree(cachedRegistryTree);
  }

  private getCachedRegistryTree() {
    const cachedRegistryTreeJson = this.memento.get(
      Configs.REGISTRY_TREE_CACHE_KEY
    );
    if (!cachedRegistryTreeJson) return null;

    return RegistryTree.fromJSON(cachedRegistryTreeJson);
  }

  private async updateCachedRegistryTree(registryTree: RegistryTree) {
    await this.memento.update(
      Configs.REGISTRY_TREE_CACHE_KEY,
      registryTree.toJSON()
    );
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
