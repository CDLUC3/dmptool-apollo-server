import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Get all of the research output types"
    defaultResearchOutputTypes: [ResearchOutputType]
    "Get the research output type by it's id"
    researchOutputType(id: Int!): ResearchOutputType
    "Get the research output type by it's name"
    researchOutputTypeByName(name: String!): ResearchOutputType
  }

  extend type Mutation {
    "Add a new research output type (name must be unique!)"
    addResearchOutputType(name: String!, description: String): ResearchOutputType
    "Update the research output type"
    updateResearchOutputType(id: Int!, name: String!, description: String): ResearchOutputType
    "Delete the research output type"
    removeResearchOutputType(id: Int!): ResearchOutputType
  }

  type ResearchOutputType {
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
    errors: ResearchOutputTypeErrors

    "The name/label of the research output type"
    name: String!
    "The value/slug of the research output type"
    value: String!
    "A longer description of the research output type useful for tooltips"
    description: String
  }

  "A collection of errors related to the research output type"
  type ResearchOutputTypeErrors {
    "General error messages such as the object already exists"
    general: String

    name: String
    value: String
  }
`;
