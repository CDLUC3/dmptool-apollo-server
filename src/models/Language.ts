// Language is set on the User, Template and DMP as `languageId`

// Languages supported by the application
export const supportedLanguages = [
  { id: "en-US", name: 'English (US)' },
  { id: "pt-BR", name: "Português (Brasil)" },
];

export const supportedLanguageMap = new Map<string, string>(
  supportedLanguages.map(({ id, name }) => [id, name])
);

// The default Language
export const defaultLanguageId = 'en-US';
