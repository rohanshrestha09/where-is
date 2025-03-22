/**
 * Represents a node in the registry tree containing location and metadata information
 */
export type RegistryNode = {
  path: string;
  name: string;
  start: number;
  end: number;
  loc?: {
    start: {
      line: number;
      column: number;
    };
    end: {
      line: number;
      column: number;
    };
  } | null;
};

/**
 * A tree data structure for managing registry nodes
 * Supports hierarchical organization of nodes with path-based access
 */
export class RegistryTree {
  private readonly __type__: "branch" | "leaf";
  private readonly children: Map<string, RegistryTree> = new Map();

  /**
   * Creates a new RegistryTree instance
   * @param node - Optional node data for leaf nodes
   */
  constructor(private readonly node?: RegistryNode) {
    this.__type__ = node ? "leaf" : "branch";
  }

  /**
   * Adds a node to the tree at the specified path
   * @param path - Array of strings representing the path to the node
   * @param node - The registry node to add
   * @throws Error if path is empty
   */
  addNode(path: string[], node: RegistryNode): void {
    if (path.length === 0) {
      throw new Error("Path cannot be empty");
    }

    const [current, ...rest] = path;

    if (rest.length === 0) {
      this.children.set(current, new RegistryTree(node));
      return;
    }

    if (!this.children.has(current)) {
      this.children.set(current, new RegistryTree());
    }

    this.children.get(current)!.addNode(rest, node);
  }

  /**
   * Retrieves a node from the tree at the specified path
   * @param path - Array of strings representing the path to the node
   * @returns The registry node if found, undefined otherwise
   */
  getNode(path: string[]): RegistryNode | undefined {
    if (path.length === 0) {
      return this.node;
    }

    const [current, ...rest] = path;
    const child = this.children.get(current);

    return child?.getNode(rest);
  }

  /**
   * Merges another registry tree into this one
   * @param other - The registry tree to merge
   */
  merge(other: RegistryTree): void {
    other.children.forEach((childTree, key) => {
      if (!this.children.has(key)) {
        this.children.set(key, childTree);
      } else {
        this.children.get(key)!.merge(childTree);
      }
    });
  }

  /**
   * Converts the tree to a JSON-serializable object
   * @returns A plain object representation of the tree
   */
  toJSON(): any {
    if (this.__type__ === "leaf") {
      return {
        __type__: "leaf",
        ...this.node,
      };
    }

    const result: Record<string, any> = {
      __type__: "branch",
    };

    this.children.forEach((child, key) => {
      result[key] = child.toJSON();
    });

    return result;
  }

  /**
   * Creates a RegistryTree instance from a JSON object
   * @param json - The JSON object to convert
   * @returns A new RegistryTree instance
   */
  static fromJSON(json: any): RegistryTree {
    if (json.__type__ === "leaf") {
      const { __type__, ...node } = json;
      return new RegistryTree(node);
    }

    const tree = new RegistryTree();
    Object.entries(json).forEach(([key, value]) => {
      if (key !== "__type__") {
        tree.children.set(key, RegistryTree.fromJSON(value));
      }
    });

    return tree;
  }
}
