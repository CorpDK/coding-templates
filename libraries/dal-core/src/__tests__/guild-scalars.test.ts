import { describe, expect, it } from "vitest";
import {
  guildParseIP,
  guildParseMAC,
  guildSerializeIP,
  guildSerializeMAC,
} from "../guild-scalars.js";

describe("guild-scalars", () => {
  it("round-trips IP and MAC via graphql-scalars GraphQLIP / GraphQLMAC", () => {
    expect(guildParseIP("192.0.2.1")).toBe("192.0.2.1");
    expect(guildSerializeIP("192.0.2.1")).toBe("192.0.2.1");
    expect(() => guildParseIP("not-an-ip")).toThrow();

    const mac = "08:00:2B:01:02:03";
    expect(guildParseMAC(mac)).toBe(mac);
    expect(guildSerializeMAC(mac)).toBe(mac);
    expect(() => guildParseMAC("bad-mac")).toThrow();
  });
});
