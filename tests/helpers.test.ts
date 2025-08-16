import {
  getTokensByTags,
  groupTokensByLocale,
  generatePayload,
  removeInvalidTokens,
} from "../helpers";
import Token from "../models/token";

describe("Helper Functions", () => {
  describe("getTokensByTags", () => {
    beforeEach(async () => {
      // Create test tokens
      await Token.create([
        {
          token: "token1",
          tags: ["sports", "news"],
          locale: "en",
          platform: "ios",
        },
        { token: "token2", tags: ["sports"], locale: "es", platform: "ios" },
        { token: "token3", tags: ["news"], locale: "en", platform: "android" },
        { token: "token4", tags: ["premium"], locale: "fr", platform: "ios" },
      ]);
    });

    it("should return tokens with matching tags", async () => {
      const tokens = await getTokensByTags(["sports"]);
      expect(tokens).toHaveLength(2);
      expect(tokens.map((t) => t.token)).toEqual(
        expect.arrayContaining(["token1", "token2"]),
      );
    });

    it("should return tokens with any of the specified tags", async () => {
      const tokens = await getTokensByTags(["sports", "premium"]);
      expect(tokens).toHaveLength(3);
      expect(tokens.map((t) => t.token)).toEqual(
        expect.arrayContaining(["token1", "token2", "token4"]),
      );
    });

    it("should return empty array for non-existent tags", async () => {
      const tokens = await getTokensByTags(["nonexistent"]);
      expect(tokens).toHaveLength(0);
    });

    it("should throw error for invalid input", async () => {
      await expect(getTokensByTags([])).rejects.toThrow(
        "Tags must be a non-empty array",
      );
      await expect(getTokensByTags(null as any)).rejects.toThrow(
        "Tags must be a non-empty array",
      );
    });
  });

  describe("groupTokensByLocale", () => {
    const mockTokens = [
      { token: "token1", locale: "en" },
      { token: "token2", locale: "es" },
      { token: "token3", locale: "en" },
      { token: "token4", locale: "fr" },
      { token: "token5", locale: null }, // Should default to 'en'
    ] as any[];

    it("should group tokens by locale correctly", () => {
      const grouped = groupTokensByLocale(mockTokens);

      expect(grouped).toEqual({
        en: ["token1", "token3", "token5"],
        es: ["token2"],
        fr: ["token4"],
      });
    });

    it("should handle empty array", () => {
      const grouped = groupTokensByLocale([]);
      expect(grouped).toEqual({});
    });

    it("should handle invalid tokens gracefully", () => {
      const invalidTokens = [
        { token: "valid1", locale: "en" },
        { token: null, locale: "es" }, // Invalid token
        { locale: "fr" }, // Missing token
        { token: "valid2", locale: "en" },
      ] as any[];

      const grouped = groupTokensByLocale(invalidTokens);
      expect(grouped).toEqual({
        en: ["valid1", "valid2"],
      });
    });

    it("should throw error for invalid input", () => {
      expect(() => groupTokensByLocale(null as any)).toThrow(
        "Tokens must be an array",
      );
      expect(() => groupTokensByLocale("invalid" as any)).toThrow(
        "Tokens must be an array",
      );
    });
  });

  describe("generatePayload", () => {
    it("should generate payload correctly", () => {
      const localesContent = {
        en: { title: "Hello", text: "World" },
        es: { title: "Hola", text: "Mundo" },
      };

      const payload = generatePayload(localesContent);
      expect(payload).toEqual({ locales: localesContent, metadata: {} });
    });

    it("should throw error for invalid input", () => {
      expect(() => generatePayload(null as any)).toThrow(
        "Locales content must be an object",
      );
      expect(() => generatePayload("invalid" as any)).toThrow(
        "Locales content must be an object",
      );
    });

    it("should validate content structure", () => {
      const invalidContent = {
        en: { title: "Hello" }, // Missing text
        es: { text: "Mundo" }, // Missing title
      } as any;

      expect(() => generatePayload(invalidContent)).toThrow(
        "Invalid content for locale en",
      );
    });
  });

  describe("removeInvalidTokens", () => {
    beforeEach(async () => {
      // Create test tokens
      await Token.create([
        { token: "valid1", tags: ["test"], locale: "en", platform: "ios" },
        { token: "invalid1", tags: ["test"], locale: "en", platform: "ios" },
        { token: "invalid2", tags: ["test"], locale: "en", platform: "ios" },
        { token: "valid2", tags: ["test"], locale: "en", platform: "ios" },
      ]);
    });

    it("should remove specified tokens", async () => {
      const initialCount = await Token.countDocuments();
      expect(initialCount).toBe(4);

      await removeInvalidTokens(["invalid1", "invalid2"]);

      const remainingTokens = await Token.find().lean();
      expect(remainingTokens).toHaveLength(2);
      expect(remainingTokens.map((t) => t.token)).toEqual(
        expect.arrayContaining(["valid1", "valid2"]),
      );
    });

    it("should handle empty array gracefully", async () => {
      const initialCount = await Token.countDocuments();
      await removeInvalidTokens([]);

      const finalCount = await Token.countDocuments();
      expect(finalCount).toBe(initialCount);
    });

    it("should handle non-existent tokens gracefully", async () => {
      const initialCount = await Token.countDocuments();
      await removeInvalidTokens(["nonexistent1", "nonexistent2"]);

      const finalCount = await Token.countDocuments();
      expect(finalCount).toBe(initialCount);
    });

    it("should filter out invalid token entries", async () => {
      const initialCount = await Token.countDocuments();

      // Mix of valid strings, empty strings, and non-strings
      await removeInvalidTokens([
        "invalid1",
        "",
        null as any,
        "invalid2",
        undefined as any,
      ]);

      const remainingTokens = await Token.find().lean();
      expect(remainingTokens).toHaveLength(2);
      expect(remainingTokens.map((t) => t.token)).toEqual(
        expect.arrayContaining(["valid1", "valid2"]),
      );
    });
  });
});
