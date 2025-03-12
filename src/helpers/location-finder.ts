import * as Glob from "glob";
import * as fs from "fs";
import { toKebabCase } from ".";
import { GraphRegistryGenerator } from "./graph-generator";

export class LocationFinder {
  private documentPath?: string;
  private documentContent: string;

  constructor(documentContent: string, documentPath?: string) {
    this.documentPath = documentPath;
    this.documentContent = documentContent;
  }

  private findAllAssignments() {
    const assignmentRegex = /(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(.*?);/g;
    const assignments = new Map<string, string>();
    let match;
    while ((match = assignmentRegex.exec(this.documentContent)) !== null) {
      assignments.set(match[2], match[3]);
    }
    return assignments;
  }

  private findFunctionMatchedLines(functionName: string) {
    const functionCallRegex = new RegExp(`\\b${functionName}\\b`, "g");

    const functionLineMatches = this.documentContent
      .split("\n")
      .flatMap((line) => {
        const matches = [];
        let match;
        while ((match = functionCallRegex.exec(line)) !== null) {
          matches.push(`${line.slice(0, match.index).trim()}${match[0]}`);
        }
        return matches;
      });

    return functionLineMatches;
  }

  private findFunctionCallExpression(
    functionName: string,
    functionMatchedLines: string[]
  ) {
    const functionCallExpressions: string[] = [];

    for (let line of functionMatchedLines) {
      const variableNames: string[] = [];

      let currentIndex = line.lastIndexOf(functionName) - 1;

      while (currentIndex >= 0) {
        const char = line[currentIndex];
        if (char === ".") {
          variableNames.unshift(line.slice(currentIndex + 1).trim());
          line = line.slice(0, currentIndex);
        } else if (!/[a-zA-Z0-9_$]/.test(char)) {
          variableNames.unshift(line.slice(currentIndex + 1).trim());
          break;
        }
        currentIndex--;
      }

      functionCallExpressions.push(variableNames.join("."));
    }

    return functionCallExpressions;
  }

  async findPathsByReference(reference: string) {
    const filePaths = await Glob.glob(`**/${toKebabCase(reference)}.js`, {
      cwd: this.documentPath,
      absolute: true,
    });

    return filePaths;
  }

  async findFunctionLocation(functionName: string) {
    try {
      const functionMatchedLines = this.findFunctionMatchedLines(functionName);
      if (!functionMatchedLines.length) {
        return null;
      }

      const functionCallExpressions = this.findFunctionCallExpression(
        functionName,
        functionMatchedLines
      );
      if (!functionCallExpressions.length) {
        return null;
      }

      const allAssignments = this.findAllAssignments();

      const graphRegistryGenerator = new GraphRegistryGenerator();

      const graphRegistry = graphRegistryGenerator.generateGraphRegistry(
        allAssignments,
        functionCallExpressions
      );

      const paths = graphRegistry.followVertexPath(functionName);

      const reference = paths[paths.length - 5];

      const filePaths = await this.findPathsByReference(reference);
      if (!filePaths || filePaths.length === 0) {
        return null;
      }

      const filePath = filePaths[0];
      const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
      let fileContent = "";
      let line = 0;

      const regex = new RegExp(
        `(?:exports\\.|module\\.exports\\.)?${functionName}\\s*=`,
        "g"
      );

      for await (const chunk of fileStream) {
        fileContent += chunk;
        const match = regex.exec(fileContent);
        if (match) {
          line = fileContent.slice(0, match.index).split("\n").length - 1;
          return { content: fileContent, path: filePath, line };
        }
      }
    } catch (err) {
      console.error(`Error reading file:`, err);
    }

    return null;
  }

  getFunctionText(fileContent: string, line: number) {
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
}
