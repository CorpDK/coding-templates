/** Convert camelCase plural Drizzle export to PascalCase singular GraphQL type. */
export function toGraphqlTypeName(exportName: string): string {
  const singular = exportName.endsWith("ies")
    ? exportName.slice(0, -3) + "y"
    : exportName.endsWith("s")
      ? exportName.slice(0, -1)
      : exportName;
  return singular.charAt(0).toUpperCase() + singular.slice(1);
}

/** GraphQL field basename (camelCase singular). */
export function toGraphqlFieldBasename(exportName: string): string {
  const type = toGraphqlTypeName(exportName);
  return type.charAt(0).toLowerCase() + type.slice(1);
}

/** Plural list field name — uses Drizzle export name as-is when already plural. */
export function toGraphqlListField(exportName: string): string {
  return exportName;
}

/** Map Drizzle camelCase column to GraphQL field (boolean is_* → isActive). */
export function toGraphqlFieldName(drizzleKey: string, physicalName: string): string {
  if (physicalName.startsWith("is_")) {
    const rest = physicalName.slice(3);
    return "is" + rest.charAt(0).toUpperCase() + rest.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  }
  if (physicalName.startsWith("has_")) {
    const rest = physicalName.slice(4);
    return "has" + rest.charAt(0).toUpperCase() + rest.slice(1).replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
  }
  return drizzleKey;
}
