import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Configs } from "./configs";
import { DefinitionProvider } from "./providers/definition.provider";
import { HoverProvider } from "./providers/hover.provider";
import { CompletionProvider } from "./providers/completion.provider";
import { DiagnosticDisposable } from "./disposables/diagnostic.disposable";
import { RegistryDisposable } from "./disposables/registry.disposable";

const definitionStore = new Map<string, vscode.Location>();
const hoverStore = new Map<string, vscode.Hover>();

async function isProjectEnabled(enabledWorkspaces: string[]) {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders?.length) return false;

  const candidateFolders: { name: string; fsPath: string }[] = [];

  for (const folder of workspaceFolders) {
    candidateFolders.push({ name: folder.name, fsPath: folder.uri.fsPath });

    try {
      const entries = await fs.promises.readdir(folder.uri.fsPath, {
        withFileTypes: true,
      });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          candidateFolders.push({
            name: entry.name,
            fsPath: path.join(folder.uri.fsPath, entry.name),
          });
        }
      }
    } catch {
      // ignore readdir errors (e.g. permission, not a directory)
    }
  }

  const enabledFolder = candidateFolders.find((c) =>
    enabledWorkspaces.includes(c.name)
  );
  if (!enabledFolder) return false;

  const packageJsonPath = path.join(enabledFolder.fsPath, "package.json");

  try {
    const content = await fs.promises.readFile(packageJsonPath, "utf-8");
    const packageJson = JSON.parse(content);
    return enabledWorkspaces.includes(packageJson.name);
  } catch {
    return false;
  }
}

export async function activate(context: vscode.ExtensionContext) {
  const configs = new Configs("whereIs");

  const enabledProjects = configs.get("enabledProjects", []);

  const isEnabled = await isProjectEnabled(enabledProjects);
  if (!isEnabled) return;

  // vscode.workspace
  //   .getConfiguration()
  //   .update("editor.suggest.showWords", false, vscode.ConfigurationTarget.Workspace);

  const registryDisposable = new RegistryDisposable(context.globalState, {
    onRefresh: () => {
      definitionStore.clear();
      hoverStore.clear();
    },
  });
  context.subscriptions.push(registryDisposable);

  configs.when("enableDefinition", true, () => {
    const definitionProvider = new DefinitionProvider(context.globalState, definitionStore);
    const definitionDisposable = vscode.languages.registerDefinitionProvider(
      "javascript",
      definitionProvider
    );
    context.subscriptions.push(definitionDisposable);
  });

  configs.when("enableHover", true, () => {
    const hoverProvider = new HoverProvider(context.globalState, hoverStore);
    const hoverDisposable = vscode.languages.registerHoverProvider("javascript", hoverProvider);
    context.subscriptions.push(hoverDisposable);
  });

  configs.when("enableDiagnostic", true, () => {
    const diagnosticDisposable = new DiagnosticDisposable({
      language: "javascript",
    });
    context.subscriptions.push(diagnosticDisposable);
  });

  // configs.when("enableCompletion", true, () => {
  //   const completionProvider = new CompletionProvider(context.globalState);
  //   const completionDisposable = vscode.languages.registerCompletionItemProvider(
  //     "javascript",
  //     completionProvider,
  //     ".",
  //     '"',
  //     "'"
  //   );
  //   context.subscriptions.push(completionDisposable);
  // });
}
