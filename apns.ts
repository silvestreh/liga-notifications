import apn from "apn";
import dotenv from "dotenv";
import fs from "fs";
dotenv.config();

// Helper function to get APN key content
function getApnKeyContent(): string {
  // Option 1: Use base64 encoded key from environment variable (recommended for cloud deployment)
  if (process.env.APN_KEY_CONTENT) {
    try {
      return Buffer.from(process.env.APN_KEY_CONTENT, "base64").toString(
        "utf8",
      );
    } catch (error) {
      throw new Error(
        "Invalid APN_KEY_CONTENT: must be valid base64 encoded .p8 file content",
      );
    }
  }

  // Option 2: Use file path (for local development)
  if (process.env.APN_KEY_PATH) {
    try {
      return fs.readFileSync(process.env.APN_KEY_PATH, "utf8");
    } catch (error) {
      throw new Error(
        `Failed to read APN key file at ${process.env.APN_KEY_PATH}: ${(error as Error).message}`,
      );
    }
  }

  throw new Error(
    "Either APN_KEY_CONTENT (base64) or APN_KEY_PATH must be provided",
  );
}

export const apnProvider = new apn.Provider({
  token: {
    key: getApnKeyContent(),
    keyId: process.env.APN_KEY_ID!,
    teamId: process.env.APN_TEAM_ID!,
  },
  // Use explicit flag so NODE_ENV doesn’t accidentally point to prod endpoint
  production: process.env.APN_PRODUCTION === "true",
});

export async function sendAPNsBatch(
  tokens: string[],
  payload: { title: string; text: string; metadata?: Record<string, any> },
): Promise<string[]> {
  try {
    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      throw new Error("Tokens must be a non-empty array");
    }

    if (!payload || !payload.title || !payload.text) {
      throw new Error("Payload must have title and text properties");
    }

    if (!process.env.APN_BUNDLE_ID) {
      throw new Error("APN_BUNDLE_ID environment variable is required");
    }

    const note = new apn.Notification();
    note.alert = { title: payload.title, body: payload.text };
    note.topic = process.env.APN_BUNDLE_ID;

    // Set additional notification properties for better delivery
    note.sound = "default";
    note.badge = 1;

    // Add custom data/metadata to the notification
    if (payload.metadata && Object.keys(payload.metadata).length > 0) {
      note.payload = payload.metadata;

      // Debug: Log the APNs payload
      console.log('APNs payload with metadata:', JSON.stringify(note.payload, null, 2));
    }

    const results = await Promise.all(
      tokens.map(async (token, index) => {
        try {
          if (!token || typeof token !== "string") {
            console.warn(`Invalid token at index ${index}:`, token);
            return { failed: [{ status: "400", device: token }] };
          }

          return await apnProvider.send(note, token);
        } catch (error) {
          console.error(`Error sending to token ${token}:`, error);
          return { failed: [{ status: "500", device: token }] };
        }
      }),
    );

    const invalidTokens: string[] = [];
    let successCount = 0;

    results.forEach((res, i) => {
      if (res.failed && res.failed.length > 0) {
        res.failed.forEach((fail) => {
          const reason = (fail as any)?.response?.reason;
          // 410 = Gone (token no longer valid)
          // 400 = BadDeviceToken / BadRequest (malformed token)
          // 403 = InvalidProviderToken / other auth issues
          if (fail.status === "410" || fail.status === "400") {
            invalidTokens.push(tokens[i]);
          }
        });
      } else {
        successCount++;
      }
    });

    return invalidTokens;
  } catch (error) {
    console.error("Error in sendAPNsBatch:", error);
    throw new Error(`Failed to send APNs batch: ${(error as Error).message}`);
  }
}
