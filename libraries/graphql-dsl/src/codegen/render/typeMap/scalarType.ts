import { GraphQLEnumType, GraphQLScalarType } from "graphql";
import { RenderContext } from "../common/RenderContext.js";
import { Type } from "../../../runtime/types.js";

export const scalarType = (
  type: GraphQLScalarType | GraphQLEnumType,
  _: RenderContext,
): Type<string> => ({});
