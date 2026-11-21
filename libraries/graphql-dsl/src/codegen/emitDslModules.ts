import type { GraphQLSchema } from "graphql";
import { RenderContext } from "./render/common/RenderContext.js";
import { renderRequestTypes } from "./render/requestTypes/renderRequestTypes.js";
import { renderTypeMap } from "./render/typeMap/renderTypeMap.js";
import { renderBoundIndex } from "./renderBoundIndex.js";
import type { EmitDslModulesOptions, EmitDslModulesResult } from "./types.js";

export function emitDslModules(
  schema: GraphQLSchema,
  options: EmitDslModulesOptions,
): EmitDslModulesResult {
  const config: EmitDslModulesOptions = {
    sortProperties: true,
    typesNamespace: "Types",
    ...options,
  };

  const selectionCtx = new RenderContext(schema, config);
  if (config.typesImport) {
    selectionCtx.addImport(config.typesImport, false, config.typesNamespace);
  }
  selectionCtx.addImport("@corpdk/graphql-dsl", false, "ExactlyOneField", true);
  renderRequestTypes(schema, selectionCtx);

  const typeMapCtx = new RenderContext(schema, config);
  renderTypeMap(schema, typeMapCtx);

  const selections = selectionCtx.toCode("typescript") ?? "";
  const typeMap = `export default ${typeMapCtx.toCode()}`;
  const index = renderBoundIndex(
    schema,
    config.typesImport,
    config.typesNamespace ?? "Types",
  );

  return { selections, typeMap, index };
}
