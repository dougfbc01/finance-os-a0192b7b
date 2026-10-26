import { describe, expect, it } from "vitest";
import { BaseService, describeError } from "../BaseService";

class ProbeServiceImpl extends BaseService {
  protected readonly serviceName = "ProbeService";
  fail(e: unknown) { return this.handleError(e, "load"); }
}

describe("BaseService.handleError", () => {
  it("turns a Supabase/PostgREST error object into a readable message with the explicit service name", () => {
    const e = { message: "duplicate key value", code: "23505", details: "Key (id)=(1) exists.", hint: "Use upsert" };
    expect(() => new ProbeServiceImpl({} as never).fail(e)).toThrow(
      "[ProbeService:load] duplicate key value (código 23505) — detalhes: Key (id)=(1) exists. — dica: Use upsert",
    );
    expect(describeError(e)).not.toContain("[object Object]");
  });
  it("keeps Error messages and primitives", () => {
    expect(describeError(new Error("boom"))).toBe("boom");
    expect(describeError("x")).toBe("x");
  });
});
