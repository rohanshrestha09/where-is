import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { DirectedChainGraph } from "../datastructures/graph";

export class GraphGenerator {
  private readonly graph: DirectedChainGraph;

  constructor(
    private readonly variableAssignments: Map<string, string>,
    private readonly methodCallExpressions: string[]
  ) {
    this.graph = new DirectedChainGraph();
  }

  private extractDependencyPath(node: acorn.AnyNode) {
    const pathParts: string[] = [];

    if (node.type === "MemberExpression") {
      this.handleMemberExpression(node, pathParts);
    } else if (node.type === "Identifier") {
      pathParts.push(node.name);
    }

    return pathParts;
  }

  private handleMemberExpression(
    node: acorn.MemberExpression,
    pathParts: string[]
  ) {
    // Handle the object part (left side of the dot)
    if (node.object.type === "MemberExpression") {
      pathParts.push(...this.extractDependencyPath(node.object));
    } else if (node.object.type === "Identifier") {
      pathParts.push(node.object.name);
    }

    // Handle the property part (right side of the dot)
    if (node.property.type === "Identifier") {
      pathParts.push(node.property.name);
    } else if (node.property.type === "Literal") {
      pathParts.push(String(node.property.value));
    }
  }

  private parseExpressionToDependencyPath(code: string) {
    try {
      const ast = acorn.parse(code, {
        ecmaVersion: "latest",
        sourceType: "module",
      });

      let dependencyParts: string[] = [];

      acornWalk.simple(ast, {
        MemberExpression: (node: acorn.MemberExpression) => {
          dependencyParts = this.extractDependencyPath(node);
        },
        Identifier: (node: acorn.Identifier) => {
          if (!dependencyParts.length) {
            dependencyParts = [node.name];
          }
        },
      });

      return dependencyParts;
    } catch (error) {
      console.warn(`Failed to parse expression: ${code}`, error);
      return [];
    }
  }

  private createDependencyChain(pathParts: string[]) {
    if (pathParts.length < 2) {
      return;
    }

    // Add all parts as nodes in the graph
    pathParts.forEach((part) => this.graph.addVertex(part));

    // Connect nodes in reverse order to create the dependency chain
    for (let i = pathParts.length - 1; i > 0; i--) {
      this.createDependencyLink(pathParts[i], pathParts[i - 1]);
    }
  }

  private createDependencyLink(source: string, target: string) {
    try {
      this.graph.addEdge(source, target);
    } catch (error) {
      console.warn(
        `Failed to create dependency link ${source} -> ${target}:`,
        error
      );
    }
  }

  private processVariableAssignment(variable: string, value: string) {
    this.graph.addVertex(variable);
    const parts = this.parseExpressionToDependencyPath(value);

    if (parts.length > 0) {
      this.createDependencyChain(parts);
      this.createDependencyLink(variable, parts[parts.length - 1]);
    } else {
      // Handle simple value assignment
      this.graph.addVertex(value);
      this.createDependencyLink(variable, value);
    }
  }

  generateGraph() {
    // Process variable assignments
    for (const [variable, value] of this.variableAssignments) {
      this.processVariableAssignment(variable, value);
    }

    // Process method calls
    for (const methodCallExpresson of this.methodCallExpressions) {
      if (!methodCallExpresson.trim()) {
        continue;
      }

      const parts = this.parseExpressionToDependencyPath(methodCallExpresson);
      this.createDependencyChain(parts);
    }

    return this.graph;
  }
}
