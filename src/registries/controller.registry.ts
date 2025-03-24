import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";
import { RegistryNode, RegistryTree } from "../datastructures/registry-tree";

export class ControllerRegistry extends BaseRegistry {
  constructor(workspacePath: string) {
    super(workspacePath, "core-controller");
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findControllerParameters(ast);
  }

  findRegistryTree(path: string, ast: acorn.Node) {
    const registryNodeMap = this.findControllerReturnNodeMap(ast);

    const controllerNameNode = registryNodeMap["controllerName"];
    const controllerName =
      controllerNameNode.type === "Literal"
        ? String(controllerNameNode.value)
        : null;
    if (!controllerName) return null;

    const tree = new RegistryTree();

    for (const name in registryNodeMap) {
      if (name === "controllerName") continue;

      const currentNode = registryNodeMap[name];
      const node: RegistryNode = {
        path,
        name,
        start: currentNode.start,
        end: currentNode.end,
        loc: currentNode.loc!,
      };

      tree.addNode([...this.basePath, controllerName, name], node);
    }

    return tree;
  }
}
