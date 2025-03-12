export class DirectedChainGraph {
  private adjacencyList: Map<string, string | null>;
  private name: string;
  private static nextId: number = 1;

  constructor() {
    this.adjacencyList = new Map();
    this.name = `graph_${DirectedChainGraph.nextId++}`;
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

  // Get the name of this graph
  getName(): string {
    return this.name;
  }
}

// New class to represent a graph as a node
class GraphNode {
  private graph: DirectedChainGraph;
  private nextGraph: GraphNode | null;

  constructor(graph: DirectedChainGraph) {
    this.graph = graph;
    this.nextGraph = null;
  }

  // Connect this graph node directly to another graph node
  connectTo(targetNode: GraphNode): void {
    // A graph can only connect to one other graph
    if (this.nextGraph !== null) {
      throw new Error(
        `Graph ${this.graph.getName()} is already connected to ${this.nextGraph
          .getGraph()
          .getName()}.`
      );
    }

    // Store the connection to the target graph
    this.nextGraph = targetNode;

    console.log(
      `Connected graph ${this.graph.getName()} directly to ${targetNode.graph.getName()}`
    );
  }

  // Get the graph
  getGraph(): DirectedChainGraph {
    return this.graph;
  }

  // Get the next connected graph node
  getNextGraph(): GraphNode | null {
    return this.nextGraph;
  }

  // Check if this node is connected to another node
  isConnectedTo(node: GraphNode): boolean {
    return this.nextGraph === node;
  }

  isConnected(): boolean {
    return this.nextGraph !== null;
  }

  // Disconnect from the next graph
  disconnect(): void {
    if (this.nextGraph) {
      console.log(
        `Disconnected graph ${this.graph.getName()} from ${this.nextGraph
          .getGraph()
          .getName()}`
      );
      this.nextGraph = null;
    }
  }
}

// GraphRegistry manages connections between independent graphs
export class GraphRegistry {
  private graphs: Map<string, DirectedChainGraph>;
  private graphNodes: Map<string, GraphNode>;
  private vertexToGraphMap: Map<string, Set<string>>;

  constructor() {
    this.graphs = new Map();
    this.graphNodes = new Map();
    this.vertexToGraphMap = new Map();
  }

  // Register a graph with the registry
  registerGraph(graph: DirectedChainGraph): GraphNode {
    const graphName = graph.getName();
    if (this.graphs.has(graphName)) {
      throw new Error(`Graph with name ${graphName} already exists.`);
    }

    this.graphs.set(graphName, graph);

    // Create a GraphNode for this graph
    const graphNode = new GraphNode(graph);
    this.graphNodes.set(graphName, graphNode);

    // Index all vertices in this graph for quick lookup
    for (const vertex of graph.getVertices()) {
      if (!this.vertexToGraphMap.has(vertex)) {
        this.vertexToGraphMap.set(vertex, new Set());
      }
      this.vertexToGraphMap.get(vertex)?.add(graphName);
    }

    return graphNode;
  }

  // Connect two graphs directly (a graph can only connect to one other graph)
  connectGraphs(
    sourceGraph: DirectedChainGraph,
    targetGraph: DirectedChainGraph
  ): void {
    const sourceGraphName = sourceGraph.getName();
    const targetGraphName = targetGraph.getName();

    const sourceNode = this.graphNodes.get(sourceGraphName);
    const targetNode = this.graphNodes.get(targetGraphName);

    if (!sourceNode) {
      throw new Error(`Source graph ${sourceGraphName} not found in registry.`);
    }

    if (!targetNode) {
      throw new Error(`Target graph ${targetGraphName} not found in registry.`);
    }

    // Check if the source graph is already connected to another graph
    if (sourceNode.getNextGraph() !== null) {
      // Disconnect from the current graph before connecting to a new one
      sourceNode.disconnect();
    }

    sourceNode.connectTo(targetNode);
  }

  // Get a graph node by name
  getGraphNode(graphName: string): GraphNode | undefined {
    return this.graphNodes.get(graphName);
  }

  // Find all graphs containing a specific vertex
  findGraphsWithVertex(vertex: string): string[] {
    const graphNames = this.vertexToGraphMap.get(vertex);
    return graphNames ? Array.from(graphNames) : [];
  }

  /**
   * Follow a path from a starting vertex through connected graphs
   * This method follows vertices within each graph and then moves to connected graphs
   *
   * @param startVertex The name of the vertex to start from
   * @param maxDepth Maximum depth to prevent infinite loops (default: 20)
   * @returns An array of vertex names representing the path from start to end
   */
  followVertexPath(startVertex: string, maxDepth: number = 20): string[] {
    // Find all graphs containing the start vertex
    const startGraphs = this.findGraphsWithVertex(startVertex);
    if (startGraphs.length === 0) {
      return []; // Start vertex not found in any graph
    }

    // Start with the first graph that contains the vertex
    const startGraphName = startGraphs[0];
    const startNode = this.graphNodes.get(startGraphName);
    if (!startNode) {
      return []; // Start graph node not found
    }

    // Initialize the path with the start vertex
    const path: string[] = [startVertex];

    // Keep track of visited graphs to prevent infinite loops
    const visitedGraphs = new Set<string>();
    visitedGraphs.add(startGraphName);

    let currentNode = startNode;
    let currentVertex = startVertex;
    let depth = 0;

    while (depth < maxDepth) {
      const currentGraph = currentNode.getGraph();

      // Follow the path within the current graph
      let nextVertex = currentVertex;
      let tempVertex: string | null;

      // Follow the chain of vertices in the current graph
      while ((tempVertex = currentGraph.getDestination(nextVertex)) !== null) {
        if (!path.includes(tempVertex)) {
          path.push(tempVertex);
        }
        nextVertex = tempVertex;
      }

      // Update the current vertex to the last one in the chain
      currentVertex = nextVertex;

      // Try to move to the next connected graph
      const nextNode = currentNode.getNextGraph();

      if (nextNode && !visitedGraphs.has(nextNode.getGraph().getName())) {
        // Move to the next graph
        const nextGraphName = nextNode.getGraph().getName();
        visitedGraphs.add(nextGraphName);
        currentNode = nextNode;

        // Find a starting vertex in the new graph
        const newGraph = nextNode.getGraph();
        const vertices = newGraph.getVertices();

        if (vertices.length > 0) {
          // Start with the first vertex in the new graph
          // should remove reverse
          const newVertex = vertices.reverse()[0];
          if (!path.includes(newVertex)) {
            path.push(newVertex);
          }
          currentVertex = newVertex;
        }
      } else {
        // No more unvisited connected graphs
        break;
      }

      depth++;
    }

    return path;
  }

  /**
   * Auto-connect a specific graph to other graphs based on shared vertices
   * This method finds all vertices in the specified graph and connects it to other graphs that share those vertices
   *
   * @param graph The graph to auto-connect
   * @returns The number of connections made
   */
  autoConnectGraph(graph: DirectedChainGraph): number {
    const graphName = graph.getName();

    const graphNode = this.graphNodes.get(graphName);

    if (graphNode?.isConnected()) {
      console.log(`Skipping since ${graphName} is already connected`);
      return 0;
    }

    const vertices = graph.getVertices();
    let connectionsCount = 0;

    // For each vertex in the graph
    for (const vertex of vertices) {
      // Find all graphs containing this vertex
      const graphsWithVertex = this.findGraphsWithVertex(vertex);

      // Skip if this is the only graph with this vertex
      if (graphsWithVertex.length <= 1) {
        continue;
      }

      // Find the index of the current graph in the list
      const currentGraphIndex = graphsWithVertex.indexOf(graphName);

      // If the current graph is not found in the list
      if (currentGraphIndex === -1) {
        return connectionsCount;
      }

      // Try to connect to the next graph in the list (if any)
      if (currentGraphIndex < graphsWithVertex.length - 1) {
        const nextGraphName = graphsWithVertex[currentGraphIndex + 1];
        const nextGraph = this.graphs.get(nextGraphName);

        if (nextGraph) {
          try {
            this.connectGraphs(graph, nextGraph);
            console.log(
              `Auto-connected graph ${graphName} to ${nextGraphName} via shared vertex "${vertex}"`
            );
            connectionsCount++;
            // Once we've made a connection, we can return
            return connectionsCount;
          } catch (error: any) {
            console.warn(
              `Could not connect graph ${graphName} to ${nextGraphName}: ${error.message}`
            );
          }
        }
      }

      // If we couldn't connect to the next graph, try the previous one
      if (currentGraphIndex > 0) {
        const prevGraphName = graphsWithVertex[currentGraphIndex - 1];
        const prevGraph = this.graphs.get(prevGraphName);

        if (prevGraph) {
          try {
            this.connectGraphs(graph, prevGraph);
            console.log(
              `Auto-connected graph ${graphName} to ${prevGraphName} via shared vertex "${vertex}"`
            );
            connectionsCount++;
            // Once we've made a connection, we can return
            return connectionsCount;
          } catch (error: any) {
            console.warn(
              `Could not connect graph ${graphName} to ${prevGraphName}: ${error.message}`
            );
          }
        }
      }
    }

    return connectionsCount;
  }

  autoConnectAllGraphs(): number {
    const graphs = Array.from(this.graphs.values());

    for (const graph of graphs) {
      this.autoConnectGraph(graph);
    }

    return graphs.length;
  }
}

// const assignmentHashMaps = new Map<string, string>();

// assignmentHashMaps.set("services", 'server.plugins["core-services"]');
// assignmentHashMaps.set("NiceEldService", "services.EldService");
// assignmentHashMaps.set("services.EldService", "services['EldService']");
// assignmentHashMaps.set("EldService", "services.EldService"); // Add alias for EldService

// assignmentHashMaps.set(
//   "EldController",
//   'server.plugins["core-controller"].EldController'
// );

// const additionalVertexes1 = "services.MongoService.getPopulatedDataAsync";
// const additionalVertexes2 = "NiceEldService.checkPermission";
// const additionalVertexes3 = "EldController.updateEldPermission";
// const additionalVertexes4 =
//   'server.plugins["core-controller"]["EldController"].updateEldPermission';

/*
const dependencyChain = "(getPopulatedDataAsync -> MongoService -> services) -> (services -> 
  server.plugins[\"core-services\"]) <- ((services.EldService -> services) <- NiceEldService) <- (NiceEldService <- 
  checkPermission)";
*/
