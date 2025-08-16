import Token, { IToken } from "./models/token.js";

export async function getTokensByTags(tags: string[]): Promise<IToken[]> {
  try {
    if (!tags || !Array.isArray(tags) || tags.length === 0) {
      throw new Error("Tags must be a non-empty array");
    }

    const tokens = await Token.find({ tags: { $in: tags } });
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
        return;
      }

      const lang = t.locale || "en";
      if (!grouped[lang]) grouped[lang] = [];
      grouped[lang].push(t.token);
    });

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
    if (!localesContent || typeof localesContent !== "object") {
      throw new Error("Locales content must be an object");
    }

    // Validate structure
    for (const [locale, content] of Object.entries(localesContent)) {
      if (!content || !content.title || !content.text) {
        throw new Error(
          `Invalid content for locale ${locale}: must have title and text`,
        );
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
      return;
    }

    if (!Array.isArray(tokens)) {
      throw new Error("Tokens must be an array");
    }

    const validTokens = tokens.filter(
      (token) => typeof token === "string" && token.length > 0,
    );

    if (validTokens.length === 0) {
      return;
    }

    await Token.deleteMany({ token: { $in: validTokens } });
  } catch (error) {
    console.error("Error removing invalid tokens:", error);
    // Don't throw here as this is cleanup - log error but continue
  }
}
