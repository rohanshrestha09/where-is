import { RegistryTree } from "../datastructures/registry-tree";
import { ConfigRegistry } from "../registries/config.registry";
import { ControllerRegistry } from "../registries/controller.registry";
import { ModelRegistry } from "../registries/model.registry";
import { ServiceRegistry } from "../registries/service.registry";
import { UtilityFunctionRegistry } from "../registries/utility-function.registry";

export class RegistryService {
  constructor(private readonly workspacePath: string) {}

  async generateRegistryTree() {
    const tree = new RegistryTree();

    const configRegistry = new ConfigRegistry(this.workspacePath);
    const configRegistryTree = await configRegistry.generateRegistryTree();

    const serviceRegistry = new ServiceRegistry(this.workspacePath);
    const serviceRegistryTree = await serviceRegistry.generateRegistryTree();

    const controllerRegistry = new ControllerRegistry(this.workspacePath);
    const controllerRegistryTree =
      await controllerRegistry.generateRegistryTree();

    const modelRegistry = new ModelRegistry(this.workspacePath);
    const modelRegistryTree = await modelRegistry.generateRegistryTree();

    const utilityFunctionRegistry = new UtilityFunctionRegistry(
      this.workspacePath
    );
    const utilityFunctionRegistryTree =
      await utilityFunctionRegistry.generateRegistryTree();

    for (const subTree of [
      configRegistryTree,
      serviceRegistryTree,
      controllerRegistryTree,
      modelRegistryTree,
      utilityFunctionRegistryTree,
    ]) {
      tree.merge(subTree);
    }

    return tree;
  }
}
