import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { ExtraUtil } from "../utils/extra.util";
import { FileUtil } from "../utils/file.util";
import { RegistryTree } from "../datastructures/registry-tree";

export abstract class BaseRegistry {
  constructor(
    private readonly workspacePath: string,
    private readonly pluginName: string
  ) {}

  protected get basePath() {
    return ["server", "plugins", this.pluginName];
  }

  private isControllerAssignment(node: acorn.AssignmentExpression) {
    return (
      node.left.type === "MemberExpression" &&
      node.left.object.type === "Identifier" &&
      node.left.object.name === "internals" &&
      node.left.property.type === "Identifier" &&
      node.left.property.name === "controller"
    );
  }

  private isModelAssignment(node: acorn.AssignmentExpression) {
    return (
      node.left.type === "MemberExpression" &&
      node.left.object.type === "Identifier" &&
      node.left.object.name === "internals" &&
      node.left.property.type === "Identifier" &&
      node.left.property.name === "Model"
    );
  }

  private isInternalsFunction(
    node: acorn.Expression
  ): node is acorn.ArrowFunctionExpression | acorn.FunctionExpression {
    return (
      (node.type === "ArrowFunctionExpression" ||
        node.type === "FunctionExpression") &&
      node.params.length > 0 &&
      node.params[0].type === "Identifier"
    );
  }

  private extractBlockStatement(
    node: acorn.ArrowFunctionExpression | acorn.FunctionExpression
  ) {
    return node.body.type === "BlockStatement" ? node.body : null;
  }

  private createPropertyNodeMap(node: acorn.ObjectExpression) {
    const objectProperty: Record<string, acorn.AnyNode> = {};

    if (!node.properties) return objectProperty;

    for (const prop of node.properties) {
      if (prop.type !== "Property") continue;

      const key =
        prop.key.type === "Identifier"
          ? prop.key.name
          : prop.key.type === "Literal"
          ? String(prop.key.value)
          : null;
      if (!key) continue;

      objectProperty[key] = prop.value;
    }

    return objectProperty;
  }

  private getVariablePropertyMap(
    functionBody: acorn.BlockStatement,
    variableName: string
  ) {
    let property: Record<string, acorn.AnyNode> = {};
    acornWalk.simple(functionBody, {
      VariableDeclarator: (declNode: acorn.VariableDeclarator) => {
        if (
          declNode.id.type === "Identifier" &&
          declNode.id.name === variableName &&
          declNode.init?.type === "ObjectExpression"
        ) {
          property = this.createPropertyNodeMap(declNode.init);
        }
      },
    });
    return property;
  }

  private resolveSpreadElement(
    prop: acorn.SpreadElement,
    functionBody: acorn.BlockStatement
  ) {
    if (prop.argument.type !== "Identifier") return {};
    return this.getVariablePropertyMap(functionBody, prop.argument.name);
  }

  private mergePropertyNodes(
    properties: (acorn.Property | acorn.SpreadElement)[],
    functionBody: acorn.BlockStatement
  ) {
    let allProperty: Record<string, acorn.Node> = {};

    for (const prop of properties) {
      if (prop.type === "SpreadElement") {
        allProperty = Object.assign(
          allProperty,
          this.resolveSpreadElement(prop, functionBody)
        );
      } else if (prop.type === "Property") {
        const props = this.createPropertyNodeMap({
          type: "ObjectExpression",
          properties: [prop],
          start: prop.start,
          end: prop.end,
        });
        allProperty = Object.assign(allProperty, props);
      }
    }

    return allProperty;
  }

  private findReturnStatement(body: acorn.BlockStatement) {
    return body.body.find(
      (n): n is acorn.ReturnStatement => n.type === "ReturnStatement"
    );
  }

