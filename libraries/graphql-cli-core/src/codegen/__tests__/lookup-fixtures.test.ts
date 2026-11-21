import { describe, expect, it } from "vitest";
import { buildSchema, GraphQLObjectType } from "graphql";
import {
  buildCommandNameMap,
  buildLookupIndex,
  emitSelectionForOperation,
  CodegenError,
  validateLookupConfig,
  emitCliModules,
  extractOperations,
} from "../index.js";

const COMPOSITE_SDL = `
type Query {
  issue(orgId: ID!, number: Int!): Issue
}
type Issue {
  orgId: ID!
  number: Int!
  title: String!
}
`;

const SLUG_SDL = `
type Query {
  project(slug: String!): Project
  team: Team
}
type Team { peer: Project }
type Project {
  slug: String!
  name: String!
}
`;

const TWO_LOOKUPS_SDL = `
type Query {
  user(id: ID!): User
  userByEmail(email: String!): User
  pair: Pair
}
type Pair { mate: User }
type User {
  id: ID!
  email: String!
  name: String!
}
`;

const NODE_INTERFACE_SDL = `
interface Node { id: ID! }
type Query { node(id: ID!): Node team: Team }
type Team { widget: Widget }
type Widget implements Node { id: ID! label: String! }
`;

const NO_LOOKUP_EMBEDDED_SDL = `
type Query { status: Health }
type Health { ok: Boolean! detail: String! }
`;

const NESTED_CONNECTION_SDL = `
type Query { org(id: ID!): Org }
type User { id: ID! name: String! reports(first: Int): UserConnection }
type UserConnection { nodes: [User!]! edges: [UserEdge!]! pageInfo: PageInfo! }
type UserEdge { cursor: String! node: User! }
type PageInfo { hasNextPage: Boolean! }
type Org { id: ID! lead: User! }
`;

const FORCED_STUB_SDL = `
type Query { badge(id: ID!): BadgeView owners: OwnerList }
type OwnerList { member: BadgeView }
type BadgeView { code: String! label: String! }
`;

