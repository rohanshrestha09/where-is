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

  const packageJsonPath = path.join(
    workspaceFolders[0].uri.fsPath,
    "package.json"
  );

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

  const registryDisposable = new RegistryDisposable(context.globalState, {
    onRefresh: () => {
      definitionStore.clear();
      hoverStore.clear();
    },
  });
  context.subscriptions.push(registryDisposable);

  configs.when("enableDefinition", true, () => {
    const definitionProvider = new DefinitionProvider(
      context.globalState,
      definitionStore
    );
    const definitionDisposable = vscode.languages.registerDefinitionProvider(
      "javascript",
      definitionProvider
    );
    context.subscriptions.push(definitionDisposable);
  });

  configs.when("enableHover", true, () => {
    const hoverProvider = new HoverProvider(context.globalState, hoverStore);
    const hoverDisposable = vscode.languages.registerHoverProvider(
      "javascript",
      hoverProvider
    );
    context.subscriptions.push(hoverDisposable);
  });

  configs.when("enableDiagnostic", true, () => {
    const diagnosticDisposable = new DiagnosticDisposable({
      language: "javascript",
    });
    context.subscriptions.push(diagnosticDisposable);
  });

  configs.when("enableCompletion", true, () => {
    const completionProvider = new CompletionProvider(context.globalState);
    const completionDisposable =
      vscode.languages.registerCompletionItemProvider(
        "javascript",
        completionProvider,
        ".",
        `"`,
        "'",
      );
    context.subscriptions.push(completionDisposable);
  });
}
