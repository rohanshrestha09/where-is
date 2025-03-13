import * as Glob from "glob";
import * as fs from "fs";
import { toKebabCase } from ".";
import { GraphGenerator } from "./graph-generator";

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
    const kebabCaseReference = toKebabCase(reference);
    const singularPattern = `**/${kebabCaseReference.replace(/s$/, "")}.js`;
    const pluralPattern = `**/${kebabCaseReference.replace(/s$/, "")}s.js`;

    const patterns = [singularPattern, pluralPattern];

    const filePaths = await Promise.all(
      patterns.map((pattern) =>
        Glob.glob(pattern, {
          cwd: this.documentPath,
          absolute: true,
        })
      )
    );

    return filePaths.flat();
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

      const graphGenerator = new GraphGenerator();

      const graph = graphGenerator.generateGraph(
        allAssignments,
        functionCallExpressions
      );

      const paths = graph.followVertexPath(functionName);

      const reference = paths[paths.length - 5];
      if (!reference) {
        return null;
      }

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
}
