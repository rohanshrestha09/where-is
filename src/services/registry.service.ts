import path from "path";
import { RegistryTree } from "../datastructures/registry-tree";
import { ConfigRegistry } from "../registries/config.registry";
import { ControllerRegistry } from "../registries/controller.registry";
import { ModelRegistry } from "../registries/model.registry";
import { ServiceRegistry } from "../registries/service.registry";
import { UtilityFunctionRegistry } from "../registries/utility-function.registry";

export class RegistryService {
  private readonly registryOrder = [
    ConfigRegistry,
    ServiceRegistry,
    ControllerRegistry,
    ModelRegistry,
    UtilityFunctionRegistry,
  ];

  private readonly registryMap = new Map([
    ["config", ConfigRegistry],
    ["service", ServiceRegistry],
    ["controller", ControllerRegistry],
    ["model", ModelRegistry],
    ["function", UtilityFunctionRegistry],
  ]);

  async generatePartialRegistryTree(documentPath: string) {
    const filename = path.parse(documentPath).name;

    const Registry =
      Object.entries(this.registryMap).find(([suffix]) =>
        filename.endsWith(suffix)
      )?.[1] ?? null;
    if (!Registry) return null;

    const registry = new Registry({ documentPath });
    const registryTree = await registry.generateRegistryTree();
    return registryTree;
  }

  async generateCompleteRegistryTree(workspacePath: string) {
    const tree = new RegistryTree();

    const registryTrees = await Promise.all(
      this.registryOrder.map(async (Registry) => {
        const registry = new Registry({ workspacePath });
        return registry.generateRegistryTree();
      })
    );

    registryTrees.forEach((subTree) => tree.merge(subTree));
    return tree;
  }
}
