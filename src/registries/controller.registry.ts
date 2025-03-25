import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";
import { RegistryNode, RegistryTree } from "../datastructures/registry-tree";

export class ControllerRegistry extends BaseRegistry {
  constructor(options: { workspacePath?: string; documentPath?: string }) {
    super("core-controller", options);
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

      const nodePath = [...this.basePath, controllerName, name];

      tree.addNode(nodePath, node);
    }

    return tree;
  }
}
