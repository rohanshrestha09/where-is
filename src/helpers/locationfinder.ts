import * as Glob from "glob";
import * as fs from "fs";
import { keywords } from "../constants";

export class LocationFinder {
  private documentPath?: string;
  private documentContent: string;
  private allAssignments: Map<string, string>;
  private rootAssignments: Map<string, string>;
  private derivedAssignments: Map<string, string>;

  constructor(documentContent: string, documentPath?: string) {
    this.documentPath = documentPath;
    this.documentContent = documentContent;
    this.allAssignments = this.findAllAssignments();
    this.rootAssignments = this.findRootAssignments();
    this.derivedAssignments = this.findDerivedAssignments();
  }

  findAllAssignments() {
    const assignmentRegex = /(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(.*?);/g;
    const assignments = new Map<string, string>();
    let match;
    while ((match = assignmentRegex.exec(this.documentContent)) !== null) {
      assignments.set(match[2], match[3]);
    }
    return assignments;
  }

  findRootAssignments() {
    const rootAssignments = new Map<string, string>();

    this.allAssignments.forEach((value, key) => {
      if (/server\.plugins\[(["'])(.*?)\1\]/.test(value)) {
        rootAssignments.set(key, value);
      }
    });

    return rootAssignments;
  }

  findDerivedAssignments() {
    const derivedAssignments = new Map<string, string>();

    this.rootAssignments.forEach((rootValue, rootKey) => {
      derivedAssignments.set(rootKey, rootValue);

      this.allAssignments.forEach((value, key) => {
        if (new RegExp(`${rootKey}.*`).test(value)) {
          derivedAssignments.set(key, value);
        }
      });
    });

    return derivedAssignments;
  }

  constructDirectedGraph(assignments: Map<string, string>) {
    const graph = new Map<string, string>();

    assignments.forEach((value, key) => {
      const regex = new RegExp(
        `\\b([a-zA-Z0-9_]+)(?:\\s*\\.\\s*(?:['"\`])?${key}(?:['"\`])?)\\b`,
        "g"
      );
      const strippedValue = value.replace(regex, "$1");

      if (strippedValue && assignments.has(strippedValue)) {
        graph.set(
          `${strippedValue}.${key}`,
          `${assignments.get(strippedValue)}.${key}`
        );
      }

      graph.set(key, value);
    });

    return graph;
  }

  async findPath(functionName: string) {
    if (this.isKeyword(functionName)) {
      return null;
    }

    const functionCallRegex = new RegExp(`\\b${functionName}\\b`, "g");
    const functionMatches = this.documentContent.split("\n").flatMap((line) => {
      const matches = [];
      let match;
      while ((match = functionCallRegex.exec(line)) !== null) {
        matches.push({
          line: `${line.slice(0, match.index).trim()}${match[0]}`,
          match: match[0],
        });
      }
      return matches;
    });

    if (functionMatches.length === 0) {
      return null;
    }

    const variableNames: string[] = [];

    for (const functionMatch of functionMatches) {
      let currentIndex =
        functionMatch.line.lastIndexOf(functionMatch.match) - 1;

      while (currentIndex >= 0) {
        const char = functionMatch.line[currentIndex];
        if (char === ".") {
          variableNames.unshift(
            functionMatch.line.slice(currentIndex + 1).trim()
          );
          functionMatch.line = functionMatch.line.slice(0, currentIndex);
        } else if (!/[a-zA-Z0-9_$]/.test(char)) {
          variableNames.unshift(
            functionMatch.line.slice(currentIndex + 1).trim()
          );
          break;
        }
        currentIndex--;
      }
    }

    const directedGraph = this.constructDirectedGraph(this.derivedAssignments);
    const [rootVariable] = variableNames;
    let resolvedVariable = directedGraph.get(rootVariable);

    while (resolvedVariable && directedGraph.has(resolvedVariable)) {
      resolvedVariable = directedGraph.get(resolvedVariable);
    }

    if (!resolvedVariable) {
      return null;
    }

    variableNames[0] = resolvedVariable;
    let finalVariables = variableNames.join(".");

    for (const [_, assignedValue] of this.rootAssignments) {
      finalVariables = finalVariables.replace(`${assignedValue}.`, "");
    }

    const [reference] = finalVariables.split(".");

    const filePath = await Glob.glob(`**/${this.toKebabCase(reference)}.js`, {
      cwd: this.documentPath,
      absolute: true,
    });

    return filePath;
  }

  async findFunctionLocation(functionName: string) {
    try {
      const filePath = await this.findPath(functionName);
      if (!filePath || filePath.length === 0) {
        return null;
      }

      const fileContent = fs.readFileSync(filePath[0], "utf-8");
      const regex = new RegExp(
        `(?:exports\\.|module\\.exports\\.)?${functionName}\\s*=`,
        "g"
      );
      let match;
      while ((match = regex.exec(fileContent)) !== null) {
        const line = fileContent.slice(0, match.index).split("\n").length - 1;
        return { file: filePath[0], line };
      }
    } catch (err) {
      console.error(`Error reading file:`, err);
    }

    return null;
  }

  async getFunctionText(functionName: string) {
    const functionLocation = await this.findFunctionLocation(functionName);
    if (!functionLocation) {
      return null;
    }

    const { file, line } = functionLocation;
    const fileContent = fs.readFileSync(file, "utf-8");
    const lines = fileContent.split("\n");

    let functionText = "";
    let braceCount = 0;
    let functionStarted = false;
    let inString = false;
    let stringChar = "";

    for (let i = line; i < lines.length; i++) {
      const currentLine = lines[i];
      functionText += currentLine + "\n";

      // Process the line character by character
      for (let j = 0; j < currentLine.length; j++) {
        const char = currentLine[j];

        // Handle string literals to avoid counting braces inside strings
        if (
          (char === '"' || char === "'" || char === "`") &&
          (j === 0 || currentLine[j - 1] !== "\\")
        ) {
          if (!inString) {
            inString = true;
            stringChar = char;
          } else if (char === stringChar) {
            inString = false;
          }
        }

        // Only count braces if we're not inside a string
        if (!inString) {
          if (char === "{") {
            braceCount++;
            functionStarted = true;
          } else if (char === "}") {
            braceCount--;
          }
        }
      }

      // Handle arrow functions and single-line functions
      if (
        !functionStarted &&
        (currentLine.includes("=>") ||
          currentLine.includes("function") ||
          currentLine.match(/:\s*function/))
      ) {
        functionStarted = true;
      }

      // Check if function has ended
      if (
        functionStarted &&
        (braceCount === 0 ||
          (braceCount === 0 && currentLine.trim().endsWith(";")))
      ) {
        break;
      }
    }

    return functionText.trim();
  }

  toKebabCase(str: string) {
    return str
      .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-/, "")
      .toLowerCase();
  }

  isKeyword(word: string) {
    return new Set(keywords).has(word);
  }
}
