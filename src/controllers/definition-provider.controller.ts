import * as vscode from "vscode";
import { DefinitionProviderService } from "../services/definition-provider.service";

export class DefinitionProviderController {
  registerDefinitionProvider() {
    return vscode.languages.registerDefinitionProvider("javascript", {
      async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position
      ) {
        // read text of whole document
        const documentText = document.getText();

        // find the word under the cursor
        const wordRange = document.getWordRangeAtPosition(position);
        const word = document.getText(wordRange);

        if (!word) {
          return null;
        }

        const functionName = word;

        const workspaceFolders = vscode.workspace.workspaceFolders;

        const cwd = workspaceFolders
          ? workspaceFolders[0].uri.fsPath
          : undefined;

        const definitionProviderService = new DefinitionProviderService(
          documentText,
          cwd
        );

        const functionDefinition =
          await definitionProviderService.findFunctionDefiniton(functionName);

        if (!functionDefinition) {
          return;
        }

        return new vscode.Location(
          vscode.Uri.file(functionDefinition.path),
          new vscode.Position(functionDefinition.line, 0)
        );
      },
    });
  }
}
