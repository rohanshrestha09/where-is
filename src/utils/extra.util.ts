import * as acorn from "acorn";
import { MAX_FUNCTION_LENGTH } from "../constants";

export class ExtraUtil {
  static isKeyword(word: string) {
    try {
      acorn.parseExpressionAt(`${word} = 1`, 0, { ecmaVersion: "latest" });
      return false;
    } catch (error: any) {
      return true;
    }
  }

  static convertToKebabCase(str: string) {
    return str
      .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
      .replace(/[^a-z0-9-]/g, "")
      .replace(/^-/, "")
      .toLowerCase();
  }

  static convertToPascalCase(str: string) {
    return str
      .replace(/(^|-)(\w)/g, (match, p1, p2) => p2.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, "");
  }

  static isValidFunctionName(functionName: string) {
    return (
      functionName.length < MAX_FUNCTION_LENGTH && !this.isKeyword(functionName)
    );
  }

  static getGlobPathReference(pathReference: string) {
    switch (pathReference) {
      case "core-services":
        return "service";
      case "core-utility-functions":
        return "function";
      case "core-controller":
        return "controller";
      case "core-config":
        return "config";
      case "core-models":
        return "model";
    }

    return null;
  }
}
