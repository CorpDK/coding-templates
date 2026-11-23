import { GraphQLUnionType } from "graphql";
import { RenderContext } from "../common/RenderContext.js";
import { FieldMap } from "../../../runtime/types.js";
function uniq<T>(list: T[]): T[] {
  return [...new Set(list)];
}

export const unionType = (type: GraphQLUnionType, _: RenderContext) => {
  const types = type.getTypes();
  const typeObj: FieldMap<string> = types.reduce<FieldMap<string>>((r, t) => {
    r[`on_${t.name}`] = { type: t.name };
    return r;
  }, {});

  const commonInterfaces = uniq(types.flatMap((x) => x.getInterfaces()));
  commonInterfaces.forEach((t) => {
    typeObj[`on_${t.name}`] = { type: t.name };
  });

  typeObj.__typename = { type: "String" };

  return typeObj;
};
