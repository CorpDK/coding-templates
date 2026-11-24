import type { GraphQLSchema } from "graphql";
import type { EmitDslModulesOptions } from "../../types.js";

interface Import {
  isDefault: boolean;
  module?: string;
  alias?: string;
}

interface ImportMap {
  [from: string]: Import[];
}

interface TypeNamespaceImport {
  from: string;
  namespace: string;
}

export class RenderContext {
  protected codeBlocks: string[] = [];
  protected imports: ImportMap = {};
  protected typeNamespaceImports: TypeNamespaceImport[] = [];
  protected importAliasCounter = 0;

  constructor(
    public schema?: GraphQLSchema,
    public config?: EmitDslModulesOptions,
  ) {}

  addCodeBlock(block: string) {
    if (block) {
      this.codeBlocks.push(block);
    }
  }

  addImport(
    from: string,
    isDefault: boolean,
    module?: string,
    _fromAbsolute?: boolean,
    noAlias?: boolean,
  ) {
    if (!this.imports[from]) this.imports[from] = [];

    const imports = this.imports[from];

    const existing = imports.find(
      (i) => (isDefault && i.isDefault) || (!isDefault && i.module === module),
    );

    if (existing) return existing.alias;

    this.importAliasCounter++;
    const alias = noAlias ? undefined : `a${this.importAliasCounter}`;
    imports.push({ isDefault, module, alias });

    return alias;
  }

  addTypeNamespaceImport(from: string, namespace: string) {
    const exists = this.typeNamespaceImports.some(
      (entry) => entry.from === from && entry.namespace === namespace,
    );
    if (!exists) {
      this.typeNamespaceImports.push({ from, namespace });
    }
  }

  protected getImportBlock() {
    const imports: string[] = [];

    Object.keys(this.imports).forEach((from) => {
      const defaultImport = this.imports[from].find((i) => i.isDefault);
      const namedImports = this.imports[from].filter((i) => !i.isDefault);
      const statements: string[] = [];

      if (defaultImport) {
        statements.push(defaultImport.alias || "");
      }

      if (namedImports.length > 0) {
        statements.push(
          `{${namedImports
            .map((i) => (i.alias ? `${i.module} as ${i.alias}` : i.module))
            .join(",")}}`,
        );
      }

      imports.push(`import ${statements.join(",")} from '${from}'`);
    });

    if (imports.length > 0) return imports.join("\n");
  }

  toCode(parser?: "typescript" | "graphql", _pretty = false) {
    const blocks = [...this.codeBlocks];

    if (parser === "typescript") {
      const namespaceBlock = this.typeNamespaceImports
        .map(
          ({ from, namespace }) =>
            `import type * as ${namespace} from '${from}';`,
        )
        .join("\n");
      const importBlock = this.getImportBlock();
      const combined = [namespaceBlock, importBlock].filter(Boolean).join("\n");
      if (combined) blocks.unshift(combined);
    }
    if (parser) {
      return blocks.join("\n\n");
    }
    return blocks.join("");
  }
}
