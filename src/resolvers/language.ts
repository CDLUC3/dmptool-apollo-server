import { Language, Resolvers } from "../types.js";
import { defaultLanguageId, supportedLanguages } from "../models/Language.js";

export const resolvers: Resolvers = {
  Query: {
    // Return all of the languages supported by the system
    languages: async (): Promise<Language[]> => {
      return await supportedLanguages.map((entry) => {
        return { ...entry, isDefault: entry.id === defaultLanguageId };
      });
    },
  },
};
