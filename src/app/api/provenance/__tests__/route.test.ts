/**
 * Tests for Provenance API Route
 */

import { describe, it, expect, afterEach } from "vitest";
import { GET } from "../route";

describe("Provenance API Route", () => {
  const originalCommitSha = process.env.APP_COMMIT_SHA;
  const originalAppVersion = process.env.NEXT_PUBLIC_APP_VERSION;
  const originalGithubRunId = process.env.GITHUB_RUN_ID;
  const originalGithubRunNumber = process.env.GITHUB_RUN_NUMBER;
  const originalGithubRepository = process.env.GITHUB_REPOSITORY;
  const originalBuildTimestamp = process.env.BUILD_TIMESTAMP;
  const originalAuditStatus = process.env.AUDIT_STATUS;
  const originalSignatureStatus = process.env.SIGNATURE_STATUS;
  const originalImageDigest = process.env.IMAGE_DIGEST;

  afterEach(() => {
    // Restore original environment variables
    if (originalCommitSha !== undefined) {
      process.env.APP_COMMIT_SHA = originalCommitSha;
    } else {
      delete process.env.APP_COMMIT_SHA;
    }
    if (originalAppVersion !== undefined) {
      process.env.NEXT_PUBLIC_APP_VERSION = originalAppVersion;
    } else {
      delete process.env.NEXT_PUBLIC_APP_VERSION;
    }
    if (originalGithubRunId !== undefined) {
      process.env.GITHUB_RUN_ID = originalGithubRunId;
    } else {
      delete process.env.GITHUB_RUN_ID;
    }
    if (originalGithubRunNumber !== undefined) {
      process.env.GITHUB_RUN_NUMBER = originalGithubRunNumber;
    } else {
      delete process.env.GITHUB_RUN_NUMBER;
    }
    if (originalGithubRepository !== undefined) {
      process.env.GITHUB_REPOSITORY = originalGithubRepository;
    } else {
      delete process.env.GITHUB_REPOSITORY;
    }
    if (originalBuildTimestamp !== undefined) {
      process.env.BUILD_TIMESTAMP = originalBuildTimestamp;
    } else {
      delete process.env.BUILD_TIMESTAMP;
    }
    if (originalAuditStatus !== undefined) {
      process.env.AUDIT_STATUS = originalAuditStatus;
    } else {
      delete process.env.AUDIT_STATUS;
    }
    if (originalSignatureStatus !== undefined) {
      process.env.SIGNATURE_STATUS = originalSignatureStatus;
    } else {
      delete process.env.SIGNATURE_STATUS;
    }
    if (originalImageDigest !== undefined) {
      process.env.IMAGE_DIGEST = originalImageDigest;
    } else {
      delete process.env.IMAGE_DIGEST;
    }
  });

  it("should return commit sha from environment", async () => {
    process.env.APP_COMMIT_SHA = "abc123def456";
    delete process.env.GITHUB_RUN_ID; // Ensure GITHUB_RUN_ID is not set

    const response = GET();
    const data = await response.json();

    expect(data.commit).toBe("abc123def456");
    expect(data.build_id).toBe("abc123def456"); // Should fallback to commit SHA when GITHUB_RUN_ID is not set
  });

  it("should return 'dev' when commit sha is not set", async () => {
    delete process.env.APP_COMMIT_SHA;
    delete process.env.GITHUB_RUN_ID; // Ensure GITHUB_RUN_ID is not set

    const response = GET();
    const data = await response.json();

    expect(data.commit).toBe("dev");
    expect(data.build_id).toBe("dev"); // Should fallback to commit SHA ("dev") when GITHUB_RUN_ID is not set
  });

  it("should return app version from environment", async () => {
    process.env.NEXT_PUBLIC_APP_VERSION = "3.0.0";

    const response = GET();
    const data = await response.json();

    expect(data.app_version).toBe("3.0.0");
  });

  it("should return 'dev' for app version when not set", async () => {
    delete process.env.NEXT_PUBLIC_APP_VERSION;

    const response = GET();
    const data = await response.json();

    expect(data.app_version).toBe("dev");
  });

  it("should indicate container status correctly", async () => {
    process.env.APP_COMMIT_SHA = "abc123";

    const response = GET();
    const data = await response.json();

    expect(data.container).toBe(true);

    delete process.env.APP_COMMIT_SHA;
    
    const response2 = GET();
    const data2 = await response2.json();

    expect(data2.container).toBe(false);
  });

  it("should return node environment", async () => {
    const response = GET();
    const data = await response.json();

    // Just verify it returns the current NODE_ENV
    expect(data.node_env).toBeDefined();
    expect(typeof data.node_env).toBe("string");
  });

  it("should return timestamp in ISO format", async () => {
    const response = GET();
    const data = await response.json();

    expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
  });

  it("should have no-cache headers", () => {
    const response = GET();

    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  });

  it("should return all required fields", async () => {
    const response = GET();
    const data = await response.json();

    expect(data).toHaveProperty("commit");
    expect(data).toHaveProperty("build_id");
    expect(data).toHaveProperty("app_version");
    expect(data).toHaveProperty("image_digest");
    expect(data).toHaveProperty("container");
    expect(data).toHaveProperty("node_env");
    expect(data).toHaveProperty("timestamp");
  });

  it("should return 200 status code", () => {
    const response = GET();
    expect(response.status).toBe(200);
  });

  it("should have correct field types", async () => {
    const response = GET();
    const data = await response.json();

    expect(typeof data.commit).toBe("string");
    expect(typeof data.build_id).toBe("string");
    expect(typeof data.app_version).toBe("string");
    expect(typeof data.image_digest).toBe("string");
    expect(typeof data.container).toBe("boolean");
    expect(typeof data.timestamp).toBe("string");
  });
});
