import { Router, Request, Response } from "express";
import { authenticateApiKey } from "../middleware/auth.js";

const router = Router();

// Register/Update device token endpoint (NO authentication required)
router.post("/register", async (req: Request, res: Response) => {
  try {
    const { token, platform, tags, locale } = req.body as {
      token: string;
      platform?: string;
      tags?: string[];
      locale?: string;
    };

    // Input validation
    if (!token || typeof token !== 'string' || token.trim().length === 0) {
      return res.status(400).json({ error: "token is required and must be a non-empty string" });
    }

    // Validate platform if provided
    const validPlatforms = ['ios', 'android'];
    if (platform && !validPlatforms.includes(platform)) {
      return res.status(400).json({ error: `platform must be one of: ${validPlatforms.join(', ')}` });
    }

    // Validate tags if provided
    if (tags && (!Array.isArray(tags) || !tags.every(tag => typeof tag === 'string'))) {
      return res.status(400).json({ error: "tags must be an array of strings" });
    }

    // Validate locale if provided
    if (locale && (typeof locale !== 'string' || locale.length < 2)) {
      return res.status(400).json({ error: "locale must be a valid language code (e.g., 'en', 'es')" });
    }

    // Import Token model
    const Token = (await import("../models/token.js")).default;

    // Upsert the token (update if exists, create if doesn't)
    const tokenData = await Token.findOneAndUpdate(
      { token: token.trim() },
      {
        token: token.trim(),
        platform: platform || 'ios',
        tags: tags || [],
        locale: locale || 'en',
        lastActive: new Date()
      },
      {
        upsert: true, // Create if doesn't exist
        new: true,    // Return the updated document
        runValidators: true
      }
    );

    console.log(`Token registered/updated: ${token.substring(0, 10)}... with tags: [${(tags || []).join(', ')}]`);

    res.json({
      message: "Device token registered successfully",
      token: {
        id: tokenData._id,
        platform: tokenData.platform,
        tags: tokenData.tags,
        locale: tokenData.locale,
        lastActive: tokenData.lastActive
      }
    });

  } catch (error) {
    console.error("Error in /register:", error);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

// Get device token info endpoint (requires authentication)
router.get("/token/:tokenId", authenticateApiKey, async (req: Request, res: Response) => {
  try {
    const { tokenId } = req.params;

    if (!tokenId || tokenId.length < 10) {
      return res.status(400).json({ error: "tokenId must be at least 10 characters" });
    }

    const Token = (await import("../models/token.js")).default;

    // Search by token string (partial match) or by MongoDB _id
    let tokenData;
    if (tokenId.length === 24 && /^[0-9a-fA-F]{24}$/.test(tokenId)) {
      // Looks like a MongoDB ObjectId
      tokenData = await Token.findById(tokenId);
    } else {
      // Search by token string (partial match for privacy)
      tokenData = await Token.findOne({
        token: { $regex: `^${tokenId.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}` }
      });
    }

    if (!tokenData) {
      return res.status(404).json({ error: "Token not found" });
    }

    res.json({
      token: {
        id: tokenData._id,
        tokenPreview: tokenData.token.substring(0, 10) + '...',
        platform: tokenData.platform,
        tags: tokenData.tags,
        locale: tokenData.locale,
        lastActive: tokenData.lastActive
      }
    });

  } catch (error) {
    console.error("Error in /token/:tokenId:", error);
    res.status(500).json({
      error: "Internal server error",
      message: process.env.NODE_ENV === 'development' ? (error as Error).message : undefined
    });
  }
});

export default router;
