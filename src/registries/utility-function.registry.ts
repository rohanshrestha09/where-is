import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";
import { RegistryNode, RegistryTree } from "../datastructures/registry-tree";

export class UtilityFunctionRegistry extends BaseRegistry {
  constructor(workspacePath: string) {
    super(workspacePath, "core-utility-functions");
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findControllerParameters(ast);
  }

  findRegistryTree(path: string, ast: acorn.Node) {
    const registryNodeMap = this.findControllerReturnNodeMap(ast);

    const utilityNode = registryNodeMap["UtilityName"];
    const utilityName =
      utilityNode.type === "Literal" ? String(utilityNode.value) : null;
    if (!utilityName) return null;

    const tree = new RegistryTree();

    for (const name in registryNodeMap) {
      if (name === "UtilityName") continue;

      const currentNode = registryNodeMap[name];
      const node: RegistryNode = {
        path,
        name,
        start: currentNode.start,
        end: currentNode.end,
        loc: currentNode.loc!,
      };

      tree.addNode([...this.basePath, utilityName, name], node);
    }

    return tree;
  }
}
