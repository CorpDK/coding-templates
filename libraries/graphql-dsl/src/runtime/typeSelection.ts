/*
 * Result selection typing — forked from genql `typeSelection.ts` @ 15f27b9 with L1
 * object-union detection and directive/alias field handling.
 */

export type FieldsSelection<SRC extends Anify<DST> | undefined, DST> = {
  scalar: SRC;
  union: HandleUnion<SRC, DST>;
  object: HandleObject<SRC, DST>;
  array: SRC extends Nil
    ? never
    : SRC extends Array<infer T | null>
      ? Array<FieldsSelection<T, DST>>
      : never;
  __scalar: Handle__scalar<SRC, DST>;
  never: never;
}[DST extends Nil
  ? "never"
  : DST extends false | 0
    ? "never"
    : HasOnFragments<DST> extends true
      ? "union"
      : SRC extends Scalar
        ? "scalar"
        : SRC extends any[]
          ? "array"
          : SRC extends { __isUnion?: unknown }
            ? "union"
            : DST extends { __scalar?: unknown }
              ? "__scalar"
              : DST extends object
                ? "object"
                : "never"];

type HasOnFragments<DST> = DST extends object
  ? {
      [K in keyof DST]: K extends `on_${string}` ? true : never;
    }[keyof DST] extends never
    ? false
    : true
  : false;

type HasDirective<D> = D extends { __include?: unknown } | { __skip?: unknown }
  ? true
  : false;

type StripDirectives<D> = D extends
  | { __include?: unknown }
  | { __skip?: unknown }
  ? keyof Omit<D, "__include" | "__skip"> extends never
    ? true
    : Omit<D, "__include" | "__skip">
  : D;

type WithDirectiveOptionality<T, D> = D extends
  | { __include?: unknown }
  | { __skip?: unknown }
  ? T | undefined
  : T;

type SingleAliasEntry<SRC, Entry> =
  Entry extends Record<string, unknown>
    ? {
        [F in keyof Entry]: F extends keyof SRC
          ? FieldsSelection<SRC[F], Entry[F]>
          : never;
      }[keyof Entry]
    : never;

type AliasFields<SRC, DST> = "__aliases" extends keyof DST
  ? NonNullable<DST["__aliases"]> extends Record<string, unknown>
    ? {
        [Alias in keyof NonNullable<DST["__aliases"]>]: SingleAliasEntry<
          SRC,
          NonNullable<DST["__aliases"]>[Alias]
        >;
      }
    : {}
  : {};

type HandleObject<SRC extends Anify<DST>, DST> = DST extends boolean
  ? SRC
  : SRC extends Nil
    ? never
    : Pick<
        {
          [Key in keyof SRC]: Key extends keyof DST
            ? HasDirective<DST[Key]> extends true
              ? WithDirectiveOptionality<
                  FieldsSelection<SRC[Key], StripDirectives<DST[Key]>>,
                  DST[Key]
                >
              : FieldsSelection<SRC[Key], NonNullable<DST[Key]>>
            : SRC[Key];
        },
        Exclude<keyof DST, FieldsToRemove>
      > &
        AliasFields<SRC, DST>;

type Handle__scalar<SRC extends Anify<DST>, DST> = SRC extends Nil
  ? never
  : Pick<
      {
        [Key in keyof SRC]: Key extends keyof DST
          ? FieldsSelection<SRC[Key], DST[Key]>
          : SRC[Key];
      },
      {
        [Key in keyof SRC]: SRC[Key] extends Nil
          ? never
          : Key extends FieldsToRemove
            ? never
            : SRC[Key] extends Scalar
              ? Key
              : Key extends keyof DST
                ? Key
                : never;
      }[keyof SRC]
    >;

type HandleUnion<SRC, DST> = SRC extends Nil
  ? never
  : HasOnFragments<DST> extends true
    ? UnionFromOnFragments<SRC, DST>
    : Omit<SRC, FieldsToRemove>;

type UnionFromOnFragments<SRC, DST> = UnionOf<
  {
    [K in keyof DST]: K extends `on_${infer Member}`
      ? Member extends string
        ? UnionMemberResult<SRC, Member, DST[K]>
        : never
      : never;
  }[keyof DST]
>;

type UnionOf<T> = [T] extends [never] ? never : T extends infer U ? U : never;

type UnionMemberResult<SRC, Member extends string, Sel> =
  Extract<SRC, { __typename: Member }> extends infer M
    ? M extends { __typename: Member }
      ? { __typename: Member } & FieldsSelection<M, Sel>
      : never
    : never;

type Scalar = string | number | Date | boolean | null | undefined;

type Anify<T> = { [P in keyof T]?: unknown };

type FieldsToRemove =
  | "__isUnion"
  | "__scalar"
  | "__name"
  | "__args"
  | "__aliases"
  | "__include"
  | "__skip";

type Nil = undefined | null;
