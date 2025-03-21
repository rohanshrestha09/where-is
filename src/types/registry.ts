export type RegistryNode = {
  path: string;
  name: string;
  start: number;
  end: number;
  loc?: {
    start: {
      line: number;
      column: number;
    };
    end: {
      line: number;
      column: number;
    };
  };
};

export type RegistryNodeMap = {
  [key: string]: RegistryNode | RegistryNodeMap;
};
