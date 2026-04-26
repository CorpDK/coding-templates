# Environment Variables

Each package reads from its own `.env` file. Copy `.env.example` to `.env` in each package you intend to run and fill in the values. No defaults are provided — all values must be explicitly set to avoid port collision surprises.

---

## Data Service Packages

### `ds` (GraphQL Yoga + Prisma)

| Variable       | Description                                                             |
| -------------- | ----------------------------------------------------------------------- |
| `DS_PORT`      | Port the GraphQL Yoga server listens on                                 |
| `DATABASE_URL` | Prisma connection string (PostgreSQL, MySQL, SQLite, CockroachDB)       |
| `REDIS_URL`    | _(optional)_ Redis/Valkey URL — enables Redis pub/sub for subscriptions |

---

### `ds-hprt` (GraphQL Yoga + Drizzle)

| Variable               | Description                                                             |
| ---------------------- | ----------------------------------------------------------------------- |
| `DS_HPRT_PORT`         | Port the GraphQL Yoga server listens on                                 |
| `DS_HPRT_DATABASE_URL` | Drizzle connection string                                               |
| `REDIS_URL`            | _(optional)_ Redis/Valkey URL — enables Redis pub/sub for subscriptions |

---

### `ds-cdb` (GraphQL Yoga + Couchbase)

| Variable                   | Description                             |
| -------------------------- | --------------------------------------- |
| `DS_CDB_PORT`              | Port the GraphQL Yoga server listens on |
| `DS_CDB_CONNECTION_STRING` | Couchbase connection string             |
| `DS_CDB_USERNAME`          | Couchbase username                      |
| `DS_CDB_PASSWORD`          | Couchbase password                      |
| `DS_CDB_BUCKET`            | Couchbase bucket name                   |
| `REDIS_URL`                | _(optional)_ Redis/Valkey URL           |

---

### `ds-mongo` (GraphQL Yoga + MongoDB)

| Variable           | Description                                              |
| ------------------ | -------------------------------------------------------- |
| `DS_MONGO_PORT`    | Port the GraphQL Yoga server listens on                  |
| `DS_MONGO_URL`     | MongoDB connection string (Atlas URI or `mongodb://...`) |
| `DS_MONGO_DB_NAME` | Database name                                            |
| `REDIS_URL`        | _(optional)_ Redis/Valkey URL                            |

---

### `ds-ddb` (GraphQL Yoga + DocumentDB)

| Variable         | Description                             |
| ---------------- | --------------------------------------- |
| `DS_DDB_PORT`    | Port the GraphQL Yoga server listens on |
| `DS_DDB_URL`     | DocumentDB connection string            |
| `DS_DDB_DB_NAME` | Database name                           |
| `REDIS_URL`      | _(optional)_ Redis/Valkey URL           |

---

### `ds-file` (GraphQL Yoga + file storage)

| Variable           | Description                                     |
| ------------------ | ----------------------------------------------- |
| `DS_FILE_PORT`     | Port the GraphQL Yoga server listens on         |
| `DS_FILE_DATA_DIR` | Absolute or relative path to the data directory |
| `DS_FILE_FORMAT`   | Storage format: `json` or `yaml`                |
| `REDIS_URL`        | _(optional)_ Redis/Valkey URL                   |

---

## UI Packages

### `ui` and `ui-hprt`

| Variable                | Description                                                                                                        |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `DS_HTTP_URL`           | Full URL of the DS HTTP endpoint (e.g. `http://localhost:4000/graphql`) — used by Next.js server-side rewrites     |
| `NEXT_PUBLIC_DS_WS_URL` | Full WebSocket URL of the DS endpoint (e.g. `ws://localhost:4000/graphql`) — used by the browser for subscriptions |

`DS_HTTP_URL` is a server-side variable (no `NEXT_PUBLIC_` prefix). It is proxied by Next.js rewrites so the browser never sees the backend origin.

`NEXT_PUBLIC_DS_WS_URL` is exposed to the browser because Next.js cannot proxy WebSocket connections.

---

## Authentication (when using `ui-auth`)

| Variable             | Description                                |
| -------------------- | ------------------------------------------ |
| `AUTH_SECRET`        | Secret used to sign Auth.js session tokens |
| `AUTH_ISSUER`        | OIDC issuer URL of your OAuth2 provider    |
| `AUTH_CLIENT_ID`     | OAuth2 client ID                           |
| `AUTH_CLIENT_SECRET` | OAuth2 client secret                       |

---

**Related**: [Docker Deployment](02-docker-deployment.md) | [PubSub / Redis](03-pubsub-redis.md)

**Last updated**: March 31, 2026
