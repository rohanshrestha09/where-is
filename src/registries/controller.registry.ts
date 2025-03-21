import * as acorn from "acorn";
import { BaseRegistry } from "./base.registry";

export class ControllerRegistry extends BaseRegistry {
  constructor(workspacePath: string) {
    super(workspacePath, "core-controller");
  }

  findRegistryParameters(ast: acorn.Node) {
    return this.findControllerParameters(ast);
  }

  findRegistryNodeMap(path: string, ast: acorn.Node) {
    const registryNodeMap = this.findControllerReturnNodeMap(ast);

    const controllerNameNode = registryNodeMap["controllerName"];

    const controllerName =
      controllerNameNode.type === "Literal"
        ? String(controllerNameNode.value)
        : null;
    if (!controllerName) return null;

    const registryNode: Record<any, any> = {
      [controllerName]: {},
    };

    for (const name in registryNodeMap) {
      if (name === "controllerName") continue;

      const currentNode = registryNodeMap[name];
      registryNode[controllerName][name] = {
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