  protected findModelParameters(ast: acorn.Node) {
    let argumentNames: string[] = [];
    try {
      acornWalk.simple(ast, {
        AssignmentExpression: (node: acorn.AssignmentExpression) => {
          if (
            this.isModelAssignment(node) &&
            this.isInternalsFunction(node.right) &&
            node.right.params[0].type === "Identifier"
          ) {
            argumentNames.push(node.right.params[0].name);
          }
        },
      });
      return argumentNames;
    } catch (error) {
      return [];
    }
  }

  protected findControllerParameters(ast: acorn.Node) {
    let argumentNames: string[] = [];
    try {
      acornWalk.simple(ast, {
        AssignmentExpression: (node: acorn.AssignmentExpression) => {
          if (
            this.isControllerAssignment(node) &&
            this.isInternalsFunction(node.right) &&
            node.right.params[0].type === "Identifier"
          ) {
            argumentNames.push(node.right.params[0].name);
          }
        },
      });
      return argumentNames;
    } catch (error) {
      return [];
    }
  }

  protected findControllerReturnNodeMap(ast: acorn.Node) {
    let returnObjectProperty: Record<string, acorn.AnyNode> = {};

    try {
      acornWalk.simple(ast, {
        AssignmentExpression: (node: acorn.AssignmentExpression) => {
          if (!this.isControllerAssignment(node)) return;
          if (!this.isInternalsFunction(node.right)) return;

          if (node.right.body.type === "ObjectExpression") {
            returnObjectProperty = this.createPropertyNodeMap(node.right.body);
            return;
          }

          const functionBody = this.extractBlockStatement(node.right);
          if (!functionBody) return;

          const returnStatement = this.findReturnStatement(functionBody);
          if (!returnStatement?.argument) return;

          if (returnStatement.argument.type === "ObjectExpression") {
            returnObjectProperty = this.createPropertyNodeMap(
              returnStatement.argument
            );
            returnObjectProperty = Object.assign(
              returnObjectProperty,
              this.mergePropertyNodes(
                returnStatement.argument.properties,
                functionBody
              )
            );
          } else if (returnStatement.argument.type === "Identifier") {
            returnObjectProperty = this.getVariablePropertyMap(
              functionBody,
              returnStatement.argument.name
            );
          }
        },
      });

      return returnObjectProperty;
    } catch (error) {
      return {};
    }
  }

  protected findModelReturnStatement(ast: acorn.Node) {
    let returnNode: acorn.ReturnStatement | null = null;

    try {
      acornWalk.simple(ast, {
        AssignmentExpression: (node: acorn.AssignmentExpression) => {
          if (!this.isModelAssignment(node)) return;
          if (!this.isInternalsFunction(node.right)) return;

          const functionBody = this.extractBlockStatement(node.right);
          if (!functionBody) return;

          const returnStatement = this.findReturnStatement(functionBody);
          if (returnStatement) returnNode = returnStatement;
        },
      });

      return returnNode as acorn.ReturnStatement | null;
    } catch (error) {
      return null;
    }
  }

  protected abstract findRegistryTree(
    path: string,
    ast: acorn.Node
  ): RegistryTree | null;

  protected abstract findRegistryParameters(ast: acorn.Node): string[];

  async generateRegistryTree() {
    const mainTree = new RegistryTree();

    const pattern = `**/*-${ExtraUtil.getGlobPathReference(
      this.pluginName
    )}.js`;
    const filePaths = await FileUtil.findFilesByPattern(pattern, {
      cwd: this.workspacePath,
    });

    for (const path of filePaths) {
      const content = await FileUtil.readFile(path);
      if (!content) continue;

      const ast = acorn.parse(content, {
        ecmaVersion: "latest",
        sourceType: "module",
        locations: true,
      });

      const registryParameters = this.findRegistryParameters(ast);
      if (!registryParameters.length) continue;

      const subTree = this.findRegistryTree(path, ast);
      if (!subTree) continue;

      mainTree.merge(subTree);
    }

    return mainTree;
  }
}
