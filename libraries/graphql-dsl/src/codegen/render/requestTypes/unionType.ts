import { GraphQLUnionType } from "graphql";
function uniq<T>(list: T[]): T[] {
  return [...new Set(list)];
}
import { typeComment } from "../common/comment.js";
import { RenderContext } from "../common/RenderContext.js";
import { requestTypeName } from "./requestTypeName.js";

export const unionType = (type: GraphQLUnionType, ctx: RenderContext) => {
  let types = [...type.getTypes()];
  if (ctx.config?.sortProperties) {
    types = types.sort((a, b) => a.name.localeCompare(b.name));
  }
  const fieldStrings = types.map((t) => `on_${t.name}?:${requestTypeName(t)}`);

  const commonInterfaces = uniq(types.flatMap((x) => x.getInterfaces()));
  fieldStrings.push(
    ...commonInterfaces.map((type) => {
      return `on_${type.name}?: ${requestTypeName(type)}`;
    }),
    "__typename?: boolean | number",
  );

  ctx.addCodeBlock(
    `${typeComment(type)}export interface ${requestTypeName(
      type,
    )}{\n${fieldStrings.map((x) => "    " + x).join(",\n")}\n}`,
  );
};
