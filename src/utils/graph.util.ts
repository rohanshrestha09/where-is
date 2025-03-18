import * as acorn from "acorn";
import * as acornWalk from "acorn-walk";
import { DirectedGraph } from "../datastructures/graph";

export class GraphUtil {
  private readonly graph: DirectedGraph;
  private readonly blacklistedVertices: string[];

  constructor() {
    this.graph = new DirectedGraph();
    this.blacklistedVertices = ["core-models"];
  }

  private extractNodePath(node: acorn.AnyNode) {
    const pathParts: string[] = [];

    if (node.type === "MemberExpression") {
      this.handleNodeChain(node, pathParts);
    } else if (node.type === "Identifier") {
      pathParts.push(node.name);
    }

    return pathParts;
  }

  private handleNodeChain(node: acorn.MemberExpression, pathParts: string[]) {
    if (node.object.type === "MemberExpression") {
      pathParts.push(...this.extractNodePath(node.object));
    } else if (node.object.type === "Identifier") {
      pathParts.push(node.object.name);
    }

    if (node.property.type === "Identifier") {
      pathParts.push(node.property.name);
    } else if (node.property.type === "Literal") {
      pathParts.push(String(node.property.value));
    }
  }

  private parseExpressionToNodePath(code: string) {
    try {
      const ast = acorn.parse(code, {
        ecmaVersion: "latest",
        sourceType: "module",
      });

      let nodeParts: string[] = [];

      acornWalk.simple(ast, {
        MemberExpression: (node: acorn.MemberExpression) => {
          nodeParts = this.extractNodePath(node);
        },
        Identifier: (node: acorn.Identifier) => {
          if (!nodeParts.length) {
            nodeParts = [node.name];
          }
        },
      });

      return nodeParts;
    } catch (error) {
      console.warn(`Failed to parse expression: ${code}`, error);
      return [];
    }
  }

  private buildNodeChain(pathParts: string[]) {
    if (pathParts.length < 2) return;

    pathParts.forEach((part) => {
      if (!this.blacklistedVertices.includes(part)) {
        this.graph.addVertex(part);
      }
    });

    for (let i = pathParts.length - 1; i > 0; i--) {
      const source = pathParts[i];
      const target = pathParts[i - 1];

      if (
        !this.blacklistedVertices.includes(source) &&
        !this.blacklistedVertices.includes(target)
      ) {
        this.addDirectedEdge(source, target);
      }
    }
  }

  private addDirectedEdge(source: string, target: string) {
    try {
      if (
        !this.blacklistedVertices.includes(source) &&
        !this.blacklistedVertices.includes(target)
      ) {
        this.graph.addEdge(source, target);
      }
    } catch (error) {
      console.warn(`Failed to create link ${source} -> ${target}:`, error);
    }
  }

  private processNodeAssignment(variable: string, value: string) {
    if (this.blacklistedVertices.includes(variable)) return;

    this.graph.addVertex(variable);
    const parts = this.parseExpressionToNodePath(value);

    if (parts.length > 0) {
      this.buildNodeChain(parts);
      const lastPart = parts[parts.length - 1];
      if (!this.blacklistedVertices.includes(lastPart)) {
        this.addDirectedEdge(variable, lastPart);
      }
    } else {
      if (!this.blacklistedVertices.includes(value)) {
        this.graph.addVertex(value);
        this.addDirectedEdge(variable, value);
      }
    }
  }

  buildDirectedGraphFromVariableAssignments(
    variableAssignments: Map<string, string>
  ) {
    for (const [variable, value] of variableAssignments) {
      this.processNodeAssignment(variable, value);
    }
    return this.graph;
  }

  buildDirectedGraphFromMethodCallExpressions(methodCallExpressions: string[]) {
    for (const methodCallExpression of methodCallExpressions) {
      if (!methodCallExpression.trim()) continue;
      const parts = this.parseExpressionToNodePath(methodCallExpression);
      this.buildNodeChain(parts);
    }
    return this.graph;
  }

  buildDirectedGraph(
    variableAssignments: Map<string, string>,
    methodCallExpressions: string[]
  ) {
    this.buildDirectedGraphFromVariableAssignments(variableAssignments);
    this.buildDirectedGraphFromMethodCallExpressions(methodCallExpressions);
    return this.graph;
  }
}
