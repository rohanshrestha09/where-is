import * as fs from "fs";
import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { FileUtil } from "../utils/file.util";
import { GraphUtil } from "../utils/graph.util";
import { ExtraUtil } from "../utils/extra.util";

export class DefinitionService {
  private readonly cAST: acorn.Program;
  private readonly documentText: string;
  private readonly workspacePath?: string;
  private readonly functionName: string;
  private readonly lineNumber: number;

  constructor(props: {
    documentText: string;
    functionName: string;
    workspacePath?: string;
    lineNumber: number;
  }) {
    this.cAST = acorn.parse(props.documentText, {
      ecmaVersion: "latest",
      sourceType: "script",
      locations: true,
    });
    this.documentText = props.documentText;
    this.workspacePath = props.workspacePath;
    this.functionName = props.functionName;
    this.lineNumber = props.lineNumber;
  }

  private findRootFunctionArgumentName() {
    let argumentName: string | null = null;

    try {
      acornWalk.simple(this.cAST, {
        AssignmentExpression: (node: acorn.AssignmentExpression) => {
          if (
            node.left.type === "MemberExpression" &&
            node.left.object.type === "Identifier" &&
            node.left.object.name === "internals" &&
            node.left.property.type === "Identifier" &&
            (node.left.property.name === "controller" ||
              node.left.property.name === "applyRoutes")
          ) {
            if (
              (node.right.type === "ArrowFunctionExpression" ||
                node.right.type === "FunctionExpression") &&
              node.right.params.length > 0 &&
              node.right.params[0].type === "Identifier"
            ) {
              argumentName = node.right.params[0].name;
            }
          }
        },
      });

      return argumentName as string | null;
    } catch (error) {
      return null;
    }
  }

  private findAllAssignments() {
    try {
      const assignments = new Map<string, string>();
      const relevantVariables = new Set<string>();

      // First pass: collect variables that are part of member expressions
      acornWalk.simple(this.cAST, {
        MemberExpression: (node: acorn.MemberExpression) => {
          if (node.object.type === "Identifier") {
            relevantVariables.add(node.object.name);
          }
        },
      });

      // Second pass: only collect assignments for relevant variables
      acornWalk.simple(this.cAST, {
        VariableDeclarator: (node: acorn.VariableDeclarator) => {
          if (
            node.id.type === "Identifier" &&
            node.init?.type !== "FunctionExpression" &&
            node.init?.type !== "ArrowFunctionExpression" &&
            relevantVariables.has(node.id.name)
          ) {
            assignments.set(
              node.id.name,
              this.documentText.slice(node.init?.start, node.init?.end)
            );
          }
        },
      });

      return assignments;
    } catch (error) {
      return new Map<string, string>();
    }
  }

  findFunctionCallExpression() {
    try {
      let functionCallParts: string[] = [];
      let closestDistance = Infinity;

      const extractChain = (node: acorn.AnyNode): string[] => {
        const parts: string[] = [];

        if (node.type === "MemberExpression") {
          if (node.object.type === "MemberExpression") {
            parts.push(...extractChain(node.object));
          } else if (node.object.type === "Identifier") {
            parts.push(node.object.name);
          }

          if (node.property.type === "Identifier") {
            parts.push(node.property.name);
          } else if (node.property.type === "Literal") {
            parts.push(String(node.property.value));
          }
        }

        return parts;
      };

      acornWalk.simple(this.cAST, {
        Property: (node: acorn.Property | acorn.AssignmentProperty) => {
          if (
            node.key.type === "Identifier" &&
            node.key.name === "handler" &&
            node.value.type === "MemberExpression"
          ) {
            const parts = extractChain(node.value);
            const lastPart = parts[parts.length - 1];
            if (lastPart === this.functionName && node.loc) {
              const distance = Math.abs(node.loc.start.line - this.lineNumber);
              if (distance <= 5 && distance < closestDistance) {
                closestDistance = distance;
                functionCallParts = parts;
              }
            }
          }
        },
        CallExpression: (node: acorn.CallExpression) => {
          if (node.callee.type === "MemberExpression") {
            const parts = extractChain(node.callee);
            const lastPart = parts[parts.length - 1];
            if (lastPart === this.functionName && node.loc) {
              const distance = Math.abs(node.loc.start.line - this.lineNumber);
              if (distance <= 5 && distance < closestDistance) {
                closestDistance = distance;
                functionCallParts = parts;
              }
            }
          }
        },
      });

      return functionCallParts.join(".");
    } catch (error) {
      return null;
    }
  }

