export interface EmitDslModulesOptions {
  /** L1 module path, e.g. `../schema-types.js` */
  typesImport: string;
  /** Namespace for L1 types in generated selections (default `Types`) */
  typesNamespace?: string;
  customScalars: string[];
  sortProperties?: boolean;
}

export interface EmitDslModulesResult {
  selections: string;
  typeMap: string;
  index: string;
}
