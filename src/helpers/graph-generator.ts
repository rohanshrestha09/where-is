import { DirectedChainGraph, GraphRegistry } from "../datastructures/graph";

export class GraphRegistryGenerator {
  private registry: GraphRegistry;

  constructor() {
    this.registry = new GraphRegistry();
  }

  /**
   * Determine if a value should be parsed as an expression
   *
   * @param value The value to check
   * @returns True if the value should be parsed as an expression, false otherwise
   */
  private shouldParseAsExpression(value: string): boolean {
    // Check if the value contains dots that are not within quotes or brackets
    let inQuotes = false;
    let inBrackets = false;
    let hasDotOutsideQuotesAndBrackets = false;

    for (let i = 0; i < value.length; i++) {
      const char = value[i];

      // Handle quotes
      if (char === '"' || char === "'") {
        if (!inBrackets) {
          inQuotes = !inQuotes;
        }
      }

      // Handle brackets
      if (char === "[" && !inQuotes) {
        inBrackets = true;
      }
      if (char === "]" && !inQuotes) {
        inBrackets = false;
      }

      // Check for dots outside quotes and brackets
      if (char === "." && !inQuotes && !inBrackets) {
        hasDotOutsideQuotesAndBrackets = true;
      }
    }

    // If the value has dots outside quotes and brackets, it's likely an expression
    if (hasDotOutsideQuotesAndBrackets) {
      return true;
    }

    // Check if the value matches common patterns for expressions
    const expressionPatterns = [
      /^[a-zA-Z_$][a-zA-Z0-9_$]*\.[a-zA-Z_$][a-zA-Z0-9_$]*/, // simple dot notation: obj.prop
      /\[['"]\w+['"]\]/, // bracket notation: obj["prop"] or obj['prop']
      /\.\w+\(.*\)/, // method calls: obj.method()
    ];

    for (const pattern of expressionPatterns) {
      if (pattern.test(value)) {
        return true;
      }
    }

    return false;
  }

  /**
   * Parse an expression into its component parts, handling special characters and brackets
   *
   * @param expression The dot notation expression to parse
   * @returns Array of parts in the expression
   */
  private parseExpression(expression: string): string[] {
    const parts: string[] = [];
    let currentPart = "";
    let inBrackets = false;
    let bracketType = "";

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      // Handle opening brackets
      if ((char === "[" || char === '"' || char === "'") && !inBrackets) {
        inBrackets = true;
        bracketType = char;
        currentPart += char;
        continue;
      }

      // Handle closing brackets
      if (
        (char === "]" && bracketType === "[") ||
        (char === '"' && bracketType === '"') ||
        (char === "'" && bracketType === "'")
      ) {
        inBrackets = false;
        bracketType = "";
        currentPart += char;
        continue;
      }

      // If we're in brackets, add the character to the current part
      if (inBrackets) {
        currentPart += char;
        continue;
      }

      // If we encounter a dot and we're not in brackets, it's a separator
      if (char === "." && !inBrackets) {
        if (currentPart) {
          parts.push(currentPart);
          currentPart = "";
        }
        continue;
      }

      // Otherwise, add the character to the current part
      currentPart += char;
    }

    // Add the last part if there is one
    if (currentPart) {
      parts.push(currentPart);
    }

    return parts;
  }

  /**
   * Generate graphs from dot notation expressions like "services.MongoService.getPopulatedDataAsync"
   * Each expression will create a chain of vertices connected in the order they appear
   *
   * @param expressions Array of dot notation expressions
   * @returns The updated registry with new graphs
   */
  private generateGraphFromExpressions(expressions: string[]): GraphRegistry {
    for (const expression of expressions) {
      // Skip empty expressions
      if (!expression.trim()) {
        continue;
      }

      // Parse the expression into parts
      const parts = this.parseExpression(expression);

      if (parts.length < 2) {
        console.warn(
          `Expression "${expression}" needs at least two parts to form a graph. Skipping.`
        );
        continue;
      }

      // Create a new graph for this expression
      const graph = new DirectedChainGraph();

      // Add all parts as vertices
      for (const part of parts) {
        graph.addVertex(part);
      }

      // Connect the vertices in reverse order (from right to left)
      // This ensures that when we follow the path, we go from left to right
      for (let i = parts.length - 1; i > 0; i--) {
        try {
          graph.addEdge(parts[i], parts[i - 1]);
        } catch (error: any) {
          console.warn(
            `Error adding edge in expression "${expression}": ${error.message}`
          );
        }
      }

      // Register the graph
      this.registry.registerGraph(graph);
      console.log(`Created graph from expression: ${expression}`);
    }

    return this.registry;
  }

  /**
   * Generate graphs from assignment expressions like "services = server.plugins['core-services']"
   *
   * @param assignments Map of variable names to their assigned values
   * @returns The updated registry with new graphs
   */
  private generateGraphFromAssignments(
    assignments: Map<string, string>
  ): GraphRegistry {
    // Create graphs for each assignment
    for (const [variable, value] of assignments.entries()) {
      // Create a graph for this assignment
      const assignmentGraph = new DirectedChainGraph();

      // Add the variable as a vertex
      assignmentGraph.addVertex(variable);

      // Try to determine if the value should be treated as an expression
      const shouldParseAsExpression = this.shouldParseAsExpression(value);

      if (!shouldParseAsExpression) {
        // Treat as a literal string
        assignmentGraph.addVertex(value);

        // Connect variable to value
        try {
          assignmentGraph.addEdge(variable, value);
        } catch (error: any) {
          console.warn(
            `Error adding edge for assignment "${variable} = ${value}": ${error.message}`
          );
        }

        // Register the assignment graph
        this.registry.registerGraph(assignmentGraph);
        console.log(
          `Created graph from simple assignment: ${variable} = ${value}`
        );
      } else {
        // Parse the value as an expression
        const valueParts = this.parseExpression(value);

        if (valueParts.length === 0) {
          console.warn(
            `Empty value for assignment "${variable} = ${value}". Skipping.`
          );
          continue;
        }

        if (valueParts.length === 1) {
          // Simple assignment to a single value
          assignmentGraph.addVertex(value);

          // Connect variable to value
          try {
            assignmentGraph.addEdge(variable, value);
          } catch (error: any) {
            console.warn(
              `Error adding edge for assignment "${variable} = ${value}": ${error.message}`
            );
          }

          // Register the assignment graph
          this.registry.registerGraph(assignmentGraph);
          console.log(
            `Created graph from simple assignment: ${variable} = ${value}`
          );
        } else {
          // The value is an expression with multiple parts
          // Create a separate graph for the expression
          const expressionGraph = new DirectedChainGraph();

          // Add all parts of the expression as vertices
          for (const part of valueParts) {
            expressionGraph.addVertex(part);
          }

          // Connect the parts of the expression in reverse order (from right to left)
          // This ensures that when we follow the path, we go from left to right
          for (let i = valueParts.length - 1; i > 0; i--) {
            try {
              expressionGraph.addEdge(valueParts[i], valueParts[i - 1]);
            } catch (error: any) {
              console.warn(
                `Error adding edge in expression value "${value}": ${error.message}`
              );
            }
          }

          // Register the expression graph
          this.registry.registerGraph(expressionGraph);
          console.log(`Created graph for expression: ${value}`);

          // Register the assignment graph
          this.registry.registerGraph(assignmentGraph);

          // Connect the assignment graph to the expression graph
          try {
            this.registry.connectGraphs(assignmentGraph, expressionGraph);
            console.log(
              `Connected assignment graph to expression graph for: ${variable} = ${value}`
            );
          } catch (error: any) {
            console.warn(
              `Error connecting assignment graph to expression graph: ${error.message}`
            );
          }
        }
      }
    }

    return this.registry;
  }

  /**
   * Generate a complete graph registry by connecting all graphs based on shared vertices
   *
   * @returns The fully connected graph registry
   */
  generateGraphRegistry(
    assignments: Map<string, string>,
    expressions: string[]
  ): GraphRegistry {
    this.generateGraphFromAssignments(assignments);
    this.generateGraphFromExpressions(expressions);

    // Auto-connect all graphs based on shared vertices
    this.registry.autoConnectAllGraphs();

    return this.registry;
  }
}
