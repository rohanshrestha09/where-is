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

  static isValidIdentifierName(str: string) {
    if (/[-+.@#$%^&*()!~`\s]/.test(str)) {
      return false;
    }

    return /^[a-zA-Z][a-zA-Z0-9]*$/.test(str);
  }

  static isInsideBrackets(str: string) {
    const hasOpenBracket = str.includes("[");
    const hasCloseBracket = str.includes("]");

    if (!hasOpenBracket) return false;

    if (hasOpenBracket && hasCloseBracket) {
      // Check if we end with empty brackets (including nested ones)
      return str.endsWith("[]") || str.match(/\[[^\]]*\]\[\]$/);
    }

    return !hasCloseBracket;
  }

  static isInsideBracketsWithQuotes(str: string) {
    // Check for incomplete bracket-quote patterns
    const doubleQuoteMatch = str.match(/\["([^"]*)$/);
    const singleQuoteMatch = str.match(/\['([^']*)$/);
    
    // Check for empty bracket-quote patterns (including nested ones)
    const emptyDoubleQuote = str.endsWith('[""]');
    const emptySingleQuote = str.endsWith("['']");
    
    // Check for nested empty bracket-quote patterns like server["plugins"][""]
    const nestedEmptyDoubleQuote = str.match(/\["[^"]*"\]\[""\]$/);
    const nestedEmptySingleQuote = str.match(/\['[^']*'\]\[''\]$/);
    
    return !!(doubleQuoteMatch || singleQuoteMatch || emptyDoubleQuote || emptySingleQuote || 
              nestedEmptyDoubleQuote || nestedEmptySingleQuote);
  }

  static convertToPascalCase(str: string) {
    return str
      .replace(/(^|-)(\w)/g, (match, p1, p2) => p2.toUpperCase())
      .replace(/[^a-zA-Z0-9]/g, "");
  }

  static isValidFunctionName(functionName: string) {
    return functionName.length < MAX_FUNCTION_LENGTH && !this.isKeyword(functionName);
  }

  static stripKeywords(expression: string): string {
    let stripped = expression.trim();

    const keywords = [
      "return ",
      "await ",
      "yield ",
      "throw ",
      "typeof ",
      "void ",
      "delete ",
      "new ",
      "!",
      "-",
      "+",
      "~",
    ];

    let previousLength = 0;
    while (stripped.length !== previousLength) {
      previousLength = stripped.length;

      for (const keyword of keywords) {
        if (stripped.startsWith(keyword)) {
          stripped = stripped.substring(keyword.length).trim();
          break;
        }
      }
    }

    return stripped;
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
