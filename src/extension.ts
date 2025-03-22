import * as vscode from "vscode";
import * as fs from "fs";
import * as path from "path";
import { Configs } from "./configs";
import { DefinitionProvider } from "./providers/definition.provider";
import { HoverProvider } from "./providers/hover.provider";
import { DiagnosticProvider } from "./providers/diagnostic.provider";
import { RegistryProvider } from "./providers/registry.provider";

const locationStore = new Map<string, vscode.Location>();
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

  const registryProvider = new RegistryProvider(context.globalState);
  context.subscriptions.push(registryProvider);

  configs.when("enableDiagnostic", true, () => {
    const diagnosticProvider = new DiagnosticProvider({
      language: "javascript",
    });
    context.subscriptions.push(diagnosticProvider);
  });

  configs.when("enableDefinition", true, () => {
    const definitionProvider = new DefinitionProvider(locationStore);
    const definitionDisposable = vscode.languages.registerDefinitionProvider(
      "javascript",
      definitionProvider
    );
    context.subscriptions.push(definitionDisposable);
  });

  configs.when("enableHover", true, () => {
    const hoverProvider = new HoverProvider(hoverStore);
    const hoverDisposable = vscode.languages.registerHoverProvider(
      "javascript",
      hoverProvider
    );
    context.subscriptions.push(hoverDisposable);
  });
}
