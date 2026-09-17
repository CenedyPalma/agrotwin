import { ApiError, describeError } from "@/services/errors";

describe("describeError", () => {
  it("gives farmer-friendly copy for an offline backend", () => {
    const d = describeError(new ApiError("offline", "Network request failed", { path: "/api/fields" }));
    expect(d.title).toBe("Unable to reach AgroTwin");
    expect(d.retryable).toBe(true);
    expect(d.technical).toContain("/api/fields");
  });
  it("keeps 404 non-retryable and 409 retryable with the backend's own wording", () => {
    expect(describeError(new ApiError("http", "x", { status: 404 })).retryable).toBe(false);
    const busy = describeError(new ApiError("http", "busy", { status: 409, detail: "This survey is being processed" }));
    expect(busy.message).toContain("being processed");
    expect(busy.retryable).toBe(true);
  });
  it("never leaks a stack trace into the headline", () => {
    const d = describeError(new Error("TypeError: undefined is not a function at foo.js:12"));
    expect(d.title).toBe("Something went wrong");
    expect(d.message).not.toContain("foo.js");
    expect(d.technical).toContain("foo.js");
  });
});
