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
  const originalGithubUrl = process.env.NEXT_PUBLIC_GITHUB_URL;
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
    if (originalGithubUrl !== undefined) {
      process.env.NEXT_PUBLIC_GITHUB_URL = originalGithubUrl;
    } else {
      delete process.env.NEXT_PUBLIC_GITHUB_URL;
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
    expect(data).toHaveProperty("commit_sha");
    expect(data).toHaveProperty("build_id");
    expect(data).toHaveProperty("github_run_id");
    expect(data).toHaveProperty("github_run_number");
    expect(data).toHaveProperty("github_repo");
    expect(data).toHaveProperty("app_version");
    expect(data).toHaveProperty("image_digest");
    expect(data).toHaveProperty("container");
    expect(data).toHaveProperty("node_env");
    expect(data).toHaveProperty("timestamp");
    expect(data).toHaveProperty("audit_status");
    expect(data).toHaveProperty("signature_status");
  });

  it("should return 200 status code", () => {
    const response = GET();
    expect(response.status).toBe(200);
  });

  it("should have correct field types", async () => {
    const response = GET();
    const data = await response.json();

    expect(typeof data.commit).toBe("string");
    expect(typeof data.commit_sha).toBe("string");
    expect(typeof data.build_id).toBe("string");
    expect(typeof data.github_run_id).toBe("string");
    expect(typeof data.github_run_number).toBe("string");
    expect(typeof data.github_repo).toBe("string");
    expect(typeof data.app_version).toBe("string");
    expect(typeof data.image_digest).toBe("string");
    expect(typeof data.container).toBe("boolean");
    expect(typeof data.timestamp).toBe("string");
    expect(typeof data.audit_status).toBe("string");
    expect(typeof data.signature_status).toBe("string");
  });

  describe("github_repo field", () => {
    it("should return github_repo from GITHUB_REPOSITORY", async () => {
      process.env.GITHUB_REPOSITORY = "owner/repo";
      delete process.env.NEXT_PUBLIC_GITHUB_URL;

      const response = GET();
      const data = await response.json();

      expect(data.github_repo).toBe("owner/repo");
    });

    it("should fallback to NEXT_PUBLIC_GITHUB_URL without https://github.com/", async () => {
      delete process.env.GITHUB_REPOSITORY;
      process.env.NEXT_PUBLIC_GITHUB_URL = "https://github.com/owner/repo";

      const response = GET();
      const data = await response.json();

      expect(data.github_repo).toBe("owner/repo");
    });

    it("should return empty string when neither GITHUB_REPOSITORY nor NEXT_PUBLIC_GITHUB_URL is set", async () => {
      delete process.env.GITHUB_REPOSITORY;
      delete process.env.NEXT_PUBLIC_GITHUB_URL;

      const response = GET();
      const data = await response.json();

      expect(data.github_repo).toBe("");
    });

    it("should prefer GITHUB_REPOSITORY over NEXT_PUBLIC_GITHUB_URL", async () => {
      process.env.GITHUB_REPOSITORY = "owner/repo1";
      process.env.NEXT_PUBLIC_GITHUB_URL = "https://github.com/owner/repo2";

      const response = GET();
      const data = await response.json();

      expect(data.github_repo).toBe("owner/repo1");
    });
  });

  describe("github_run_id field", () => {
    it("should return github_run_id from GITHUB_RUN_ID", async () => {
      process.env.GITHUB_RUN_ID = "123456789";

      const response = GET();
      const data = await response.json();

      expect(data.github_run_id).toBe("123456789");
    });

    it("should return empty string when GITHUB_RUN_ID is not set", async () => {
      delete process.env.GITHUB_RUN_ID;

      const response = GET();
      const data = await response.json();

      expect(data.github_run_id).toBe("");
    });

    it("should use github_run_id as build_id when set", async () => {
      process.env.GITHUB_RUN_ID = "123456789";
      process.env.APP_COMMIT_SHA = "abc123";

      const response = GET();
      const data = await response.json();

      expect(data.build_id).toBe("123456789");
      expect(data.github_run_id).toBe("123456789");
    });

    it("should fallback build_id to commit SHA when github_run_id is empty", async () => {
      delete process.env.GITHUB_RUN_ID;
      process.env.APP_COMMIT_SHA = "abc123";

      const response = GET();
      const data = await response.json();

      expect(data.build_id).toBe("abc123");
      expect(data.github_run_id).toBe("");
    });
  });

  describe("github_run_number field", () => {
    it("should return github_run_number from GITHUB_RUN_NUMBER", async () => {
      process.env.GITHUB_RUN_NUMBER = "42";

      const response = GET();
      const data = await response.json();

      expect(data.github_run_number).toBe("42");
    });

    it("should return empty string when GITHUB_RUN_NUMBER is not set", async () => {
      delete process.env.GITHUB_RUN_NUMBER;

      const response = GET();
      const data = await response.json();

      expect(data.github_run_number).toBe("");
    });
  });

  describe("audit_status field", () => {
    it("should return audit_status from AUDIT_STATUS", async () => {
      process.env.AUDIT_STATUS = "PASSED";

      const response = GET();
      const data = await response.json();

      expect(data.audit_status).toBe("PASSED");
    });

    it("should return 'UNKNOWN' when AUDIT_STATUS is not set", async () => {
      delete process.env.AUDIT_STATUS;

      const response = GET();
      const data = await response.json();

      expect(data.audit_status).toBe("UNKNOWN");
    });
  });

  describe("signature_status field", () => {
    it("should return signature_status from SIGNATURE_STATUS", async () => {
      process.env.SIGNATURE_STATUS = "SLSA_PROVENANCE_GENERATED";

      const response = GET();
      const data = await response.json();

      expect(data.signature_status).toBe("SLSA_PROVENANCE_GENERATED");
    });

    it("should return 'UNSIGNED' when SIGNATURE_STATUS is not set", async () => {
      delete process.env.SIGNATURE_STATUS;

      const response = GET();
      const data = await response.json();

      expect(data.signature_status).toBe("UNSIGNED");
    });
  });

  describe("timestamp field", () => {
    it("should return timestamp from BUILD_TIMESTAMP when set", async () => {
      const customTimestamp = "2024-01-15T12:00:00.000Z";
      process.env.BUILD_TIMESTAMP = customTimestamp;

      const response = GET();
      const data = await response.json();

      expect(data.timestamp).toBe(customTimestamp);
    });

    it("should generate current ISO timestamp when BUILD_TIMESTAMP is not set", async () => {
      delete process.env.BUILD_TIMESTAMP;

      const beforeCall = new Date().toISOString();
      const response = GET();
      const data = await response.json();
      const afterCall = new Date().toISOString();

      // Verify it's a valid ISO timestamp
      expect(data.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/);
      // Verify it's between the before and after timestamps
      expect(data.timestamp >= beforeCall).toBe(true);
      expect(data.timestamp <= afterCall).toBe(true);
    });
  });

  describe("image_digest field", () => {
    it("should return image_digest from IMAGE_DIGEST when set", async () => {
      process.env.IMAGE_DIGEST = "sha256:abcdef123456";
      process.env.APP_COMMIT_SHA = "commit123";

      const response = GET();
      const data = await response.json();

      expect(data.image_digest).toBe("sha256:abcdef123456");
    });

    it("should fallback to commit SHA when IMAGE_DIGEST is not set", async () => {
      delete process.env.IMAGE_DIGEST;
      process.env.APP_COMMIT_SHA = "commit123";

      const response = GET();
      const data = await response.json();

      expect(data.image_digest).toBe("commit123");
    });

    it("should fallback to 'dev' when neither IMAGE_DIGEST nor APP_COMMIT_SHA is set", async () => {
      delete process.env.IMAGE_DIGEST;
      delete process.env.APP_COMMIT_SHA;

      const response = GET();
      const data = await response.json();

      expect(data.image_digest).toBe("dev");
    });
  });

  describe("commit_sha field", () => {
    it("should return same value as legacy commit field", async () => {
      process.env.APP_COMMIT_SHA = "abc123def456";

      const response = GET();
      const data = await response.json();

      expect(data.commit_sha).toBe("abc123def456");
      expect(data.commit).toBe("abc123def456");
      expect(data.commit_sha).toBe(data.commit);
    });

    it("should both fallback to 'dev' when APP_COMMIT_SHA is not set", async () => {
      delete process.env.APP_COMMIT_SHA;

      const response = GET();
      const data = await response.json();

      expect(data.commit_sha).toBe("dev");
      expect(data.commit).toBe("dev");
      expect(data.commit_sha).toBe(data.commit);
    });
  });
});
