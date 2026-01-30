/**
 * Tests for Notifications module
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  fetchNotifications,
  createNotification,
  markNotificationRead,
} from "../notifications";
import axios from "../axios";

// Mock axios
vi.mock("../axios", () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
  },
}));

describe("Notifications", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("fetchNotifications", () => {
    it("should fetch notifications with default pagination", async () => {
      const mockData = { notifications: [], total: 0 };
      vi.mocked(axios.get).mockResolvedValue({ data: mockData });

      const result = await fetchNotifications();

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("/manage-notifications"),
        { params: { page: 1, limit: 15 } }
      );
      expect(result).toEqual(mockData);
    });

    it("should fetch notifications with custom pagination", async () => {
      const mockData = { notifications: [], total: 0 };
      vi.mocked(axios.get).mockResolvedValue({ data: mockData });

      const result = await fetchNotifications(2, 30);

      expect(axios.get).toHaveBeenCalledWith(
        expect.stringContaining("/manage-notifications"),
        { params: { page: 2, limit: 30 } }
      );
      expect(result).toEqual(mockData);
    });

    it("should return fetched data", async () => {
      const mockData = {
        notifications: [
          { id: 1, title: "Test", description: "Test notification" },
        ],
        total: 1,
      };
      vi.mocked(axios.get).mockResolvedValue({ data: mockData });

      const result = await fetchNotifications();

      expect(result).toEqual(mockData);
    });

    it("should handle fetch errors", async () => {
      const error = new Error("Network error");
      vi.mocked(axios.get).mockRejectedValue(error);

      await expect(fetchNotifications()).rejects.toThrow("Network error");
    });
  });

  describe("createNotification", () => {
    it("should create notification with title and description", async () => {
      const mockData = { id: 1, title: "New", description: "Created" };
      const input = { title: "New", description: "Created" };
      vi.mocked(axios.post).mockResolvedValue({ data: mockData });

      const result = await createNotification(input);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/manage-notifications"),
        input
      );
      expect(result).toEqual(mockData);
    });

    it("should create notification with topic", async () => {
      const mockData = { id: 1, title: "New", description: "Created", topic: "updates" };
      const input = { title: "New", description: "Created", topic: "updates" };
      vi.mocked(axios.post).mockResolvedValue({ data: mockData });

      const result = await createNotification(input);

      expect(axios.post).toHaveBeenCalledWith(
        expect.stringContaining("/manage-notifications"),
        input
      );
      expect(result).toEqual(mockData);
    });

    it("should return created notification data", async () => {
      const mockData = { id: 1, success: true };
      vi.mocked(axios.post).mockResolvedValue({ data: mockData });

      const result = await createNotification({
        title: "Test",
        description: "Test",
      });

      expect(result).toEqual(mockData);
    });

    it("should handle creation errors", async () => {
      const error = new Error("Creation failed");
      vi.mocked(axios.post).mockRejectedValue(error);

      await expect(
        createNotification({ title: "Test", description: "Test" })
      ).rejects.toThrow("Creation failed");
    });
  });

  describe("markNotificationRead", () => {
    it("should mark specific notification as read", async () => {
      const mockData = { success: true };
      vi.mocked(axios.patch).mockResolvedValue({ data: mockData });

      const result = await markNotificationRead(123);

      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/manage-notifications"),
        { id: 123, all: undefined }
      );
      expect(result).toEqual(mockData);
    });

    it("should mark all notifications as read", async () => {
      const mockData = { success: true, count: 5 };
      vi.mocked(axios.patch).mockResolvedValue({ data: mockData });

      const result = await markNotificationRead(undefined, true);

      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/manage-notifications"),
        { id: undefined, all: true }
      );
      expect(result).toEqual(mockData);
    });

    it("should handle both id and all parameters", async () => {
      const mockData = { success: true };
      vi.mocked(axios.patch).mockResolvedValue({ data: mockData });

      const result = await markNotificationRead(456, false);

      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/manage-notifications"),
        { id: 456, all: false }
      );
      expect(result).toEqual(mockData);
    });

    it("should return response data", async () => {
      const mockData = { success: true, updated: 1 };
      vi.mocked(axios.patch).mockResolvedValue({ data: mockData });

      const result = await markNotificationRead(1);

      expect(result).toEqual(mockData);
    });

    it("should handle update errors", async () => {
      const error = new Error("Update failed");
      vi.mocked(axios.patch).mockRejectedValue(error);

      await expect(markNotificationRead(1)).rejects.toThrow("Update failed");
    });

    it("should work with no parameters", async () => {
      const mockData = { success: true };
      vi.mocked(axios.patch).mockResolvedValue({ data: mockData });

      const result = await markNotificationRead();

      expect(axios.patch).toHaveBeenCalledWith(
        expect.stringContaining("/manage-notifications"),
        { id: undefined, all: undefined }
      );
      expect(result).toEqual(mockData);
    });
  });

  describe("API URL construction", () => {
    it("should use correct API endpoint for all functions", async () => {
      vi.mocked(axios.get).mockResolvedValue({ data: {} });
      vi.mocked(axios.post).mockResolvedValue({ data: {} });
      vi.mocked(axios.patch).mockResolvedValue({ data: {} });

      await fetchNotifications();
      await createNotification({ title: "T", description: "D" });
      await markNotificationRead(1);

      const calls = [
        ...(axios.get as any).mock.calls,
        ...(axios.post as any).mock.calls,
        ...(axios.patch as any).mock.calls,
      ];

      calls.forEach((call) => {
        expect(call[0]).toContain("/manage-notifications");
      });
    });
  });
});