describe("lookup rule fixtures", () => {
  it("args with GraphQL defaults are optional in catalog", () => {
    const schema = buildSchema(`
      type Query { item(id: ID!, includeDeleted: Boolean = false): Item }
      type Item { id: ID! }
    `);
    const names = buildCommandNameMap(schema, []);
    const idx = buildLookupIndex(schema, names, {});
    const [op] = extractOperations(schema, idx, names, {
      selection: { policy: "relation-ids" },
    });
    const includeDeleted = op.args.find((a) => a.name === "includeDeleted");
    expect(includeDeleted?.required).toBe(false);
    expect(includeDeleted?.defaultValue).toBe(false);
  });
  it("composite key lookup stubs orgId and number", () => {
    const schema = buildSchema(COMPOSITE_SDL);
    const names = buildCommandNameMap(schema, []);
    const idx = buildLookupIndex(schema, names, {});
    const q = schema.getQueryType()!.getFields().issue;
    const { selection, followUps } = emitSelectionForOperation(
      schema,
      idx,
      "issue",
      q.type,
    );
    expect(selection).toMatchObject({
      orgId: true,
      number: true,
      title: true,
    });
    expect(followUps).toHaveLength(0);
  });

  it("non-id key project(slug) lookup", () => {
    const schema = buildSchema(SLUG_SDL);
    const names = buildCommandNameMap(schema, []);
    const idx = buildLookupIndex(schema, names, {});
    const q = schema.getQueryType()!.getFields().project;
    const { selection } = emitSelectionForOperation(
      schema,
      idx,
      "project",
      q.type,
    );
    expect(selection).toMatchObject({ slug: true, name: true });

    const team = schema.getQueryType()!.getFields().team;
    const nested = emitSelectionForOperation(schema, idx, "team", team.type);
    expect(nested.selection.peer).toMatchObject({ slug: true });
    expect(nested.followUps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "peer",
          flags: { slug: "--slug" },
          command: "project",
        }),
      ]),
    );
    void GraphQLObjectType;
  });

  it("chooses lookup per selection.lookup.User", () => {
    const schema = buildSchema(TWO_LOOKUPS_SDL);
    const names = buildCommandNameMap(schema, []);
    const idxDefault = buildLookupIndex(schema, names, {});
    const pair = schema.getQueryType()!.getFields().pair;
    const wrap = emitSelectionForOperation(
      schema,
      idxDefault,
      "pair",
      pair.type,
    );
    expect(wrap.followUps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "user", flags: { id: "--id" } }),
      ]),
    );

    const again = emitSelectionForOperation(
      schema,
      idxDefault,
      "pair",
      pair.type,
      { policy: "relation-ids", lookup: { User: "userByEmail" } },
    );
    expect(again.followUps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          command: "user-by-email",
          flags: { email: "--email" },
        }),
      ]),
    );
    void idxDefault;
  });

  it("node(id) interface lookup stubs id for Widget", () => {
    const schema = buildSchema(NODE_INTERFACE_SDL);
    const names = buildCommandNameMap(schema, []);
    const idx = buildLookupIndex(schema, names, {});
    const team = schema.getQueryType()!.getFields().team;
    const { followUps } = emitSelectionForOperation(
      schema,
      idx,
      "team",
      team.type,
    );
    expect(followUps).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ command: "node", flags: { id: "--id" } }),
      ]),
    );
  });

  it("embedded type with no lookup is expanded", () => {
    const schema = buildSchema(NO_LOOKUP_EMBEDDED_SDL);
    const names = buildCommandNameMap(schema, []);
    const idx = buildLookupIndex(schema, names, {});
    const q = schema.getQueryType()!.getFields().status;
    const { selection } = emitSelectionForOperation(
      schema,
      idx,
      "status",
      q.type,
    );
    expect(selection).toEqual({ ok: true, detail: true });
  });

  it("forced stub via selection.lookup", () => {
    const schema = buildSchema(FORCED_STUB_SDL);
    const names = buildCommandNameMap(schema, []);
    const idx = buildLookupIndex(schema, names, {
      BadgeView: { fields: ["code"] },
    });
    const badgeView = schema.getType("BadgeView") as GraphQLObjectType;
    const q = schema.getQueryType()!.getFields().badge;
    const { selection } = emitSelectionForOperation(
      schema,
      idx,
      "badge",
      q.type,
      { policy: "relation-ids", lookup: { BadgeView: { fields: ["code"] } } },
    );
    expect(selection).toEqual({ code: true, label: true });

    const owners = schema.getQueryType()!.getFields().owners;
    const inner = emitSelectionForOperation(
      schema,
      idx,
      "owners",
      owners.type,
      { policy: "relation-ids", lookup: { BadgeView: { fields: ["code"] } } },
    );
    expect(inner.selection.member).toEqual({ code: true });
    expect(inner.followUps).toHaveLength(0);
    void badgeView;
  });

  it("skips nested connection with warning", () => {
    const schema = buildSchema(NESTED_CONNECTION_SDL);
    const names = buildCommandNameMap(schema, []);
    const idx = buildLookupIndex(schema, names, {});
    const org = schema.getQueryType()!.getFields().org;
    const { selection, warnings } = emitSelectionForOperation(
      schema,
      idx,
      "org",
      org.type,
    );
    expect(selection.lead).toMatchObject({ id: true, name: true });
    expect(selection.lead).not.toHaveProperty("reports");
    expect(warnings.some((w) => w.includes("Nested connection"))).toBe(true);
  });

  it("invalid lookup config throws CodegenError", () => {
    const schema = buildSchema(TWO_LOOKUPS_SDL);
    expect(() =>
      validateLookupConfig(schema, { User: "missingField" }),
    ).toThrow(CodegenError);
    expect(() =>
      validateLookupConfig(schema, {
        User: { fields: ["notAField"] },
      }),
    ).toThrow(/field "notAField"/);
    expect(() =>
      emitCliModules(schema, {
        selection: { policy: "relation-ids", lookup: { Ghost: "nope" } },
      }),
    ).toThrow(CodegenError);
  });

  it("honors selection.lookup on interface fallback", () => {
    const SDL = `
      interface Node { id: ID! }
      type Query { node(id: ID!): Node legacyNode(id: ID!): Node team: Team }
      type Team { widget: Widget }
      type Widget implements Node { id: ID! label: String! }
    `;
    const schema = buildSchema(SDL);
    const names = buildCommandNameMap(schema, []);
    const idx = buildLookupIndex(schema, names, { Node: "legacyNode" });
    const team = schema.getQueryType()!.getFields().team;
    const { followUps } = emitSelectionForOperation(
      schema,
      idx,
      "team",
      team.type,
      { policy: "relation-ids", lookup: { Node: "legacyNode" } },
    );
    expect(followUps).toEqual([
      expect.objectContaining({
        command: "legacy-node",
        flags: { id: "--id" },
        path: "widget",
      }),
    ]);
  });

  it("forced stub types without lookup omit followUps", () => {
    const schema = buildSchema(FORCED_STUB_SDL);
    const names = buildCommandNameMap(schema, []);
    const idx = buildLookupIndex(schema, names, {
      BadgeView: { fields: ["code"] },
    });
    const owners = schema.getQueryType()!.getFields().owners;
    const inner = emitSelectionForOperation(
      schema,
      idx,
      "owners",
      owners.type,
      { policy: "relation-ids", lookup: { BadgeView: { fields: ["code"] } } },
    );
    expect(inner.followUps.every((f) => f.command.length > 0)).toBe(true);
    expect(
      inner.followUps.find(
        (f) => f.type === "BadgeView" && f.path === "member",
      ),
    ).toBeUndefined();
  });
});
