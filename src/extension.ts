import * as vscode from "vscode";
import { DefinitionProvider } from "./providers/definition.provider";
import { HoverProvider } from "./providers/hover.provider";

const locationStore = new Map<string, vscode.Location>();
const hoverStore = new Map<string, vscode.Hover>();

// Register the definition provider and hover provider
export function activate(context: vscode.ExtensionContext) {
  const definitionProvider = new DefinitionProvider(locationStore);
  const definitionDisposable = vscode.languages.registerDefinitionProvider(
    "javascript",
    definitionProvider
  );

  const hoverProvider = new HoverProvider(hoverStore);
  const hoverDisposable = vscode.languages.registerHoverProvider(
    "javascript",
    hoverProvider
  );

  context.subscriptions.push(definitionDisposable);
  context.subscriptions.push(hoverDisposable);
}
