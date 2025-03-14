import { keywords } from "../constants";

export function toKebabCase(str: string) {
  return str
    .replace(/[A-Z]/g, (match) => `-${match.toLowerCase()}`)
    .replace(/[^a-z0-9-]/g, "")
    .replace(/^-/, "")
    .toLowerCase();
}

export function isKeyword(word: string) {
  return new Set(keywords).has(word);
}

export function toSingular(word: string) {
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
