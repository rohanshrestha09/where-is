import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { FileUtil } from "../utils/file.util";
import { GraphUtil } from "../utils/graph.util";
import { ExtraUtil } from "../utils/extra.util";
import { RegistryTree } from "../datastructures/registry-tree";
import { REGISTRY_TREE_ROOT_NODE } from "../constants";

export class DefinitionService {
  private readonly ast: acorn.Program;
  private readonly documentText: string;
  private readonly functionName: string;
  private readonly lineNumber: number;

  constructor(
    private readonly registryTree: RegistryTree,
    options: {
      documentText: string;
      functionName: string;
      lineNumber: number;
    }
  ) {
    this.ast = acorn.parse(options.documentText, {
      ecmaVersion: "latest",
      sourceType: "script",
      locations: true,
      ranges: false,
    });
    this.documentText = options.documentText;
    this.functionName = options.functionName;
    this.lineNumber = options.lineNumber;
  }

  private findRootFunctionArgumentName() {
    let argumentName: string | null = null;

    try {
      acornWalk.simple(this.ast, {
        AssignmentExpression: (node: acorn.AssignmentExpression) => {
          if (
            node.left.type === "MemberExpression" &&
            node.left.object.type === "Identifier" &&
            node.left.object.name === "internals" &&
            node.left.property.type === "Identifier" &&
            (node.left.property.name === "controller" ||
              node.left.property.name === "applyRoutes" ||
              node.left.property.name === "Model")
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

      return argumentName;
    } catch (error) {
      return null;
    }
  }

  private findAllAssignments() {
    try {
      const assignments = new Map<string, string>();
      const relevantVariables = new Set<string>();

      // First pass: collect variables that are part of member expressions
      acornWalk.simple(this.ast, {
        MemberExpression: (node: acorn.MemberExpression) => {
          if (node.object.type === "Identifier") {
            relevantVariables.add(node.object.name);
          }
        },
      });

      // Second pass: only collect assignments for relevant variables
      acornWalk.simple(this.ast, {
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

  private findFunctionCallExpression() {
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

      acornWalk.simple(this.ast, {
        MemberExpression: (node: acorn.MemberExpression) => {
          const parts = extractChain(node);
          const lastPart = parts[parts.length - 1];
          if (lastPart === this.functionName && node.loc) {
            const distance = Math.abs(node.loc.start.line - this.lineNumber);
            if (distance <= 5 && distance < closestDistance) {
              closestDistance = distance;
              functionCallParts = parts;
            }
          }
        },
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
      graph.renameVertex(rootFunctionArgumentName, REGISTRY_TREE_ROOT_NODE);

      const functionCallGraphUtil = new GraphUtil();
      const functionCallGraph =
        functionCallGraphUtil.buildDirectedGraphFromMethodCallExpressions([
          functionCallExpression,
        ]);
      functionCallGraph.renameVertex(
        rootFunctionArgumentName,
        REGISTRY_TREE_ROOT_NODE
      );

      const functionCallOutgoingEdges = functionCallGraph.getOutgoingEdges(
        this.functionName
      );

      const paths =
        graph.findAllPathsThroughWithData(
          this.functionName,
          functionCallOutgoingEdges[0],
          REGISTRY_TREE_ROOT_NODE
        )[0] ?? [];
      if (!paths.length) return null;

      const nonAssignmentPaths = paths
        .filter(([_, data]) => !data?.isAssignmentTarget)
        .map(([vertex]) => vertex);
      if (nonAssignmentPaths.length < 5) return null;

      const functionNode = this.registryTree.getNode(
        [...nonAssignmentPaths].reverse()
      );
      if (!functionNode) return null;

      const text = await FileUtil.readFileRange(
        functionNode.path,
        functionNode.start,
        functionNode.end
      );

      return { ...functionNode, text };
    } catch (err) {
      return null;
    }
  }
}
