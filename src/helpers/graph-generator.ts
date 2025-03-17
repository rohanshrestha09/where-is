import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { DirectedChainGraph } from "../datastructures/graph";

export class GraphGenerator {
  private readonly graph: DirectedChainGraph;

  constructor(
    private readonly assignments: Map<string, string>,
    private readonly expressions: string[]
  ) {
    this.graph = new DirectedChainGraph();
  }

  private extractPathFromNode(node: acorn.AnyNode): string[] {
    const parts: string[] = [];

    if (node.type === "MemberExpression") {
      // Handle nested member expressions recursively
      if (node.object.type === "MemberExpression") {
        parts.push(...this.extractPathFromNode(node.object));
      } else if (node.object.type === "Identifier") {
        parts.push(node.object.name);
      }

      // Handle property access
      if (node.property.type === "Identifier") {
        parts.push(node.property.name);
      } else if (node.property.type === "Literal") {
        parts.push(String(node.property.value));
      }
    } else if (node.type === "Identifier") {
      parts.push(node.name);
    }

    return parts;
  }

  private parseCode(code: string): string[] {
    try {
      const ast = acorn.parse(code, {
        ecmaVersion: "latest",
        sourceType: "module",
      });

      let parts: string[] = [];

      acornWalk.simple(ast, {
        MemberExpression: (node: acorn.MemberExpression) => {
          // Only process top-level member expressions
          parts = this.extractPathFromNode(node);
        },
        Identifier: (node: acorn.Identifier) => {
          // Handle standalone identifiers
          parts = [node.name];
        },
      });

      return parts;
    } catch (error) {
      console.warn(`Failed to parse code: ${code}`, error);
      return [];
    }
  }

  private buildGraphFromParts(parts: string[]): void {
    if (parts.length < 2) {
      return;
    }

    // Add all parts as vertices
    parts.forEach((part) => this.graph.addVertex(part));

    // Connect parts in reverse order
    for (let i = parts.length - 1; i > 0; i--) {
      try {
        this.graph.addEdge(parts[i], parts[i - 1]);
      } catch (error) {
        console.warn(
          `Failed to add edge ${parts[i]} -> ${parts[i - 1]}:`,
          error
        );
      }
    }
  }

  private processAssignment(variable: string, value: string): void {
    this.graph.addVertex(variable);

    const parts = this.parseCode(value);
    if (parts.length > 0) {
      this.buildGraphFromParts(parts);
      // Connect the variable to the last part of the expression
      try {
        this.graph.addEdge(variable, parts[parts.length - 1]);
      } catch (error) {
        console.warn(`Failed to connect assignment ${variable}:`, error);
      }
    } else {
      // Handle simple assignment
      this.graph.addVertex(value);
      try {
        this.graph.addEdge(variable, value);
      } catch (error) {
        console.warn(`Failed to connect simple assignment ${variable}:`, error);
      }
    }
  }

  generateGraph(): DirectedChainGraph {
    // Process assignments first
    for (const [variable, value] of this.assignments) {
      this.processAssignment(variable, value);
    }

    // Process expressions
    for (const expression of this.expressions) {
      if (!expression.trim()) {
        continue;
      }
      const parts = this.parseCode(expression);
      this.buildGraphFromParts(parts);
    }

    return this.graph;
  }
}
