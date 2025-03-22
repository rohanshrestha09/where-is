import * as vscode from "vscode";
import * as path from "path";
import { DiagnosticService } from "../services/diagnostic.service";

export class DiagnosticProvider implements vscode.Disposable {
  private diagnosticCollection =
    vscode.languages.createDiagnosticCollection("where-is.linter");
  private disposables: vscode.Disposable[] = [];

  constructor(private readonly options: { language: string }) {
    this.initializeListeners();
  }

  private initializeListeners() {
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor((editor) => {
        if (editor) {
          this.analyzeCurrent(editor.document);
        }
      })
    );

    this.disposables.push(
      vscode.workspace.onDidChangeTextDocument((event) => {
        if (event.document === vscode.window.activeTextEditor?.document) {
          this.analyzeCurrent(event.document);
        }
      })
    );

    if (vscode.window.activeTextEditor) {
      this.analyzeCurrent(vscode.window.activeTextEditor.document);
    }
  }

  private analyzeCurrent(document: vscode.TextDocument) {
    if (document.languageId !== this.options.language) {
      return;
    }
    const diagnostics: vscode.Diagnostic[] = [];
    const text = document.getText();
    const fileName = path.parse(document.fileName).name;

    const diagnosticService = new DiagnosticService(text, fileName);

    const warnings = diagnosticService.analyzeWarnings();
    warnings.forEach(({ message, start, end }) => {
      const startPosition = document.positionAt(start);
      const endPosition = document.positionAt(end);

      const diagnostic = new vscode.Diagnostic(
        new vscode.Range(startPosition, endPosition),
        message,
        vscode.DiagnosticSeverity.Warning
      );
      diagnostics.push(diagnostic);
    });

    this.diagnosticCollection.set(document.uri, diagnostics);
  }

  public clearDiagnostics() {
    this.diagnosticCollection.clear();
  }

  public dispose() {
    this.diagnosticCollection.dispose();
    this.disposables.forEach((d) => d.dispose());
  }
}
