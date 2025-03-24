import * as acorn from "acorn";
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
    const modelCallExpr = this.findModelCallExpression(ast);
    if (!modelCallExpr) return null;

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
      start: modelCallExpr.start,
      end: modelCallExpr.end,
      loc: modelCallExpr.loc!,
    };

    tree.addNode([...this.basePath, modelName], registryNode);
    return tree;
  }
}
