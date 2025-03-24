import * as vscode from "vscode";
import { RegistryService } from "../services/registry.service";
import { Configs } from "../configs";

export class RegistryProvider implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly memento: vscode.Memento) {
    this.initializeRegistry();
    this.registerCommands();
  }

  private async initializeRegistry() {
    const cachedRegistryTree = this.getCachedRegistryTree();
    if (!cachedRegistryTree) {
      await this.buildRegistryTree();
    }
  }

  private registerCommands() {
    this.disposables.push(
      vscode.commands.registerCommand("where-is.refreshRegistry", () =>
        this.handleRefreshRegistry()
      )
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

    const registryService = new RegistryService(workspacePath);
    const registryTree = await registryService.generateRegistryTree();

    await this.memento.update(
      Configs.REGISTRY_TREE_CACHE_KEY,
      registryTree.toJSON()
    );
  }

  private getCachedRegistryTree() {
    return this.memento.get(Configs.REGISTRY_TREE_CACHE_KEY);
  }

  dispose() {
    this.disposables.forEach((d) => d.dispose());
  }
}
