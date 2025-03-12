import { DirectedChainGraph } from '../../datastructures/graph';
import { GraphRegistry } from '../../datastructures/graph';
import { describe, it } from 'mocha';
import * as assert from 'assert';

describe('Graph Registry', () => {
  describe('Service Graph Tests', () => {
    it('should correctly follow dependency path from getPopulatedDataAsync', () => {
      const servicesGraph1 = new DirectedChainGraph();
      servicesGraph1.addVertex("services");

      const servicesGraph2 = new DirectedChainGraph();
      servicesGraph2.addVertex("server");
      servicesGraph2.addVertex("plugins");
      servicesGraph2.addVertex("core-services");
      servicesGraph2.addEdge("core-services", "plugins");
      servicesGraph2.addEdge("plugins", "server");

      const registry = new GraphRegistry();
      const getPopulatedDataAsyncGraph = new DirectedChainGraph();
      getPopulatedDataAsyncGraph.addVertex("getPopulatedDataAsync");
      getPopulatedDataAsyncGraph.addVertex("MongoService");
      getPopulatedDataAsyncGraph.addVertex("services");
      getPopulatedDataAsyncGraph.addEdge("getPopulatedDataAsync", "MongoService");
      getPopulatedDataAsyncGraph.addEdge("MongoService", "services");

      registry.registerGraph(getPopulatedDataAsyncGraph);
      registry.registerGraph(servicesGraph1);
      registry.registerGraph(servicesGraph2);

      registry.connectGraphs(servicesGraph1, servicesGraph2);
      registry.autoConnectGraph(getPopulatedDataAsyncGraph);

      const paths = registry.followVertexPath("getPopulatedDataAsync");
      assert.deepStrictEqual(paths, [
        "getPopulatedDataAsync",
        "MongoService", 
        "services",
        "core-services",
        "plugins",
        "server"
      ]);
    });
  });

  describe('ELD Service Tests', () => {
    it('should correctly follow dependency path from checkEldPermission through NiceEldService', () => {
      const registry = new GraphRegistry();

      const servicesGraph1 = new DirectedChainGraph();
      servicesGraph1.addVertex("services");

      const servicesGraph2 = new DirectedChainGraph();
      servicesGraph2.addVertex("server");
      servicesGraph2.addVertex("plugins");
      servicesGraph2.addVertex("core-services");
      servicesGraph2.addEdge("core-services", "plugins");
      servicesGraph2.addEdge("plugins", "server");

      const checkEldPermissionGraph = new DirectedChainGraph();
      checkEldPermissionGraph.addVertex("NiceEldService");
      checkEldPermissionGraph.addVertex("checkEldPermission");
      checkEldPermissionGraph.addEdge("checkEldPermission", "NiceEldService");

      const eldServiceGraph1 = new DirectedChainGraph();
      eldServiceGraph1.addVertex("NiceEldService");

      const eldServiceGraph2 = new DirectedChainGraph();
      eldServiceGraph2.addVertex("services");
      eldServiceGraph2.addVertex("EldService");
      eldServiceGraph2.addEdge("EldService", "services");

      registry.registerGraph(servicesGraph1);
      registry.registerGraph(servicesGraph2);
      registry.registerGraph(eldServiceGraph1);
      registry.registerGraph(eldServiceGraph2);
      registry.registerGraph(checkEldPermissionGraph);

      registry.connectGraphs(servicesGraph1, servicesGraph2);
      registry.connectGraphs(eldServiceGraph1, eldServiceGraph2);
      registry.autoConnectGraph(eldServiceGraph2);
      registry.autoConnectGraph(checkEldPermissionGraph);

      const paths = registry.followVertexPath("checkEldPermission");
      assert.deepStrictEqual(paths, [
        "checkEldPermission",
        "NiceEldService",
        "EldService",
        "services",
        "core-services",
        "plugins",
        "server"
      ]);
    });

    it('should correctly follow dependency path from checkEldPermission through EldController', () => {
      const registry = new GraphRegistry();

      const controllerGraph1 = new DirectedChainGraph();
      controllerGraph1.addVertex("controllers");

      const controllerGraph2 = new DirectedChainGraph();
      controllerGraph2.addVertex("server");
      controllerGraph2.addVertex("plugins");
      controllerGraph2.addVertex("core-controller");
      controllerGraph2.addEdge("core-controller", "plugins");
      controllerGraph2.addEdge("plugins", "server");

      const checkEldPermissionGraph = new DirectedChainGraph();
      checkEldPermissionGraph.addVertex("EldController");
      checkEldPermissionGraph.addVertex("checkEldPermission");
      checkEldPermissionGraph.addEdge("checkEldPermission", "EldController");

      const eldControllerGraph1 = new DirectedChainGraph();
      eldControllerGraph1.addVertex("EldController");

      const eldControllerGraph2 = new DirectedChainGraph();
      eldControllerGraph2.addVertex("controllers");
      eldControllerGraph2.addVertex("EldController");
      eldControllerGraph2.addEdge("EldController", "controllers");

      registry.registerGraph(controllerGraph1);
      registry.registerGraph(controllerGraph2);
      registry.registerGraph(eldControllerGraph1);
      registry.registerGraph(eldControllerGraph2);
      registry.registerGraph(checkEldPermissionGraph);

      registry.connectGraphs(controllerGraph1, controllerGraph2);
      registry.connectGraphs(eldControllerGraph1, eldControllerGraph2);
      registry.autoConnectGraph(eldControllerGraph2);
      registry.autoConnectGraph(checkEldPermissionGraph);

      const paths = registry.followVertexPath("checkEldPermission");
      assert.deepStrictEqual(paths, [
        "checkEldPermission",
        "EldController",
        "controllers",
        "core-controller",
        "plugins",
        "server"
      ]);
    });
  });

  describe('Utility Function Tests', () => {
    it('should correctly follow dependency path from sendSuccess', () => {
      const registry = new GraphRegistry();

      const utilityGraph1 = new DirectedChainGraph();
      utilityGraph1.addVertex("utility");

      const utilityGraph2 = new DirectedChainGraph();
      utilityGraph2.addVertex("server");
      utilityGraph2.addVertex("plugins");
      utilityGraph2.addVertex("core-utility-functions");
      utilityGraph2.addEdge("core-utility-functions", "plugins");
      utilityGraph2.addEdge("plugins", "server");

      const utilityFunctionGraph1 = new DirectedChainGraph();
      utilityFunctionGraph1.addVertex("appUtilityFunctions");

      const utilityFunctionGraph2 = new DirectedChainGraph();
      utilityFunctionGraph2.addVertex("utility");
      utilityFunctionGraph2.addVertex("AppUtilityFunctions");
      utilityFunctionGraph2.addEdge("AppUtilityFunctions", "utility");

      const sendSuccessGraph = new DirectedChainGraph();
      sendSuccessGraph.addVertex("appUtilityFunctions");
      sendSuccessGraph.addVertex("sendSuccess");
      sendSuccessGraph.addEdge("sendSuccess", "appUtilityFunctions");

      registry.registerGraph(utilityGraph1);
      registry.registerGraph(utilityGraph2);
      registry.registerGraph(utilityFunctionGraph1);
      registry.registerGraph(utilityFunctionGraph2);
      registry.registerGraph(sendSuccessGraph);

      registry.connectGraphs(utilityGraph1, utilityGraph2);
      registry.connectGraphs(utilityFunctionGraph1, utilityFunctionGraph2);
      registry.autoConnectGraph(utilityFunctionGraph2);
      registry.autoConnectGraph(sendSuccessGraph);

      const paths = registry.followVertexPath("sendSuccess");
      assert.deepStrictEqual(paths, [
        "sendSuccess",
        "appUtilityFunctions",
        "AppUtilityFunctions",
        "utility",
        "core-utility-functions",
        "plugins",
        "server"
      ]);
    });
  });
});