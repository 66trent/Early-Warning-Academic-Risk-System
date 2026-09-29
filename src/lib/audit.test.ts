import { describe, it, expect, vi } from "vitest";
import { writeAuditLog } from "./audit";

describe("writeAuditLog helper", () => {
  it("logs audit payload with timestamp", async () => {
    const consoleSpy = vi.spyOn(console, "info").mockImplementation(() => {});

    await writeAuditLog({
      actorId: "test-user",
      actorRole: "ADMIN",
      action: "TEST_ACTION",
      targetEntity: "System",
    });

    expect(consoleSpy).toHaveBeenCalled();
    const logArg = consoleSpy.mock.calls[0][1];
    const parsed = JSON.parse(logArg as string);
    expect(parsed.actorId).toBe("test-user");
    expect(parsed.action).toBe("TEST_ACTION");
    expect(parsed.timestamp).toBeDefined();

    consoleSpy.mockRestore();
  });
});
