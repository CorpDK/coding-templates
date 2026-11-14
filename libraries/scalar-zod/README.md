# @corpdk/scalar-zod

Shared **GraphQL scalar validation rules** for DAL servers, client SDKs, and automation CLIs.

| Export | Contents               |
| ------ | ---------------------- |
| `.`    | Generic wire scalars   |
| `./pg` | Postgres-bounded rules |

See [doc 13 §7.7](https://github.com/CorpDK/coding-templates/blob/main/docs/developer/13-graphql-sdk-generator.md). `@corpdk/dal-core` re-exports `dalScalarZod`, `zPgInt32`, and `zPgReal` from `./pg` for backward compatibility.

## License

MIT.
