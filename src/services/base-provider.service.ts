import * as fs from "fs/promises";
import { keywords, MAX_FUNCTION_LENGTH } from "../constants";

export abstract class BaseProviderService {
  private isKeyword(word: string) {
    return new Set(keywords).has(word);
  }

  protected convertToKebabCase(str: string) {
    return str
      .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-/, "")
      .toLowerCase();
  }

  protected convertToSingular(word: string) {
    if (word.endsWith("ies")) {
      return word.slice(0, -3) + "y";
    }
    if (word.endsWith("es")) {
      return word.slice(0, -2);
    }
    if (word.endsWith("s") && !word.endsWith("ss")) {
      return word.slice(0, -1);
    }
    return word;
  }

  protected isValidFunctionName(functionName: string) {
    return (
      functionName.length < MAX_FUNCTION_LENGTH && !this.isKeyword(functionName)
    );
  }

  protected async *readFileReverseStream(filePath: string, chunkSize = 1024) {
    const fileSize = (await fs.stat(filePath)).size;
    const fd = await fs.open(filePath, "r");
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

  protected getGlobPathReference(pathReference: string) {
    switch (pathReference) {
      case "core-services":
        return "service";
      case "core-utility-functions":
        return "function";
      case "core-controller":
        return "controller";
      case "core-config":
        return "config";
    }

    return null;
  }
}
