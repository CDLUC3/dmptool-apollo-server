import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Get all available tags to display"
    tags: [Tag!]!
    tagsBySectionId(sectionId: Int!): [Tag]
  }

  extend type Mutation {
    "Add a new tag to available list of tags"
    addTag(name: String!, description: String): Tag
    "Update a tag"
    updateTag(tagId: Int!, name: String!, description: String ): Tag
    "Delete a tag"
    removeTag(tagId: Int!): Tag
  }

  "A Tag is a way to group similar types of categories together"
  type Tag {
    "The unique identifer for the Object"
    id: Int
    "The user who created the Object"
    createdById: Int
    "The timestamp when the Object was created"
    created: String
    "The user who last modified the Object"
    modifiedById: Int
    "The timestamp when the Object was last modifed"
    modified: String
    "Errors associated with the Object"
    errors: TagErrors

    "The slug"
    slug: String!
    "The tag name"
    name: String!
    "The tag description"
    description: String
  }

  "A collection of errors related to the Tag"
  type TagErrors {
    "General error messages such as the object already exists"
    general: String

    name: String
    description: String
  }

  "Input for Tag operations"
  input TagInput {
    "The unique identifier for the Tag"
    id: Int
    "The name of the Tag"
    name: String
    "The slug of the Tag"
    slug: String
    "The description of the Tag"
    description: String
  }
`;
