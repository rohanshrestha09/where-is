import * as vscode from "vscode";
import { Configs } from "../configs";
import { RegistryService } from "../services/registry.service";
import { RegistryTree } from "../datastructures/registry-tree";

export class RegistryDisposable implements vscode.Disposable {
  private readonly disposables: vscode.Disposable[] = [];
  private isGitRepositoryOpened = false;

  constructor(
    private readonly memento: vscode.Memento,
    private readonly options: { onRefresh?: () => void }
  ) {
    this.buildRegistryTree();

    this.initializeCommands();

    this.initializeEventListeners();
  }

  private initializeCommands() {
    this.disposables.push(
      vscode.commands.registerCommand(
        Configs.REGISTRY_TREE_REFRESH_COMMAND,
        () => {
          this.handleRefreshRegistry();
          this.options.onRefresh?.();
        }
      )
    );
  }

  private async initializeEventListeners() {
    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        this.buildRegistryTreeForDocument(event.document);
        this.options.onRefresh?.();
      })
    );

    const gitApi = await this.fetchGitApi();
    if (!gitApi) return;

    this.disposables.push(
      gitApi.onDidOpenRepository((repository) => {
        repository.state.onDidChange(() => {
          if (!this.isGitRepositoryOpened) {
            this.isGitRepositoryOpened = true;
            return;
          }
          this.handleRefreshRegistry();
          this.options.onRefresh?.();
        });
      })
    );
  }

  private async fetchGitApi(): Promise<{
    onDidOpenRepository: (
      callback: (repository: {
        state: { onDidChange: (callback: () => void) => void };
      }) => void
    ) => vscode.Disposable;
  } | null> {
    const gitExtension = vscode.extensions.getExtension("vscode.git");
    if (!gitExtension) return null;

    const git = await gitExtension.activate();
    return git.getAPI(1);
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
        `Failed to refresh registry: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
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
