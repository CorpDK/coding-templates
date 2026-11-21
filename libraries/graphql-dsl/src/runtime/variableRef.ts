export interface VariableRef<T = unknown> {
  readonly __var: true;
  readonly name: string;
  readonly __tsBrand?: T;
}

export function isVariableRef(value: unknown): value is VariableRef {
  return (
    typeof value === "object" &&
    value !== null &&
    (value as VariableRef).__var === true &&
    typeof (value as VariableRef).name === "string"
  );
}

/** Placeholder for `define*` variable maps; the key becomes the GraphQL variable name. */
export function v<T = unknown>(): VariableRef<T> {
  return { __var: true, name: "" };
}