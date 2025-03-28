/**
 * Represents a directed graph data structure where vertices are connected by directed edges.
 * Each vertex can have multiple outgoing and incoming edges.
 */
export class DirectedGraph {
  private vertices: Map<string, Set<string>>;
  private incomingEdges: Map<string, Set<string>>;

  /**
   * Initializes a new instance of the DirectedGraph class.
   * Creates empty maps for storing vertices and their edges.
   */
  constructor() {
    this.vertices = new Map();
    this.incomingEdges = new Map();
  }

  /**
   * Adds a new vertex to the graph if it doesn't already exist.
   * @param vertex - The unique identifier for the vertex to add
   */
  addVertex(vertex: string): void {
    if (!this.vertices.has(vertex)) {
      this.vertices.set(vertex, new Set());
      this.incomingEdges.set(vertex, new Set());
    }
  }

  /**
   * Creates a directed edge from the source vertex to the target vertex.
   * If either vertex doesn't exist, they will be created automatically.
   * @param source - The vertex where the edge starts
   * @param target - The vertex where the edge ends
   */
  addEdge(source: string, target: string): void {
    this.addVertex(source);
    this.addVertex(target);

    this.vertices.get(source)!.add(target);
    this.incomingEdges.get(target)!.add(source);
  }

  /**
   * Removes a vertex and all its associated edges (both incoming and outgoing) from the graph.
   * If the vertex doesn't exist, the operation is ignored.
   * @param vertex - The vertex to remove from the graph
   */
  removeVertex(vertex: string): void {
    if (!this.vertices.has(vertex)) return;

    // Remove all outgoing edges
    const outgoing = this.vertices.get(vertex)!;
    for (const target of outgoing) {
      this.incomingEdges.get(target)!.delete(vertex);
    }

    // Remove all incoming edges
    const incoming = this.incomingEdges.get(vertex)!;
    for (const source of incoming) {
      this.vertices.get(source)!.delete(vertex);
    }

    // Remove the vertex itself
    this.vertices.delete(vertex);
    this.incomingEdges.delete(vertex);
  }

  /**
   * Removes a directed edge between two vertices.
   * If either vertex doesn't exist, the operation is ignored.
   * @param source - The starting vertex of the edge
   * @param target - The ending vertex of the edge
   */
  removeEdge(source: string, target: string): void {
    if (!this.vertices.has(source) || !this.vertices.has(target)) return;

    this.vertices.get(source)!.delete(target);
    this.incomingEdges.get(target)!.delete(source);
  }

  /**
   * Returns an array of vertices that the specified vertex has edges pointing to.
   * @param vertex - The vertex to get outgoing edges from
   * @returns An array of vertex identifiers that are destinations of edges from the specified vertex
   */
  getOutgoingEdges(vertex: string): string[] {
    return Array.from(this.vertices.get(vertex) || new Set());
  }

  /**
   * Returns an array of vertices that have edges pointing to the specified vertex.
   * @param vertex - The vertex to get incoming edges to
   * @returns An array of vertex identifiers that have edges pointing to the specified vertex
   */
  getIncomingEdges(vertex: string): string[] {
    return Array.from(this.incomingEdges.get(vertex) || new Set());
  }

  /**
   * Returns an array of all vertices in the graph.
   * @returns An array containing all vertex identifiers in the graph
   */
  getAllVertices(): string[] {
    return Array.from(this.vertices.keys());
  }

  /**
   * Determines if there exists a path from the source vertex to the target vertex.
   * Uses breadth-first search (BFS) algorithm.
   * @param source - The starting vertex
   * @param target - The destination vertex
   * @returns True if a path exists, false otherwise
   */
  hasPath(source: string, target: string): boolean {
    if (!this.vertices.has(source) || !this.vertices.has(target)) return false;

    const visited = new Set<string>();
    const queue: string[] = [source];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === target) return true;

      if (!visited.has(current)) {
        visited.add(current);
        queue.push(...this.getOutgoingEdges(current));
      }
    }

    return false;
  }

  /**
   * Finds all possible paths from the source vertex to the target vertex.
   * Uses depth-first search (DFS) with backtracking.
   * @param source - The starting vertex
   * @param target - The destination vertex
   * @returns An array of arrays, where each inner array represents a path from source to target
   */
  findAllPaths(source: string, target: string): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: string[]) => {
      if (current === target) {
        paths.push([...path]);
        return;
      }

      for (const next of this.getOutgoingEdges(current)) {
        if (!visited.has(next)) {
          visited.add(next);
          path.push(next);
          dfs(next, path);
          path.pop();
          visited.delete(next);
        }
      }
    };

    visited.add(source);
    dfs(source, [source]);
    return paths;
  }

  /**
   * Finds all connected components in the graph, considering both incoming and outgoing edges.
   * Uses breadth-first search (BFS) algorithm.
   * @returns An array of arrays, where each inner array represents a connected component
   */
  getConnectedComponents(): string[][] {
    const visited = new Set<string>();
    const components: string[][] = [];

    for (const vertex of this.getAllVertices()) {
      if (!visited.has(vertex)) {
        const component: string[] = [];
        const queue = [vertex];

        while (queue.length > 0) {
          const current = queue.shift()!;
          if (!visited.has(current)) {
            visited.add(current);
            component.push(current);

            queue.push(
              ...this.getOutgoingEdges(current),
              ...this.getIncomingEdges(current)
            );
          }
        }

        components.push(component);
      }
    }

    return components;
  }

  /**
   * Creates a deep copy of the current graph.
   * @returns A new DirectedGraph instance with the same vertices and edges
   */
  clone(): DirectedGraph {
    const newGraph = new DirectedGraph();

    for (const [vertex, edges] of this.vertices) {
      newGraph.addVertex(vertex);
      for (const edge of edges) {
        newGraph.addEdge(vertex, edge);
      }
    }

    return newGraph;
  }

  /**
   * Finds all possible paths from the source vertex to the target vertex through a specific vertex.
   * Uses depth-first search (DFS) with backtracking.
   * @param source - The starting vertex
   * @param through - The vertex that must be in the path
   * @param target - The destination vertex
   * @returns An array of arrays, where each inner array represents a path from source through the specified vertex to target
   */
  findAllPathsThrough(
    source: string,
    through: string,
    target: string
  ): string[][] {
    const paths: string[][] = [];
    const visited = new Set<string>();

    const dfs = (current: string, path: string[]) => {
      if (current === target) {
        if (path.includes(through)) {
          paths.push([...path]);
        }
        return;
      }

      for (const nextVertex of this.getOutgoingEdges(current)) {
        if (!visited.has(nextVertex)) {
          visited.add(nextVertex);
          path.push(nextVertex);
          dfs(nextVertex, path);
          path.pop();
          visited.delete(nextVertex);
        }
      }
    };

    visited.add(source);
    dfs(source, [source]);
    return paths;
  }
}
