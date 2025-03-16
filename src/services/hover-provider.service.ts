import ts from "typescript";
import { ProviderProps } from "../types";
import { DefinitionProviderService } from "./definition-provider.service";
import { BaseProviderService } from "./base-provider.service";

export class HoverProviderService extends BaseProviderService {
  private readonly functionName: string;
  private readonly definitionProviderService: DefinitionProviderService;

  constructor(props: ProviderProps) {
    super();
    this.functionName = props.functionName;
    this.definitionProviderService = new DefinitionProviderService(props);
  }

  async findFunctionBodyPreview() {
    if (!this.isValidFunctionName(this.functionName)) {
      return null;
    }

    const functionDefinition =
      await this.definitionProviderService.findFunctionDefiniton();
    if (!functionDefinition) {
      return null;
    }

    const lines = functionDefinition.content.split("\n");

    let functionText = "";
    let braceCount = 0;
    let functionStarted = false;
    let inString = false;
    let stringChar = "";

    for (let i = functionDefinition.line; i < lines.length; i++) {
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

    return {
      text: functionText.trim(),
      filePath: functionDefinition.path,
      line: functionDefinition.line,
    };
  }

  async findFunctionDefinitionPreview() {
    if (!this.isValidFunctionName(this.functionName)) {
      return null;
    }

    const functionPreview = await this.findFunctionBodyPreview();
    if (!functionPreview) {
      return null;
    }

    // Create a source file from the function text
    const sourceFile = ts.createSourceFile(
      "temp.js", // Use .js extension for JavaScript files
      functionPreview.text,
      ts.ScriptTarget.Latest,
      true
    );

    // Find the function node within the extracted function text
    const functionNode = this.findFunctionNode(sourceFile); // Start from line 0 of the function text
    if (!functionNode) {
      return null;
    }

    // Create a TypeScript program with the source file
    const program = ts.createProgram({
      rootNames: ["temp.js"],
      options: {
        allowJs: true,
        target: ts.ScriptTarget.Latest,
        module: ts.ModuleKind.CommonJS,
      },
      host: {
        fileExists: (fileName) => fileName === "temp.js",
        readFile: (fileName) =>
          fileName === "temp.js" ? functionPreview.text : undefined,
        getSourceFile: (fileName, languageVersion) =>
          fileName === "temp.js" ? sourceFile : undefined,
        writeFile: () => {},
        getDefaultLibFileName: () => "lib.d.ts",
        useCaseSensitiveFileNames: () => true,
        getCanonicalFileName: (fileName) => fileName,
        getCurrentDirectory: () => "",
        getNewLine: () => "\n",
        getDirectories: () => [],
      },
    });

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

    // Check if the function is async and wrap return type in Promise if needed
    const isAsync =
      ts.getCombinedModifierFlags(functionNode) & ts.ModifierFlags.Async;
    const finalReturnType = isAsync ? `Promise<${returnType}>` : returnType;

    return {
      text: `const ${this.functionName}: (${parameters.join(
        ", "
      )}) => ${finalReturnType}`,
      line: functionPreview.line,
      filePath: functionPreview.filePath,
    };
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
