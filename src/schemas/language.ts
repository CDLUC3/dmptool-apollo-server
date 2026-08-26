import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Get all of the supported Languages"
    languages: [Language]
  }

  "A Language supported by the system"
  type Language {
    "The unique identifer for the Language using the 2 character (ISO 639-1) language code and optionally the 2 character (ISO 3166-1) country code"
    id: String!
    "A displayable name for the language"
    name: String!
    "Whether or not the language is the default"
    isDefault: Boolean!
  }
`;
