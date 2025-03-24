import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";
import { RegistryNode, RegistryTree } from "../datastructures/registry-tree";

export class ConfigRegistry extends BaseRegistry {
  constructor(workspacePath: string) {
    super(workspacePath, "core-config");
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findControllerParameters(ast);
  }

  findRegistryTree(path: string, ast: acorn.Node) {
    const registryNodeMap = this.findControllerReturnNodeMap(ast);

    const configurationNameNode = registryNodeMap["configurationName"];
    const configurationName =
      configurationNameNode.type === "Literal"
        ? String(configurationNameNode.value)
        : null;
    if (!configurationName) return null;

    const tree = new RegistryTree();

    for (const name in registryNodeMap) {
      if (name === "configurationName") continue;

      const currentNode = registryNodeMap[name];
      const node: RegistryNode = {
        path,
        name,
        start: currentNode.start,
        end: currentNode.end,
        loc: currentNode.loc!,
      };

      tree.addNode([...this.basePath, configurationName, name], node);
    }

    return tree;
  }
}
