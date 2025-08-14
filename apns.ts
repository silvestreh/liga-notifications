import apn from "apn";
import dotenv from "dotenv";
dotenv.config();

export const apnProvider = new apn.Provider({
  token: {
    key: process.env.APN_KEY_PATH!,
    keyId: process.env.APN_KEY_ID!,
    teamId: process.env.APN_TEAM_ID!,
  },
  production: false,
});

export async function sendAPNsBatch(
  tokens: string[],
  payload: { title: string; text: string },
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

    console.log(`Sending APNs batch to ${tokens.length} devices`);

    const results = await Promise.all(
      tokens.map(async (token, index) => {
        try {
          if (!token || typeof token !== 'string') {
            console.warn(`Invalid token at index ${index}:`, token);
            return { failed: [{ status: "400", device: token }] };
          }

          return await apnProvider.send(note, token);
        } catch (error) {
          console.error(`Error sending to token ${token}:`, error);
          return { failed: [{ status: "500", device: token }] };
        }
      })
    );

    const invalidTokens: string[] = [];
    let successCount = 0;

    results.forEach((res, i) => {
      if (res.failed && res.failed.length > 0) {
        res.failed.forEach((fail) => {
          // 410 = Gone (token no longer valid)
          // 400 = Bad Request (malformed token)
          // 403 = Forbidden (certificate/auth issues)
          if (fail.status === "410" || fail.status === "400") {
            invalidTokens.push(tokens[i]);
            console.log(`Invalid token detected (${fail.status}): ${tokens[i]}`);
          } else {
            console.warn(`APNs delivery failed for token ${tokens[i]} with status ${fail.status}`);
          }
        });
      } else {
        successCount++;
      }
    });

    console.log(`APNs batch completed: ${successCount} successful, ${invalidTokens.length} invalid tokens`);
    return invalidTokens;

  } catch (error) {
    console.error("Error in sendAPNsBatch:", error);
    throw new Error(`Failed to send APNs batch: ${(error as Error).message}`);
  }
}
