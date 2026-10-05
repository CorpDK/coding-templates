# @corpdk/pub-sub

Plugin-style GraphQL pub/sub factory for GraphQL Yoga: in-memory or Redis (`createAppPubSub<T>()`).

Used by DAL-automated data services for subscription topics. Redis wiring uses `@graphql-yoga/redis-event-target` and `ioredis`.

## Install

```bash
pnpm add @corpdk/pub-sub
# or
npm install @corpdk/pub-sub
```

Use the same CalVer as the rest of the DS automation npm set.

## Documentation

- [DS subscription SSE (Yoga)](https://github.com/CorpDK/coding-templates/blob/main/docs/developer/11-ds-subscription-sse.md)
- [Monorepo design — pub/sub](https://github.com/CorpDK/coding-templates/blob/main/docs/architecture/02-monorepo-design.md)
- Package source: [`libraries/pub-sub`](https://github.com/CorpDK/coding-templates/tree/main/libraries/pub-sub)

## License

MIT — see the [repository LICENSE](https://github.com/CorpDK/coding-templates/blob/main/LICENSE).
