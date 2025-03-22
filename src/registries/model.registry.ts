import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { BaseRegistry } from "./base.registry";
import { RegistryNode, RegistryTree } from "../datastructures/registry-tree";

export class ModelRegistry extends BaseRegistry {
  constructor(workspacePath: string) {
    super(workspacePath, "core-models");
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findModelParameters(ast);
  }

  findRegistryTree(path: string, ast: acorn.Node) {
    const node = this.findModelReturnStatement(ast);
    if (!node?.argument) return null;

    let modelCallExpr: acorn.CallExpression | null = null;

    if (node.argument.type === "CallExpression") {
      modelCallExpr = node.argument;
    } else if (node.argument.type === "Identifier") {
      const variableName = node.argument.name;
      let foundCall: acorn.CallExpression | null = null;
      acornWalk.simple(ast, {
        VariableDeclarator: (declNode: acorn.VariableDeclarator) => {
          if (
            declNode.id.type === "Identifier" &&
            declNode.id.name === variableName &&
            declNode.init?.type === "CallExpression"
          ) {
            foundCall = declNode.init;
          }
        },
      });
      modelCallExpr = foundCall;
    }

    if (
      !modelCallExpr ||
      modelCallExpr.callee.type !== "MemberExpression" ||
      modelCallExpr.callee.object.type !== "Identifier" ||
      modelCallExpr.callee.property.type !== "Identifier" ||
      (modelCallExpr.callee.property.name !== "model" &&
        modelCallExpr.callee.property.name !== "define") ||
      !modelCallExpr.arguments[0] ||
      modelCallExpr.arguments[0].type !== "Literal"
    )
      return null;

    const modelName = String(modelCallExpr.arguments[0].value);
    const tree = new RegistryTree();

    const registryNode: RegistryNode = {
      path,
      name: modelName,
      start: node.start,
      end: node.end,
      loc: node.loc,
    };

    tree.addNode([...this.basePath, modelName], registryNode);
    return tree;
  }
}
