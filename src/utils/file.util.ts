import * as fs from "fs";
import * as Glob from "glob";
import * as fuzz from "fuzzball";
import { createInterface } from "readline";

export class FileUtil {
  static async readFile(filePath: string) {
    return await fs.promises.readFile(filePath, "utf8");
  }

  static async *readFileForwardStreamByLine(
    filePath: string,
    chunkSize = 1024
  ) {
    const fileStream = fs.createReadStream(filePath, {
      highWaterMark: chunkSize,
      encoding: "utf-8",
    });

    const rl = createInterface({
      input: fileStream,
      crlfDelay: Infinity,
    });

    let lineNumber = 0;

    try {
      for await (const line of rl) {
        yield {
          line: lineNumber++,
          content: line,
        };
      }
    } finally {
      fileStream.close();
      rl.close();
    }
  }

  static async *readFileReverseStreamByLine(
    filePath: string,
    chunkSize = 1024
  ) {
    const fileSize = await fs.promises.stat(filePath).then((f) => f.size);
    const fd = await fs.promises.open(filePath, "r");
    let position = fileSize;
    let lastPartialLine = "";

    try {
      while (position > 0) {
        const length = Math.min(chunkSize, position);
        position -= length;

        const buffer = Buffer.alloc(length);
        await fd.read(buffer, 0, length, position);

        const chunk = buffer.toString("utf8");
        const lines = (chunk + lastPartialLine).split("\n");

        if (position > 0) {
          lastPartialLine = lines[0];
          lines.shift();
        }

        for (let i = lines.length - 1; i >= 0; i--) {
          yield {
            line: position + chunk.lastIndexOf("\n", i),
            content: lines[i],
          };
        }
      }
    } finally {
      await fd.close();
    }
  }

  static async findFirstOccurringFile(
    regex: RegExp,
    filePaths: string[],
    options: { direction?: "reverse" | "forward"; batchSize?: number } = {}
  ) {
    const batchSize = options.batchSize || 30;
    const direction = options.direction || "reverse";

    for (let i = 0; i < filePaths.length; i += batchSize) {
      const batch = filePaths.slice(i, i + batchSize);

      const filePromises = batch.map(async (filePath) => {
        if (direction === "reverse") {
          // Reverse mode - read from end to beginning
          for await (const { content } of this.readFileReverseStreamByLine(
            filePath
          )) {
            if (regex.test(content.trim())) return filePath;
          }
        } else {
          // Forward mode - read from beginning to end
          for await (const { content } of this.readFileForwardStreamByLine(
            filePath
          )) {
            if (regex.test(content.trim())) return filePath;
          }
        }

        throw new Error(`No match found in ${filePath}`);
      });

      try {
        const validPath = await Promise.any(filePromises);
        return validPath;
      } catch (e) {
        continue;
      }
    }

    return null;
  }

  static async findFilesByPattern(
    pattern: string,
    options: { cwd?: string | URL }
  ) {
    const matchedFilePaths = await Glob.glob(pattern, {
      cwd: options.cwd,
      absolute: true,
      ignore: "**/node_modules/**",
    });

    return matchedFilePaths;
  }

  static async findBestMatchingFiles(
    filePaths: string[],
    query: string,
    options: { cutoff?: number }
  ) {
    const choices = filePaths.map((filePath) => filePath.split("/").pop());

    const fuzzResults = fuzz.extract(query, choices, {
      scorer: fuzz.partial_ratio,
      cutoff: options.cutoff ?? 50,
    });

    return fuzzResults
      .flatMap(([matchedName]) =>
        filePaths.filter((filePath) => filePath.includes(matchedName))
      )
      .filter((path): path is string => !!path);
  }
}
