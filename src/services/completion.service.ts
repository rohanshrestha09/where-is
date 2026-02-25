import * as acorn from "acorn";
import * as acornLoose from "acorn-loose";
import * as acornWalk from "acorn-walk";
import { RegistryTree } from "../datastructures/registry-tree";
import { REGISTRY_TREE_ROOT_NODE } from "../constants";
import { ExtraUtil } from "../utils/extra.util";

export class CompletionService {
  private readonly documentText: string;
  private readonly expression: string;
  private readonly variableMap: Map<string, string> = new Map();

  constructor(
    private readonly registryTree: RegistryTree,
    options: {
      documentText: string;
      expression: string;
    }
  ) {
    this.documentText = options.documentText;
    this.expression = options.expression;
    this.buildVariableMap();
  }

  private buildVariableMap() {
    const ast = acornLoose.parse(this.documentText, {
      ecmaVersion: "latest",
      sourceType: "script",
    });

    const rootFunctionArgumentName = this.findRootFunctionArgumentName();
    if (!rootFunctionArgumentName) return;

    try {
      acornWalk.simple(ast, {
        VariableDeclarator: (node: acorn.VariableDeclarator) => {
          if (node.id.type === "Identifier" && node.init) {
            const varName = node.id.name;
            const initValue = this.extractInitValue(node.init, rootFunctionArgumentName);
            if (initValue) {
              this.variableMap.set(varName, initValue);
            }
          }
        },
      });
    } catch (error) {}
  }

  private extractInitValue(node: acorn.Node, rootArgName: string): string | null {
    if (node.type === "MemberExpression") {
      const path = this.extractMemberExpressionPath(node);
      if (path && path[0] === rootArgName) {
        return path.join(".");
      }
    } else if (node.type === "Literal") {
      return null;
    } else if (node.type === "Identifier") {
      return this.variableMap.get((node as acorn.Identifier).name) || null;
    }
    return null;
  }