  private async findFunctionLocation(filePath: string) {
    const content = await fs.promises.readFile(filePath, "utf-8");

    try {
      let functionNode: acorn.Node | null = null;

      const nAST = acorn.parse(content, {
        ecmaVersion: "latest",
        sourceType: "script",
        locations: true,
      });

      acornWalk.simple(nAST, {
        FunctionDeclaration: (
          node: acorn.FunctionDeclaration | acorn.AnonymousFunctionDeclaration
        ) => {
          if (
            node.id?.type === "Identifier" &&
            node.id.name === this.functionName
          ) {
            functionNode = node;
          }
        },
        VariableDeclarator: (node: acorn.VariableDeclarator) => {
          if (
            node.id.type === "Identifier" &&
            node.id.name === this.functionName &&
            (node.init?.type === "FunctionExpression" ||
              node.init?.type === "ArrowFunctionExpression")
          ) {
            functionNode = node;
          }
        },
        Property: (node: acorn.Property | acorn.AssignmentProperty) => {
          if (
            node.key.type === "Identifier" &&
            node.key.name === this.functionName &&
            (node.value.type === "FunctionExpression" ||
              node.value.type === "ArrowFunctionExpression")
          ) {
            functionNode = node;
          }
        },
      });

      if (functionNode) {
        functionNode = functionNode as acorn.Node;
        const path = filePath;
        const line = functionNode.loc?.start?.line ?? 0;
        const text = content.slice(functionNode.start, functionNode.end);
        const loc = text.split("\n").length;
        return { content, path, line, text, loc };
      }
    } catch (error) {
      return null;
    }

    return null;
  }

  private async findFilePathsByReference(
    nameReference: string,
    pathReference: string
  ) {
    const directPattern = `**/${ExtraUtil.convertToKebabCase(
      nameReference
    )}.js`;
    let filePaths = await FileUtil.findFilesByPattern(directPattern, {
      cwd: this.workspacePath,
    });
    if (filePaths.length) return filePaths;

    const globPattern = `**/*-${ExtraUtil.getGlobPathReference(
      pathReference
    )}.js`;
    const candidateFiles = await FileUtil.findFilesByPattern(globPattern, {
      cwd: this.workspacePath,
    });

    return await FileUtil.findBestMatchingFiles(candidateFiles, nameReference, {
      cutoff: 50,
    });
  }

  async findFunctionDefiniton() {
    if (!ExtraUtil.isValidFunctionName(this.functionName)) return null;

    try {
      const rootFunctionArgumentName = this.findRootFunctionArgumentName();
      if (!rootFunctionArgumentName) return null;

      const functionCallExpression = this.findFunctionCallExpression();
      if (!functionCallExpression) return null;

      const allAssignments = this.findAllAssignments();

      const graphUtil = new GraphUtil();
      const graph = graphUtil.buildDirectedGraph(allAssignments, [
        functionCallExpression,
      ]);

      const functionCallGraphUtil = new GraphUtil();
      const functionCallGraph =
        functionCallGraphUtil.buildDirectedGraphFromMethodCallExpressions([
          functionCallExpression,
        ]);
      const functionCallOutgoingEdges = functionCallGraph.getOutgoingEdges(
        this.functionName
      );

      const paths =
        graph.findAllPathsThrough(
          this.functionName,
          functionCallOutgoingEdges[0],
          rootFunctionArgumentName
        )[0] ?? [];
      if (!paths.length) return null;

      const pathReference = paths[paths.length - 3];
      const nameReference = paths[paths.length - 5];
      if (!pathReference || !nameReference) return null;

      const filePaths = await this.findFilePathsByReference(
        nameReference,
        pathReference
      );
      if (!filePaths.length) return null;

      const filePath = await FileUtil.findFirstOccurringFile(
        new RegExp(`\\w+Name:?\\s*(?:['"\`])${nameReference}(?:['"\`])`),
        filePaths,
        { batchSize: 30 }
      );
      if (!filePath) return null;

      return this.findFunctionLocation(filePath);
    } catch (err) {
      return null;
    }
  }
}
