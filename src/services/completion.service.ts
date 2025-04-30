import * as acorn from "acorn";
import * as acornLoose from "acorn-loose";
import * as acornWalk from "acorn-walk";
import { RegistryTree } from "../datastructures/registry-tree";
import { REGISTRY_TREE_ROOT_NODE } from "../constants";

export class CompletionService {
  private readonly documentText: string;
  private readonly expression: string;

  constructor(
    private readonly registryTree: RegistryTree,
    options: {
      documentText: string;
      expression: string;
    }
  ) {
    this.documentText = options.documentText;
    this.expression = options.expression;
  }

  private findRootFunctionArgumentName() {
    const ast = acornLoose.parse(this.documentText, {
      ecmaVersion: "latest",
      sourceType: "script",
    });

    let argumentName: string | null = null;

    try {
      acornWalk.simple(ast, {
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

  parseExpression() {
    try {
      const ast = acornLoose.parse(`(${this.expression})`, {
        ecmaVersion: "latest",
        sourceType: "script",
      });

      if (ast.body[0]?.type !== "ExpressionStatement") {
        return this.expression.trim().split(".");
      }

      const parts: string[] = [];
      const exprStmt = ast.body[0];

      acornWalk.simple(exprStmt.expression, {
        MemberExpression(node: acorn.MemberExpression) {
          if (node.property.type === "Identifier") {
            parts.push(node.property.name);
          } else if (node.property.type === "Literal") {
            const value = node.property.value;
            if (value) parts.push(value.toString());
          }
        },
        Identifier(node: acorn.Identifier) {
          if (parts.length === 0) parts.push(node.name);
        },
      });

      return parts.length > 0 ? parts : null;
    } catch (error) {
      console.error(error);
      return this.expression.trim().split(".");
    }
  }

  private traverseTree(path: string[]) {
    let currentTree: RegistryTree | undefined = this.registryTree;

    for (const word of path) {
      const trimmedWord = word.trim();
      if (!trimmedWord) continue;

      currentTree = currentTree.children.get(trimmedWord);
      if (!currentTree) return null;
    }

    return currentTree;
  }

  getCompletionItems(currentWord: string) {
    const rootFunctionArgumentName = this.findRootFunctionArgumentName();
    if (!rootFunctionArgumentName) return [];

    this.registryTree.changeKeyAtLevel(
      0,
      REGISTRY_TREE_ROOT_NODE,
      rootFunctionArgumentName
    );

    const pathParts = this.parseExpression();
    if (!pathParts) return [];

    const currentTree = this.traverseTree(pathParts.slice(0, -1));
    if (!currentTree) return [];

    const completionItems: string[] = [];
    currentTree.children.forEach((_, key) => {
      if (key.startsWith(currentWord)) {
        completionItems.push(key);
      }
    });

    return completionItems;
  }
}
