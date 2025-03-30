import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { FileUtil } from "../utils/file.util";
import { ExtraUtil } from "../utils/extra.util";
import { RegistryTree } from "../datastructures/registry-tree";
import {
  REGISTRY_TREE_PLUGIN_NODE,
  REGISTRY_TREE_ROOT_NODE,
} from "../constants";

export abstract class BaseRegistry {
  constructor(
    private readonly pluginName: string,
    private readonly options: {
      workspacePath?: string;
      documentPath?: string;
    }
  ) {}

  protected get basePath() {
    return [
      REGISTRY_TREE_ROOT_NODE,
      REGISTRY_TREE_PLUGIN_NODE,
      this.pluginName,
    ];
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
    const property: Record<string, acorn.AnyNode> = {};
    acornWalk.simple(functionBody, {
      VariableDeclarator: (declNode: acorn.VariableDeclarator) => {
        if (
          declNode.id.type === "Identifier" &&
          declNode.id.name === variableName &&
          declNode.init?.type === "ObjectExpression"
        ) {
          Object.assign(property, this.createPropertyNodeMap(declNode.init));
        }
      },
    });
    return property;
  }

  private findReturnStatement(body: acorn.BlockStatement) {
    return body.body.find(
      (n): n is acorn.ReturnStatement => n.type === "ReturnStatement"
    );
  }

  protected findModelParameters(ast: acorn.Node) {
    const argumentNames: string[] = [];
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
    const argumentNames: string[] = [];
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

  private collectFunctionDefinitions(ast: acorn.Node) {
    const functionDefinitions: Record<string, acorn.AnyNode> = {};

    acornWalk.simple(ast, {
      FunctionDeclaration: (
        node: acorn.FunctionDeclaration | acorn.AnonymousFunctionDeclaration
      ) => {
        if (node.id?.type === "Identifier") {
          functionDefinitions[node.id.name] = node;
        }
      },
      VariableDeclarator: (node: acorn.VariableDeclarator) => {
        if (
          node.id.type === "Identifier" &&
          (node.init?.type === "FunctionExpression" ||
            node.init?.type === "ArrowFunctionExpression")
        ) {
          functionDefinitions[node.id.name] = node;
        }
      },
    });

    return functionDefinitions;
  }

  private processObjectProperties(
    properties: acorn.Property[],
    functionDefinitions: Record<string, acorn.AnyNode>
  ) {
    const returnObjectProperty: Record<string, acorn.AnyNode> = {};

    for (const prop of properties) {
      const key =
        prop.key.type === "Identifier"
          ? prop.key.name
          : prop.key.type === "Literal"
          ? String(prop.key.value)
          : null;

      if (!key) continue;

      if (prop.shorthand && functionDefinitions[key]) {
        returnObjectProperty[key] = functionDefinitions[key];
      } else {
        returnObjectProperty[key] = prop.value;
      }
    }

    return returnObjectProperty;
  }

  private processSpreadElements(
    properties: acorn.SpreadElement[],
    functionBody: acorn.BlockStatement
  ) {
    const returnObjectProperty: Record<string, acorn.AnyNode> = {};

    for (const prop of properties) {
      if (prop.argument.type !== "Identifier") continue;
      const spreadProps = this.getVariablePropertyMap(
        functionBody,
        prop.argument.name
      );
      Object.assign(returnObjectProperty, spreadProps);
    }

    return returnObjectProperty;
  }

  protected findControllerReturnNodeMap(ast: acorn.Node) {
    try {
      const functionDefinitions = this.collectFunctionDefinitions(ast);
      const returnObjectProperty: Record<string, acorn.AnyNode> = {};

      acornWalk.simple(ast, {
        AssignmentExpression: (node: acorn.AssignmentExpression) => {
          if (!this.isControllerAssignment(node)) return;
          if (!this.isInternalsFunction(node.right)) return;

          if (node.right.body.type === "ObjectExpression") {
            Object.assign(
              returnObjectProperty,
              this.processObjectProperties(
                node.right.body.properties.filter(
                  (prop) => prop.type === "Property"
                ),
                functionDefinitions
              )
            );
            return;
          }

          const functionBody = this.extractBlockStatement(node.right);
          if (!functionBody) return;

          const returnStatement = this.findReturnStatement(functionBody);
          if (!returnStatement?.argument) return;

          if (returnStatement.argument.type === "ObjectExpression") {
            Object.assign(
              returnObjectProperty,
              this.processObjectProperties(
                returnStatement.argument.properties.filter(
                  (prop) => prop.type === "Property"
                ),
                functionDefinitions
              )
            );
            Object.assign(
              returnObjectProperty,
              this.processSpreadElements(
                returnStatement.argument.properties.filter(
                  (prop) => prop.type === "SpreadElement"
                ),
                functionBody
              )
            );
          } else if (returnStatement.argument.type === "Identifier") {
            Object.assign(
              returnObjectProperty,
              this.getVariablePropertyMap(
                functionBody,
                returnStatement.argument.name
              )
            );
          }
        },
      });

      return returnObjectProperty;
    } catch (error) {
      return {};
    }
  }

  protected findModelCallExpression(
    ast: acorn.Node
  ): acorn.CallExpression | null {
    let modelCallExpr: acorn.CallExpression | null = null;
    let variableName: string | null = null;

    acornWalk.simple(ast, {
      AssignmentExpression: (node: acorn.AssignmentExpression) => {
        if (!this.isModelAssignment(node)) return;
        if (!this.isInternalsFunction(node.right)) return;

        const functionBody = this.extractBlockStatement(node.right);
        if (!functionBody) return;

        const returnStatement = this.findReturnStatement(functionBody);
        if (!returnStatement?.argument) return;

        if (returnStatement.argument.type === "CallExpression") {
          modelCallExpr = returnStatement.argument;
        } else if (returnStatement.argument.type === "Identifier") {
          variableName = returnStatement.argument.name;
        }
      },
      VariableDeclarator: (node: acorn.VariableDeclarator) => {
        if (!variableName) return;
        if (
          node.id.type === "Identifier" &&
          node.id.name === variableName &&
          node.init?.type === "CallExpression"
        ) {
          modelCallExpr = node.init;
        }
      },
    });

    return modelCallExpr;
  }

  protected abstract findRegistryTree(
    path: string,
    ast: acorn.Node
  ): RegistryTree | null;

  protected abstract findRegistryParameters(ast: acorn.Node): string[];

  async findFilePaths() {
    if (!this.options.workspacePath && !this.options.documentPath) return [];

    if (this.options.documentPath) return [this.options.documentPath];

    const pattern = `**/*-${ExtraUtil.getGlobPathReference(
      this.pluginName
    )}.js`;

    const filePaths = await FileUtil.findFilesByPattern(pattern, {
      cwd: this.options.workspacePath,
    });

    return filePaths;
  }

  async generateRegistryTree() {
    const mainTree = new RegistryTree();

    const filePaths = await this.findFilePaths();

    for (const path of filePaths) {
      const content = await FileUtil.readFile(path);
      if (!content) continue;

      const ast = acorn.parse(content, {
        ecmaVersion: "latest",
        sourceType: "module",
        locations: true,
        ranges: false,
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
