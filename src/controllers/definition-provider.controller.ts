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

        // Get the entire line where the cursor is positioned
        const lineText = document.lineAt(position.line).text.trim();

        if (!word && !lineText) {
          return null;
        }

        const functionName = word;

        const workspaceFolders = vscode.workspace.workspaceFolders;

        const documentPath = workspaceFolders
          ? workspaceFolders[0].uri.fsPath
          : undefined;

        const definitionProviderService = new DefinitionProviderService({
          documentText,
          documentPath,
          functionName,
          lineText,
        });

        const functionDefinition =
          await definitionProviderService.findFunctionDefiniton();

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