  private extractMemberExpressionPath(node: any): string[] | null {
    const parts: string[] = [];
    let currentNode = node;

    while (currentNode && currentNode.type === "MemberExpression") {
      if (currentNode.property.type === "Identifier" && !currentNode.computed) {
        parts.unshift(currentNode.property.name);
      } else if (currentNode.property.type === "Literal") {
        const value = currentNode.property.value;
        if (value) parts.unshift(value.toString());
      }
      currentNode = currentNode.object;
    }

    if (currentNode?.type === "Identifier") {
      parts.unshift(currentNode.name);
      return parts;
    }

    return null;
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

      return argumentName as string | null;
    } catch (error) {
      return null;
    }
  }

  private parseAssignmentExpression(expression: string) {
    const assignmentMatch = expression.match(/(?:(?:const|let|var)\s+)?(\w+)\s*=\s*(.*)$/);

    if (assignmentMatch) {
      const left = ExtraUtil.stripKeywords(assignmentMatch[1].trim());
      const right = ExtraUtil.stripKeywords(assignmentMatch[2].trim());
      return [left, right];
    }

    const strippedExpression = ExtraUtil.stripKeywords(expression.trim());
    if (strippedExpression !== expression) {
      return [null, strippedExpression];
    }

    try {
      const ast = acornLoose.parse(expression, {
        ecmaVersion: "latest",
        sourceType: "script",
      });

      let leftNode: acorn.Node | null = null;
      let rightNode: acorn.Node | null = null;

      acornWalk.simple(ast, {
        VariableDeclarator: (node: acorn.VariableDeclarator) => {
          if (node.id && node.init) {
            leftNode = node.id;
            rightNode = node.init;
          }
        },
        AssignmentExpression: (node: acorn.AssignmentExpression) => {
          leftNode = node.left;
          rightNode = node.right;
        },
      });

      if (leftNode && rightNode) {
        let left = this.extractExpressionFromNode(leftNode);
        let right = this.extractExpressionFromNode(rightNode);

        if (left) {
          left = ExtraUtil.stripKeywords(left);
        }

        if (right) {
          right = ExtraUtil.stripKeywords(right);
        }

        return [left, right];
      }
    } catch (error) {}

    return [null, null];
  }

  private extractExpressionFromNode(node: acorn.Node): string | null {
    if (node.type === "MemberExpression") {
      return this.extractMemberExpressionString(node as acorn.MemberExpression);
    } else if (node.type === "Identifier") {
      return (node as acorn.Identifier).name;
    } else if (node.type === "Literal") {
      return String((node as acorn.Literal).value);
    }
    return null;
  }

  private extractMemberExpressionString(node: acorn.MemberExpression): string {
    const parts: string[] = [];
    let currentNode: acorn.Node = node;

    while (currentNode.type === "MemberExpression") {
      const memberNode = currentNode as acorn.MemberExpression;

      if (memberNode.property.type === "Identifier" && !memberNode.computed) {
        parts.unshift(memberNode.property.name);
      } else if (memberNode.property.type === "Literal") {
        const value = (memberNode.property as acorn.Literal).value;
        if (value) parts.unshift(value.toString());
      }

      currentNode = memberNode.object;
    }

    if (currentNode.type === "Identifier") {
      parts.unshift((currentNode as acorn.Identifier).name);
    }

    return parts.join(".");
  }

  private normalizeExpression(expression: string): string {
    let normalized = expression.trim();

    try {
      acornLoose.parse(`(${normalized})`, {
        ecmaVersion: "latest",
        sourceType: "script",
      });
      return normalized;
    } catch (error) {
      return this.fixIncompleteExpression(normalized);
    }
  }

  private fixIncompleteExpression(expression: string): string {
    let fixed = expression;

    const openBracketCount = (fixed.match(/\[/g) || []).length;
    const closeBracketCount = (fixed.match(/\]/g) || []).length;
    const openQuoteCount = (fixed.match(/['"]/g) || []).length;

    if (openBracketCount > closeBracketCount) {
      if (openQuoteCount % 2 === 1) {
        const lastQuote = fixed.match(/['"](?=[^'"]*$)/)?.[0];
        if (lastQuote) {
          fixed += lastQuote;
        }
      }
      fixed += "]".repeat(openBracketCount - closeBracketCount);
    }

    try {
      acornLoose.parse(`(${fixed})`, {
        ecmaVersion: "latest",
        sourceType: "script",
      });
      return fixed;
    } catch (error) {
      return expression;
    }
  }

  private extractPathFromComplexAST(ast: acorn.Node): string[] | null {
    if (ast.type === "LogicalExpression") {
      const logicalNode = ast as acorn.LogicalExpression;
      return this.extractPathFromAST(logicalNode.right);
    }

    if (ast.type === "ConditionalExpression") {
      const conditionalNode = ast as acorn.ConditionalExpression;
      return this.extractPathFromAST(conditionalNode.consequent);
    }

    return this.extractPathFromAST(ast);
  }

  private extractPathFromAST(ast: acorn.Node): string[] | null {
    const parts: string[] = [];
    let currentNode: acorn.Node = ast;

    while (currentNode) {
      if (currentNode.type === "MemberExpression") {
        const memberNode = currentNode as acorn.MemberExpression;

        if (memberNode.property.type === "Identifier" && !memberNode.computed) {
          parts.unshift(memberNode.property.name);
        } else if (memberNode.property.type === "Literal") {
          const value = (memberNode.property as acorn.Literal).value;
          if (value) parts.unshift(value.toString());
        }

        currentNode = memberNode.object;
      } else if (currentNode.type === "Identifier") {
        const varName = (currentNode as acorn.Identifier).name;
        parts.unshift(varName);

        const resolvedPath = this.variableMap.get(varName);
        if (resolvedPath && resolvedPath !== varName) {
          parts.shift();
          const resolvedParts = resolvedPath.split(".");
          parts.unshift(...resolvedParts);
        }
        break;
      } else {
        break;
      }
    }

    return parts.length > 0 ? parts : null;
  }

  parseExpression() {
    try {
      let expression = this.expression.trim();

      const [assignmentLHS, assignmentRHS] = this.parseAssignmentExpression(expression);

      expression = assignmentRHS || assignmentLHS || expression;

      const endsWithDot = expression.endsWith(".");
      if (endsWithDot) {
        expression = expression.slice(0, -1);
      }

      expression = this.normalizeExpression(expression);

      if (!expression) {
        return null;
      }

      const ast = acornLoose.parse(`(${expression})`, {
        ecmaVersion: "latest",
        sourceType: "script",
      });

      if (ast.body[0]?.type !== "ExpressionStatement") {
        return expression.split(".");
      }

      return this.extractPathFromComplexAST(ast.body[0].expression);
    } catch (error) {
      return this.expression.trim().split(".");
    }
  }

  private traverseTree(path: string[]) {
    let currentTree: RegistryTree | undefined = this.registryTree;

    for (const word of path) {
      const trimmedWord = word.trim().replace(/['"]/g, "");
      if (!trimmedWord) continue;

      currentTree = currentTree.children.get(trimmedWord);
      if (!currentTree) return null;
    }

    return currentTree;
  }

  getCompletionItems(currentWord: string) {
    const rootFunctionArgumentName = this.findRootFunctionArgumentName();
    if (!rootFunctionArgumentName) return [];

    this.registryTree.changeKeyAtLevel(0, REGISTRY_TREE_ROOT_NODE, rootFunctionArgumentName);

    const pathParts = this.parseExpression();

    if (!pathParts || pathParts.length === 0) {
      if (rootFunctionArgumentName.startsWith(currentWord) && currentWord.length > 0) {
        return [];
      }
      return [];
    }

    if (pathParts[0] !== rootFunctionArgumentName) {
      const mappedValue = this.variableMap.get(pathParts[0]);
      if (!mappedValue || !mappedValue.startsWith(rootFunctionArgumentName)) {
        return [];
      }
    }

    let pathToTraverse = pathParts;
    let filterWord = "";

    const endsWithDot = this.expression.trim().endsWith(".");

    if (endsWithDot) {
      pathToTraverse = pathParts;
      filterWord = "";
    } else if (pathParts.length > 0) {
      pathToTraverse = pathParts.slice(0, -1);
      filterWord = pathParts[pathParts.length - 1] || "";
    }

    const currentTree = this.traverseTree(pathToTraverse);
    if (!currentTree) {
      return [];
    }

    const completionItems = Array.from(currentTree.children.keys()).filter((key) =>
      key.startsWith(filterWord)
    );

    return completionItems;
  }
}
