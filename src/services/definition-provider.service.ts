import * as Glob from "glob";
import * as fs from "fs";
import * as fuzz from "fuzzball";
import { ProviderProps } from "../types";
import { isKeyword, toKebabCase, toSingular } from "../utils";
import { GraphGenerator } from "../helpers/graph-generator";

export class DefinitionProviderService {
  private readonly documentText: string;
  private readonly documentPath?: string;
  private readonly lineText: string;
  private readonly functionName: string;

  constructor(props: ProviderProps) {
    this.documentText = props.documentText;
    this.documentPath = props.documentPath;
    this.lineText = props.lineText;
    this.functionName = props.functionName;
  }

  private findAllAssignments() {
    const assignmentRegex = /(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(.*?);/g;
    const assignments = new Map<string, string>();
    let match;
    while ((match = assignmentRegex.exec(this.documentText)) !== null) {
      assignments.set(match[2], match[3]);
    }
    return assignments;
  }

  private findFunctionCallExpression() {
    const line = this.lineText.trim();

    // Remove leading keywords, assignment part, and await
    const cleanedLine = line
      .replace(/^\s*(const|let|var)\s+[a-zA-Z0-9_$]+\s*=\s*(await\s+)?/, "")
      .replace(/^await\s+/, "")
      .replace(/^\s*[a-zA-Z0-9_$]+\s*:\s*/, ""); // Remove object property assignment

    // Remove trailing comma and anything after it
    const withoutComma = cleanedLine.split(",")[0].trim();

    // Remove trailing parentheses and anything after them
    const withoutParentheses = withoutComma.split("(")[0].trim();

    const parts = withoutParentheses
      .split(".")
      .map((part) => part.trim())
      .filter((part) => part);

    const lastPart = parts[parts.length - 1];
    if (lastPart) {
      const match = lastPart.match(/[^a-zA-Z0-9_$]+/);
      if (match) {
        parts[parts.length - 1] = lastPart.slice(
          match.index! + match[0].length
        );
      }
    }

    return parts.join(".");
  }

  private async findPathsByReference(
    pathReference: string,
    nameReference: string
  ) {
    const directMatchedFilePaths = await Glob.glob(
      `**/${toKebabCase(nameReference)}.js`,
      {
        cwd: this.documentPath,
        absolute: true,
      }
    );

    if (directMatchedFilePaths.length) {
      return directMatchedFilePaths;
    }

    const globPathReference = toSingular(
      pathReference.replaceAll("core-", "") ?? ""
    );

    if (!globPathReference) {
      return null;
    }

    const matchedFilePaths = await Glob.glob(`**/*-${globPathReference}.js`, {
      cwd: this.documentPath,
      absolute: true,
    });

    const choices = matchedFilePaths.map((filePath) => {
      return filePath.split("/").pop();
    });

    const fuzzResults = fuzz.extract(nameReference, choices, {
      scorer: fuzz.partial_ratio,
    });

    return fuzzResults
      .map(([matchedName]) =>
        matchedFilePaths.find((filePath) => filePath.includes(matchedName))
      )
      .filter((path): path is string => !!path);
  }

  private async findFunctionLocation(filePath: string) {
    const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
    let fileContent = "";
    let line = 0;

    const regex = new RegExp(
      `(?:exports\\.|module\\.exports\\.)?${this.functionName}\\s*=`,
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
  }

  async findFunctionDefiniton() {
    if (this.functionName.length > 30 || isKeyword(this.functionName)) {
      return null;
    }

    try {
      const functionCallExpression = this.findFunctionCallExpression();
      if (!functionCallExpression) {
        return null;
      }

      const allAssignments = this.findAllAssignments();

      const graphGenerator = new GraphGenerator(allAssignments, [
        functionCallExpression,
      ]);

      const graph = graphGenerator.generateGraph();

      const paths = graph.followVertexPath(this.functionName);

      const pathReference = paths[paths.length - 3];
      if (!pathReference) {
        return null;
      }

      const nameReference = paths[paths.length - 5];
      if (!nameReference) {
        return null;
      }

      const filePaths = await this.findPathsByReference(
        pathReference,
        nameReference
      );
      if (!filePaths?.length) {
        return null;
      }

      const filePath = filePaths[0];

      return this.findFunctionLocation(filePath);
    } catch (err) {
      console.error(`Error reading file:`, err);
    }

    return null;
  }
}
