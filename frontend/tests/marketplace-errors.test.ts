import { afterEach, describe, expect, it, vi } from "vitest";
import { api, ApiError } from "@/lib/marketplace";

afterEach(() => vi.unstubAllGlobals());

describe("API field feedback", () => {
  it("keeps structured field errors for local controls alongside the existing summary", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      detail: "Review the highlighted fields.", code: "INVALID_INPUT",
      fields: [{ field: "title", message: "Add a title." }, { field: "condition", message: "Describe its condition." }],
    }), { status: 422, headers: { "Content-Type": "application/json" } })));
    try {
      await api("items", "POST", {});
      throw new Error("Expected rejected fields");
    } catch (error) {
      expect(error).toBeInstanceOf(ApiError);
      const failure = error as ApiError;
      expect(failure.message).toBe("title: Add a title.; condition: Describe its condition.");
      expect(failure.status).toBe(422);
      expect(failure.code).toBe("INVALID_INPUT");
      expect(failure.fields).toEqual([{ field: "title", message: "Add a title." }, { field: "condition", message: "Describe its condition." }]);
    }
  });

  it("ignores malformed field records while retaining a usable error message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      detail: "Try a different username.", fields: [null, "invalid", { field: "username" }],
    }), { status: 409 })));
    await expect(api("auth/register", "POST", {})).rejects.toMatchObject({
      message: "Try a different username.", status: 409, fields: [],
    });
  });
});
