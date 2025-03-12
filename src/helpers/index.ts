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
