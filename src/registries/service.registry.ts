import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";

export class ServiceRegistry extends BaseRegistry {
  constructor(workspacePath: string) {
    super(workspacePath, "core-services");
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findControllerParameters(ast);
  }

  findRegistryNodeMap(path: string, ast: acorn.Node) {
    const registryNodeMap = this.findControllerReturnNodeMap(ast);

    const serviceNameNode = registryNodeMap["serviceName"];

    const serviceName =
      serviceNameNode.type === "Literal" ? String(serviceNameNode.value) : null;
    if (!serviceName) return null;

    const registryNode: Record<any, any> = {
      [serviceName]: {},
    };

    for (const name in registryNodeMap) {
      if (name === "serviceName") continue;

      const currentNode = registryNodeMap[name];
      registryNode[serviceName][name] = {
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
