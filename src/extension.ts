import * as vscode from "vscode";
import { DefinitionProviderController } from "./controllers/definition-provider.controller";
import { HoverProviderController } from "./controllers/hover-provider.controller";

const locationStore = new Map<string, vscode.Location>();
const hoverStore = new Map<string, vscode.Hover>();

// Register the definition provider and hover provider
export function activate(context: vscode.ExtensionContext) {
  const definitionProviderController = new DefinitionProviderController(
    locationStore
  );
  const definitionProvider = vscode.languages.registerDefinitionProvider(
    "javascript",
    definitionProviderController
  );

  const hoverProviderController = new HoverProviderController(hoverStore);
  const hoverProvider = vscode.languages.registerHoverProvider(
    "javascript",
    hoverProviderController
  );

  context.subscriptions.push(definitionProvider);
  context.subscriptions.push(hoverProvider);
}
