import {
    GraphQLSchema,
    isInterfaceType,
    isObjectType,
    isUnionType,
    GraphQLObjectType,
} from 'graphql'
import { excludedTypes } from '../common/excludedTypes.js'
import { RenderContext } from '../common/RenderContext.js'
import { objectType } from "./objectType.js";
import { unionType } from "./unionType.js";
import { sortKeys } from "../common/support.js";
import { requestTypeName } from "./requestTypeName.js";

export const renderRequestTypes = (
    schema: GraphQLSchema,
    ctx: RenderContext,
) => {
    ctx.addCodeBlock(
        `import type { ExactlyOneField } from "@corpdk/graphql-dsl";`,
    )

    let typeMap = schema.getTypeMap()

    if (ctx.config?.sortProperties) {
        typeMap = sortKeys(typeMap)
    }

    for (const name in typeMap) {
        if (excludedTypes.includes(name)) continue

        const type = typeMap[name]

        if (isObjectType(type) || isInterfaceType(type)) objectType(type, ctx)
        if (isUnionType(type)) unionType(type, ctx)
    }

    const aliases = [
        { type: schema.getQueryType(), name: "QuerySelection" },
        { type: schema.getMutationType(), name: "MutationSelection" },
        {
            type: schema.getSubscriptionType(),
            name: "SubscriptionSelection",
        },
    ]
        .map(renderAlias)
        .filter(Boolean)
        .join('\n')

    ctx.addCodeBlock(aliases)
}

function renderAlias({
    type,
    name,
}: {
    type?: GraphQLObjectType | null
    name: string
}) {
    if (type && requestTypeName(type) !== name) {
        // TODO make the camel case or kebab case an option
        return `export type ${name} = ${requestTypeName(type)}`
    }
    return ''
}
