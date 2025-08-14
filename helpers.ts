import Token, { IToken } from "./models/token.js";

export async function getTokensByTags(tags: string[]): Promise<IToken[]> {
  try {
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new Error("Tags must be a non-empty array");
    }

    const tokens = await Token.find({ tags: { $in: tags } });
    console.log(`Found ${tokens.length} tokens for tags:`, tags);
    return tokens;
  } catch (error) {
    console.error("Error fetching tokens by tags:", error);
    throw new Error(`Failed to fetch tokens: ${(error as Error).message}`);
  }
}

export function groupTokensByLocale(
  tokens: IToken[],
): Record<string, string[]> {
  try {
    if (!Array.isArray(tokens)) {
      throw new Error("Tokens must be an array");
    }

    const grouped: Record<string, string[]> = {};
    tokens.forEach((t) => {
      if (!t || !t.token) {
        console.warn("Invalid token object found, skipping:", t);
        return;
      }

      const lang = t.locale || "en";
      if (!grouped[lang]) grouped[lang] = [];
      grouped[lang].push(t.token);
    });

    console.log("Tokens grouped by locale:", Object.keys(grouped).map(locale =>
      `${locale}: ${grouped[locale].length}`
    ));

    return grouped;
  } catch (error) {
    console.error("Error grouping tokens by locale:", error);
    throw new Error(`Failed to group tokens: ${(error as Error).message}`);
  }
}

export function generatePayload(
  localesContent: Record<string, { title: string; text: string }>,
) {
  try {
    if (!localesContent || typeof localesContent !== 'object') {
      throw new Error("Locales content must be an object");
    }

    // Validate structure
    for (const [locale, content] of Object.entries(localesContent)) {
      if (!content || !content.title || !content.text) {
        throw new Error(`Invalid content for locale ${locale}: must have title and text`);
      }
    }

    return { locales: localesContent };
  } catch (error) {
    console.error("Error generating payload:", error);
    throw new Error(`Failed to generate payload: ${(error as Error).message}`);
  }
}

export async function removeInvalidTokens(tokens: string[]): Promise<void> {
  try {
    if (!tokens || tokens.length === 0) {
      console.log("No invalid tokens to remove");
      return;
    }

    if (!Array.isArray(tokens)) {
      throw new Error("Tokens must be an array");
    }

    const validTokens = tokens.filter(token => typeof token === 'string' && token.length > 0);
    if (validTokens.length !== tokens.length) {
      console.warn(`Filtered out ${tokens.length - validTokens.length} invalid token entries`);
    }

    if (validTokens.length === 0) {
      console.log("No valid tokens to remove after filtering");
      return;
    }

    const result = await Token.deleteMany({ token: { $in: validTokens } });
    console.log(`Removed ${result.deletedCount} invalid tokens from database`);
  } catch (error) {
    console.error("Error removing invalid tokens:", error);
    // Don't throw here as this is cleanup - log error but continue
  }
}
