import * as ts from "typescript";

export class PreviewGenerator {
  private text: string;

  constructor(text: string) {
    this.text = text;
  }

  generateFunctionPreview(line: number) {
    const lines = this.text.split("\n");

    let functionText = "";
    let braceCount = 0;
    let functionStarted = false;
    let inString = false;
    let stringChar = "";

    for (let i = line; i < lines.length; i++) {
      const currentLine = lines[i];
      functionText += currentLine + "\n";

      // Process the line character by character
      for (let j = 0; j < currentLine.length; j++) {
        const char = currentLine[j];

        // Handle string literals to avoid counting braces inside strings
        if (
          (char === '"' || char === "'" || char === "`") &&
          (j === 0 || currentLine[j - 1] !== "\\")
        ) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }

        // Only count braces if we're not inside a string
        if (!inString) {
          if (char === "{") {
            braceCount++;
            functionStarted = true;
          } else if (char === "}") {
            braceCount--;
          }
        }
      }

      // Handle arrow functions and single-line functions
      if (
        !functionStarted &&
        (currentLine.includes("=>") ||
          currentLine.includes("function") ||
          currentLine.match(/:\s*function/))
      ) {
        functionStarted = true;
      }

      // Check if function has ended
      if (
        functionStarted &&
        (braceCount === 0 ||
          (braceCount === 0 && currentLine.trim().endsWith(";")))
      ) {
        break;
      }
    }

    return functionText.trim();
  }

  generateFunctionDefinitionPreview(line: number) {
    // Use the generateFunctionPreview method to get the function text
    const functionText = this.generateFunctionPreview(line);
    if (!functionText) {
      return null;
    }

    // Create a source file from the function text
    const sourceFile = ts.createSourceFile(
      "temp.js", // Use .js extension for JavaScript files
      functionText,
      ts.ScriptTarget.Latest,
      true
    );

    // Find the function node within the extracted function text
    const functionNode = this.findFunctionNode(sourceFile); // Start from line 0 of the function text
    if (!functionNode) {
      return null;
    }

    // Create a TypeScript program with the source file
    const program = ts.createProgram(["temp.js"], {});

    const typeChecker = program.getTypeChecker();
    // Cast functionNode to SignatureDeclaration to ensure proper type handling
    const signature = typeChecker.getSignatureFromDeclaration(functionNode);
    if (!signature) {
      return null;
    }

    const returnType = typeChecker.typeToString(signature.getReturnType());
    const parameters = signature.parameters.map((param) => {
      const paramType = typeChecker.getTypeAtLocation(param.valueDeclaration!);
      return `${param.name}: ${typeChecker.typeToString(paramType)}`;
    });

    return `(${parameters.join(", ")}) => ${returnType}`;
  }

  private findFunctionNode(
    sourceFile: ts.SourceFile
  ): ts.FunctionLikeDeclaration | null {
    let functionNode: ts.FunctionLikeDeclaration | null = null;

    const visit = (node: ts.Node) => {
      // Check if the node is a function-like declaration and if the line number falls within its range
      if (
        ts.isFunctionDeclaration(node) ||
        ts.isFunctionExpression(node) ||
        ts.isArrowFunction(node)
      ) {
        functionNode = node;
      }
      ts.forEachChild(node, visit);
    };

    visit(sourceFile);
    return functionNode;
  }
}
