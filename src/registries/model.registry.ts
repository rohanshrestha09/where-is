import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";

export class ModelRegistry extends BaseRegistry {
  constructor(workspacePath: string) {
    super(workspacePath, "core-models");
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findModelParameters(ast);
  }

  findRegistryNodeMap(path: string, ast: acorn.Node) {
    const node = this.findModelReturnStatement(ast);
    if (!node?.argument || node.argument.type !== "CallExpression") return null;

    const callExpr = node.argument;
    if (
      callExpr.callee.type !== "MemberExpression" ||
      callExpr.callee.object.type !== "Identifier" ||
      callExpr.callee.object.name !== "mongoose" ||
      callExpr.callee.property.type !== "Identifier" ||
      callExpr.callee.property.name !== "model" ||
      !callExpr.arguments[0] ||
      callExpr.arguments[0].type !== "Literal"
    )
      return null;

    const modelName = String(callExpr.arguments[0].value);

    return {
      [modelName]: {
        path,
        name: modelName,
        start: node.start,
        end: node.end,
        loc: node.loc,
      },
    };
  }
}
