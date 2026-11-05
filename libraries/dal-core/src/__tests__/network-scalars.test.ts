import { describe, expect, it } from "vitest";
import {
  parseCitext,
  parseCidr,
  parseDouble,
  parseInet,
  parseMacAddr,
  parseSmallInt,
  serializeCidr,
  serializeCitext,
  serializeInet,
  serializeMacAddr,
} from "../scalars.js";

describe("PostgreSQL network and citext scalars", () => {
  it("parseInet and serializeInet accept graphql-scalars IP wire", () => {
    expect(parseInet("10.0.0.1")).toBe("10.0.0.1");
    expect(serializeInet("10.0.0.1")).toBe("10.0.0.1");
    expect(serializeInet(null)).toBeNull();
    expect(() => parseInet("not-ip")).toThrow();
  });

  it("parseMacAddr and serializeMacAddr accept graphql-scalars MAC wire", () => {
    const mac = "08:00:2B:01:02:03";
    expect(parseMacAddr(mac)).toBe(mac);
    expect(serializeMacAddr(mac)).toBe(mac);
    expect(serializeMacAddr(null)).toBeNull();
  });

  it("parseCitext and serializeCitext enforce string wire", () => {
    expect(parseCitext("Hello")).toBe("Hello");
    expect(serializeCitext("Hello")).toBe("Hello");
    expect(() => parseCitext(1)).toThrow(/string/i);
  });

  it("serializeCidr re-validates stored cidr text", () => {
    expect(serializeCidr("192.0.2.0/24")).toBe("192.0.2.0/24");
    expect(serializeCidr(null)).toBeNull();
    expect(() => serializeCidr("192.0.2.1/24")).toThrow();
  });

  it("parseSmallInt and parseDouble enforce PG bounds", () => {
    expect(parseSmallInt(100)).toBe(100);
    expect(() => parseSmallInt(50_000)).toThrow(/out of range/i);
    expect(parseDouble(1.25)).toBe(1.25);
    expect(() => parseDouble("x")).toThrow();
  });

  it("parseCidr rejects non-string wire", () => {
    expect(() => parseCidr(42)).toThrow(/CIDR/i);
    expect(() => parseCidr("no-prefix")).toThrow(/CIDR/i);
  });
});
