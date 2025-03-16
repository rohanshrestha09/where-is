import * as Glob from "glob";
import * as fs from "fs";
import * as fuzz from "fuzzball";
import { ProviderProps } from "../types";
import { GraphGenerator } from "../helpers/graph-generator";
import { BaseProviderService } from "./base-provider.service";

export class DefinitionProviderService extends BaseProviderService {
  private readonly documentText: string;
  private readonly documentPath?: string;
  private readonly lineText: string;
  private readonly functionName: string;

  constructor(props: ProviderProps) {
    super();
    this.documentText = props.documentText;
    this.documentPath = props.documentPath;
    this.lineText = props.lineText;
    this.functionName = props.functionName;
  }

  protected findAllAssignments() {
    const assignmentRegex =
      /(const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(.*?)(?:;|\n|$)/g;
    const assignments = new Map<string, string>();
    let match;
    while ((match = assignmentRegex.exec(this.documentText)) !== null) {
      assignments.set(match[2], match[3]);
    }
    return assignments;
  }

  private findFunctionCallExpression() {
    const line = this.lineText.trim();

    // Remove destructuring assignment pattern and leading keywords
    const cleanedLine = line
      .replace(/^\s*(const|let|var)\s+\[.*?\]\s*=\s*(await\s+)?/, "") // Handle array destructuring
      .replace(
        /^\s*(const|let|var)\s+([a-zA-Z0-9_$]+|\[.*?\])\s*=\s*(await\s+)?|^return\s+await\s+|^await\s+|^\s*return\s+/,
        ""
      )
      .replace(/^\s*[a-zA-Z0-9_$]+\s*:\s*/, "");

    // Remove trailing comma and anything after it
    const withoutComma = cleanedLine.split(",")[0].trim();

    // Remove trailing parentheses and their contents
    const withoutParentheses = withoutComma.replace(/\(.*$/, "").trim();

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

  private async findFilePathsByReference(
    pathReference: string,
    nameReference: string
  ) {
    const directMatchedFilePaths = await Glob.glob(
      `**/${this.convertToKebabCase(nameReference)}.js`,
      {
        cwd: this.documentPath,
        absolute: true,
        ignore: "**/node_modules/**",
      }
    );

    if (directMatchedFilePaths.length) {
      return directMatchedFilePaths;
    }

    const globPathReference = this.getGlobPathReference(pathReference);
    if (!globPathReference) {
      return null;
    }

    const matchedFilePaths = await Glob.glob(`**/*-${globPathReference}.js`, {
      cwd: this.documentPath,
      absolute: true,
      ignore: "**/node_modules/**",
    });

    const choices = matchedFilePaths.map((filePath) =>
      filePath.split("/").pop()
    );

    const fuzzResults = fuzz.extract(nameReference, choices, {
      scorer: fuzz.partial_ratio,
    });

    return fuzzResults
      .map(([matchedName]) =>
        matchedFilePaths.find((filePath) => filePath.includes(matchedName))
      )
      .filter((path): path is string => !!path);
  }

  private async findValidFilePath(nameReference: string, filePaths: string[]) {
    const checkFile = async (filePath: string) => {
      for await (const { content } of this.readFileReverseStream(filePath)) {
        if (
          content
            .trim()
            .match(new RegExp(`\\w+Name:?\\s*['"]${nameReference}['"]`))
        ) {
          return filePath;
        }
      }
      return null;
    };

    const batchSize = 1;
    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);
      try {
        const validPath = await Promise.any(batch.map(checkFile));
        if (validPath) {
          return validPath;
        }
      } catch (e) {}
    }
    return null;
  }

  private async findFunctionLocation(filePath: string) {
    const fileStream = fs.createReadStream(filePath, { encoding: "utf-8" });
    let fileContent = "";
    let line = 0;

    const regex = new RegExp(
      `(?:function\\s+${this.functionName}\\s*\\([^)]*\\)\\s*{|` + // Function declarations
        `${this.functionName}\\s*=\\s*(?:async\\s*)?\\(?[^)]*\\)?\\s*=>\\s*{?|` + // Arrow functions (handles default params)
        `${this.functionName}\\s*:\\s*(?:async\\s*)?(?:function\\s*)?\\([^)]*\\)\\s*{?|` + // Object methods
        `${this.functionName}\\s*=\\s*(?:async\\s*)?function\\s*\\([^)]*\\)\\s*{?)`, // Function expressions
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

    return null;
  }

  async findFunctionDefiniton() {
    if (!this.isValidFunctionName(this.functionName)) {
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

      const filePaths = await this.findFilePathsByReference(
        pathReference,
        nameReference
      );
      if (!filePaths?.length) {
        return null;
      }

      const filePath = await this.findValidFilePath(nameReference, filePaths);
      if (!filePath) {
        return null;
      }

      return this.findFunctionLocation(filePath);
    } catch (err) {
      console.error(`Error locating function definition:`, err);
    }

    return null;
  }
}
