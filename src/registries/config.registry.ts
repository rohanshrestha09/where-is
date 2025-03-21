import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";

export class ConfigRegistry extends BaseRegistry {
  constructor(workspacePath: string) {
    super(workspacePath, "core-config");
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findControllerParameters(ast);
  }

  findRegistryNodeMap(path: string, ast: acorn.Node) {
    const registryNodeMap = this.findControllerReturnNodeMap(ast);

    const configurationNameNode = registryNodeMap["configurationName"];

    const configurationName =
      configurationNameNode.type === "Literal"
        ? String(configurationNameNode.value)
        : null;
    if (!configurationName) return null;

    const registryNode: Record<any, any> = {
      [configurationName]: {},
    };

    for (const name in registryNodeMap) {
      if (name === "configurationName") continue;

      const currentNode = registryNodeMap[name];
      registryNode[configurationName][name] = {
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
