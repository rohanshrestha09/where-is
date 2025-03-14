import * as vscode from "vscode";
import { DefinitionProviderController } from "./controllers/definition-provider.controller";
import { HoverProviderController } from "./controllers/hover-provider.controller";

// Register the definition provider and hover provider
export function activate(context: vscode.ExtensionContext) {
  const definitionProviderController = new DefinitionProviderController();
  const definitionProvider =
    definitionProviderController.registerDefinitionProvider();

  const hoverProviderController = new HoverProviderController();
  const hoverProvider = hoverProviderController.registerHoverProvider();

  context.subscriptions.push(hoverProvider);
  context.subscriptions.push(definitionProvider);
}
