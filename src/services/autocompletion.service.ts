import { RegistryTree } from "../datastructures/registry-tree";

export interface Completion {
  label: string;
  detail?: string;
  path: string[];
}

export class AutocompletionService {
  private completions: Completion[] = [];

  constructor(private readonly registryTree: RegistryTree) {
    this.buildCompletions();
  }

  private buildCompletions(
    currentPath: string[] = [],
    currentTree: RegistryTree = this.registryTree
  ) {
    const json = currentTree.toJSON();
    
    if (json.__type__ === "leaf") {
      this.completions.push({
        label: json.name,
        detail: json.path,
        path: [...currentPath],
      });
      return;
    }

    for (const key in json) {
      if (key === "__type__") continue;
      
      const newPath = [...currentPath, key];
      const childTree = RegistryTree.fromJSON(json[key]);
      this.buildCompletions(newPath, childTree);
    }
  }

  getCompletions(prefix: string = ""): Completion[] {
    return this.completions
      .filter(completion => 
        completion.label.toLowerCase().startsWith(prefix.toLowerCase())
      );
  }

  getCompletionsByPath(path: string[]): Completion[] {
    return this.completions
      .filter(completion => 
        path.every((segment, index) => 
          completion.path[index]?.toLowerCase() === segment.toLowerCase()
        )
      );
  }
}