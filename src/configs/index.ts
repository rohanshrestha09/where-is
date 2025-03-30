import * as vscode from "vscode";

export class Configs {
  static readonly REGISTRY_TREE_CACHE_KEY = "whereIs.registryTree";
  static readonly DIAGNOSTIC_COLLECTION_NAME = "whereIs.linter";
  static readonly REGISTRY_TREE_REFRESH_COMMAND =
    "whereIs.refreshRegistryTree";

  private readonly config: vscode.WorkspaceConfiguration;

  constructor(configName: string) {
    this.config = vscode.workspace.getConfiguration(configName);
  }

  get<T>(key: string, defaultValue?: T): T {
    return this.config.get(key, defaultValue) as T;
  }

  set<T>(key: string, value: T): Thenable<void> {
    return this.config.update(key, value);
  }

  when(key: string, value: unknown, callback: () => void): void {
    if (this.config.get(key) === value) {
      callback();
    }
  }

  watch(
    callback: (e: vscode.ConfigurationChangeEvent) => void
  ): vscode.Disposable {
    return vscode.workspace.onDidChangeConfiguration(callback);
  }
}
