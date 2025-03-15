import { DirectedChainGraph } from "../datastructures/graph";

export class GraphGenerator {
  private readonly assignments: Map<string, string>;
  private readonly expressions: string[];
  private readonly graph: DirectedChainGraph;

  constructor(assignments: Map<string, string>, expressions: string[]) {
    this.assignments = assignments;
    this.expressions = expressions;
    this.graph = new DirectedChainGraph();
  }

  /**
   * Determine if a value should be parsed as an expression
   *
   * @param value The value to check
   * @returns True if the value should be parsed as an expression, false otherwise
   */
  private shouldParseAsExpression(value: string): boolean {
    return (
      this.hasDotOutsideQuotesAndBrackets(value) ||
      this.matchesExpressionPattern(value)
    );
  }

  /**
   * Check if the value contains dots that are not within quotes or brackets
   */
  private hasDotOutsideQuotesAndBrackets(value: string): boolean {
    let inQuotes = false;
    let inBrackets = false;

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
        return true;
      }
    }

    return false;
  }

  /**
   * Check if the value matches common patterns for expressions
   */
  private matchesExpressionPattern(value: string): boolean {
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

    for (let i = 0; i < expression.length; i++) {
      const char = expression[i];

      if (this.handleOpeningBracket(char, inBrackets)) {
        inBrackets = true;
        if (currentPart) {
          parts.push(currentPart);
          currentPart = "";
        }
        continue;
      }

      if (this.handleClosingBracket(char, "[")) {
        inBrackets = false;
        if (currentPart) {
          parts.push(currentPart.replace(/['"]/g, "")); // Remove quotes
          currentPart = "";
        }
        continue;
      }

      // If we're in brackets, add the character to the current part
      if (inBrackets) {
        currentPart += char;
        continue;
      }

      // If we encounter a dot and we're not in brackets, it's a separator
      if (this.isDotSeparator(char, inBrackets)) {
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
   * Check if character is an opening bracket
   */
  private handleOpeningBracket(char: string, inBrackets: boolean): boolean {
    return (char === "[" || char === '"' || char === "'") && !inBrackets;
  }

  /**
   * Check if character is a closing bracket
   */
  private handleClosingBracket(char: string, bracketType: string): boolean {
    return (
      (char === "]" && bracketType === "[") ||
      (char === '"' && bracketType === '"') ||
      (char === "'" && bracketType === "'")
    );
  }

  /**
   * Check if character is a dot separator
   */
  private isDotSeparator(char: string, inBrackets: boolean): boolean {
    return char === "." && !inBrackets;
  }

  /**
   * Generate graphs from dot notation expressions
   * Each expression will create a chain of vertices connected in the order they appear
   *
   * @param expressions Array of dot notation expressions
   * @returns The updated registry with new graphs
   */
  private generateGraphFromExpressions(
    expressions: string[]
  ): DirectedChainGraph {
    for (const expression of expressions) {
      if (!this.isValidExpression(expression)) {
        continue;
      }

      const parts = this.parseExpression(expression);

      if (!this.hasEnoughParts(parts, expression)) {
        continue;
      }

      this.addPartsAsVertices(parts);
      this.connectPartsInReverseOrder(parts);
    }

    return this.graph;
  }

  /**
   * Check if expression is valid (not empty)
   */
  private isValidExpression(expression: string): boolean {
    return expression.trim().length > 0;
  }

  /**
   * Check if expression has enough parts to form a graph
   */
  private hasEnoughParts(parts: string[], expression: string): boolean {
    if (parts.length < 2) {
      console.warn(
        `Expression "${expression}" needs at least two parts to form a graph. Skipping.`
      );
      return false;
    }
    return true;
  }

  /**
   * Add all parts as vertices to the graph
   */
  private addPartsAsVertices(parts: string[]): void {
    for (const part of parts) {
      this.graph.addVertex(part);
    }
  }

  /**
   * Connect parts in reverse order to ensure correct path traversal
   */
  private connectPartsInReverseOrder(parts: string[]): void {
    for (let i = parts.length - 1; i > 0; i--) {
      this.addSafeEdge(parts[i], parts[i - 1]);
    }
  }

  /**
   * Generate graphs from assignment expressions like "services = server.plugins['core-services']"
   *
   * @param assignments Map of variable names to their assigned values
   * @returns The updated registry with new graphs
   */
  private generateGraphFromAssignments(
    assignments: Map<string, string>
  ): DirectedChainGraph {
    // Create graphs for each assignment
    for (const [variable, value] of assignments.entries()) {
      this.graph.addVertex(variable);

      const shouldParseAsExpression = this.shouldParseAsExpression(value);

      if (!shouldParseAsExpression) {
        this.handleSimpleAssignment(variable, value);
      } else {
        this.handleExpressionAssignment(variable, value);
      }
    }

    return this.graph;
  }

  /**
   * Handle a simple assignment (non-expression value)
   */
  private handleSimpleAssignment(variable: string, value: string): void {
    this.graph.addVertex(value);
    this.addSafeEdge(variable, value);
  }

  /**
   * Handle an assignment with an expression value
   */
  private handleExpressionAssignment(variable: string, value: string): void {
    const valueParts = this.parseExpression(value);

    if (valueParts.length === 0) {
      console.warn(
        `Empty value for assignment "${variable} = ${value}". Skipping.`
      );
      return;
    }

    if (valueParts.length === 1) {
      this.handleSimpleAssignment(variable, value);
      return;
    }

    this.addPartsAsVertices(valueParts);
    this.connectPartsInReverseOrder(valueParts);
    this.addSafeEdge(variable, valueParts[valueParts.length - 1]);
  }

  /**
   * Safely adds an edge between two vertices in the graph
   *
   * @param source The source vertex to connect from
   * @param destination The destination vertex to connect to
   * @throws Will log a warning if edge cannot be added
   */
  addSafeEdge(source: string, destination: string): void {
    try {
      this.graph.addEdge(source, destination);
      console.log(`Added edge for: ${source} -> ${destination}`);
    } catch (error: any) {
      console.warn(
        `Error adding edge for: "${source} -> ${destination}": ${error.message}`
      );
    }
  }

  /**
   * Generate a complete graph by connecting all graphs based on shared vertices
   *
   * @param assignments Map of variable names to their assigned values
   * @param expressions Array of dot notation expressions to process
   * @returns The fully connected graph
   */
  generateGraph(): DirectedChainGraph {
    this.generateGraphFromAssignments(this.assignments);
    this.generateGraphFromExpressions(this.expressions);

    return this.graph;
  }
}
