export class DirectedChainGraph {
  private adjacencyList: Map<string, string | null>;

  constructor() {
    this.adjacencyList = new Map();
  }

  // Add a vertex with a string label
  addVertex(vertex: string): void {
    if (!this.adjacencyList.has(vertex)) {
      this.adjacencyList.set(vertex, null); // Start with no outgoing edges
    }
  }

  // Add a directed edge from source to destination (ensures at most one outgoing edge per node)
  addEdge(source: string, destination: string): void {
    if (!this.adjacencyList.has(source)) {
      throw new Error(`Source vertex ${source} not found.`);
    }
    if (!this.adjacencyList.has(destination)) {
      throw new Error(`Destination vertex ${destination} not found.`);
    }

    // Ensure that the source node only points to one destination (no multiple outgoing edges)
    if (this.adjacencyList.get(source) !== null) {
      throw new Error(`Vertex ${source} can only point to one other node.`);
    }

    // Set the edge
    this.adjacencyList.set(source, destination);
  }

  // Check if vertex exists in this graph
  hasVertex(vertex: string): boolean {
    return this.adjacencyList.has(vertex);
  }

  // Get the destination of a vertex
  getDestination(vertex: string): string | null {
    return this.adjacencyList.get(vertex) ?? null;
  }

  // Get all vertices in this graph
  getVertices(): string[] {
    return Array.from(this.adjacencyList.keys());
  }

  followVertexPath(vertex: string): string[] {
    const path: string[] = [];
    let currentVertex: string | null = vertex;
    while (currentVertex !== null) {
      path.push(currentVertex);
      currentVertex = this.adjacencyList.get(currentVertex) ?? null;
    }
    return path;
  }
}

// /* 
//   assignmentmap = {
//     services => server.plugins["core-services"],
//     EldService => services.EldService,
//   }

//   expressions = ['EldService.checkEldPermission']
// */

// const graph = new DirectedChainGraph();
// graph.addVertex("checkEldPermission");
// graph.addVertex("EldService");
// graph.addEdge("checkEldPermission", "EldService");

// graph.addVertex("EldService");
// graph.addVertex("EldService");
// graph.addVertex("services");

// graph.addEdge("EldService", "services");
// try {
//   graph.addEdge("EldService", "EldService");
// } catch (err) {}

// graph.addVertex("services");
// graph.addVertex("plugins");
// graph.addVertex("core-services");
// graph.addVertex("server");
// graph.addEdge("core-services", "plugins");
// graph.addEdge("plugins", "server");
// graph.addEdge("services", 'core-services');

// console.log(graph.followVertexPath("checkEldPermission"));
// // output: [ "checkEldPermission", "EldService", "services", "core-controller", "plugins", "server" ]

