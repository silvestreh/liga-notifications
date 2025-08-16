import { Router, Request, Response } from "express";
import { pushQueue } from "../queue.js";
import { authenticateApiKey } from "../middleware/auth.js";
import {
  getTokensByTags,
  groupTokensByLocale,
  generatePayload,
} from "../helpers.js";

const router = Router();

// Send push notification endpoint (requires authentication)
router.post(
  "/send",
  authenticateApiKey,
  async (req: Request, res: Response) => {
    try {
      const { tags, localesContent, metadata } = req.body as {
        tags: string[];
        localesContent: Record<string, { title: string; text: string }>;
        metadata?: Record<string, any>;
      };

      // Input validation
      if (!tags || !Array.isArray(tags) || tags.length === 0) {
        return res
          .status(400)
          .json({ error: "tags must be a non-empty array" });
      }

      if (!localesContent || typeof localesContent !== "object") {
        return res
          .status(400)
          .json({ error: "localesContent must be an object" });
      }

      // Validate localesContent structure
      for (const [locale, content] of Object.entries(localesContent)) {
        if (
          !content ||
          typeof content !== "object" ||
          !content.title ||
          !content.text
        ) {
          return res.status(400).json({
            error: `localesContent.${locale} must have title and text properties`,
          });
        }
        if (
          typeof content.title !== "string" ||
          typeof content.text !== "string"
        ) {
          return res.status(400).json({
            error: `localesContent.${locale}.title and text must be strings`,
          });
        }
      }

      // Validate tags are strings
      if (!tags.every((tag) => typeof tag === "string")) {
        return res.status(400).json({ error: "All tags must be strings" });
      }

      const tokens = await getTokensByTags(tags);

      if (tokens.length === 0) {
        return res.json({
          message: "No devices found for the specified tags",
          totalUsers: 0,
        });
      }

      const groupedTokens = groupTokensByLocale(tokens);
      const payload = generatePayload(localesContent, metadata);

      // Debug: Log the generated payload
      console.log('Generated payload:', JSON.stringify(payload, null, 2));

      let jobsAdded = 0;
      for (const [locale, tokensList] of Object.entries(groupedTokens)) {
        if (payload.locales[locale]) {
          await pushQueue.add("sendPush", {
            tokens: tokensList,
            payload: {
              ...payload.locales[locale],
              metadata: payload.metadata
            },
          });
          jobsAdded++;
        }
      }

      res.json({
        message: "Push notification jobs queued successfully",
        totalUsers: tokens.length,
        jobsAdded,
        locales: Object.keys(groupedTokens),
      });
    } catch (error) {
      res.status(500).json({
        error: "Internal server error",
        message:
          process.env.NODE_ENV === "development"
            ? (error as Error).message
            : undefined,
      });
    }
  },
);

export default router;
