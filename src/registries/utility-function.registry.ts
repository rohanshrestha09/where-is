import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";

export class UtilityFunctionRegistry extends BaseRegistry {
  constructor(workspacePath: string) {
    super(workspacePath, "core-utility-functions");
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findControllerParameters(ast);
  }

  findRegistryNodeMap(path: string, ast: acorn.Node) {
    const registryNodeMap = this.findControllerReturnNodeMap(ast);

    const utilityFunctionNode = registryNodeMap["UtilityName"];

    const utilityFunctionName =
      utilityFunctionNode.type === "Literal"
        ? String(utilityFunctionNode.value)
        : null;
    if (!utilityFunctionName) return null;

    const registryNode: Record<any, any> = {
      [utilityFunctionName]: {},
    };

    for (const name in registryNodeMap) {
      if (name === "UtilityName") continue;

      const currentNode = registryNodeMap[name];
      registryNode[utilityFunctionName][name] = {
        path,
        name,
        start: currentNode.start,
        end: currentNode.end,
        loc: currentNode.loc,
      };
    }

    return registryNode;
  }
}
