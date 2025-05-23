import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";
import { RegistryNode, RegistryTree } from "../datastructures/registry-tree";

export class ServiceRegistry extends BaseRegistry {
  constructor(options: { workspacePath?: string; documentPath?: string }) {
    super("core-services", options);
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findControllerParameters(ast);
  }

  findRegistryTree(path: string, ast: acorn.Node) {
    const registryNodeMap = this.findControllerReturnNodeMap(ast);

    const serviceNameNode = registryNodeMap["serviceName"];
    const serviceName =
      serviceNameNode.type === "Literal" ? String(serviceNameNode.value) : null;
    if (!serviceName) return null;

    const tree = new RegistryTree();

    for (const name in registryNodeMap) {
      if (name === "serviceName") continue;

      const currentNode = registryNodeMap[name];
      const node: RegistryNode = {
        path,
        name,
        start: currentNode.start,
        end: currentNode.end,
        loc: currentNode.loc!,
      };

      const nodePath = [...this.basePath, serviceName, name];

      tree.addNode(nodePath, node);
    }

    return tree;
  }
}
