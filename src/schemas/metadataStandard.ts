import gql from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Search for a metadata standard"
    metadataStandards(term: String, researchDomainId: Int, paginationOptions: PaginationOptions): MetadataStandardSearchResults
    "Fetch a specific metadata standard"
    metadataStandard(uri: String!): MetadataStandard
    "return all metadata standards whose unique uri values are provided"
    metadataStandardsByURIs(uris: [String!]!): [MetadataStandard!]
  }

  extend type Mutation {
    "Add a new MetadataStandard"
    addMetadataStandard(input: AddMetadataStandardInput!): MetadataStandard
    "Update a MetadataStandard record"
    updateMetadataStandard(input: UpdateMetadataStandardInput!): MetadataStandard
    "Delete a MetadataStandard"
    removeMetadataStandard(uri: String!): MetadataStandard

    "Merge two metadata standards"
    mergeMetadataStandards(metadataStandardToKeepId: Int!, metadataStandardToRemoveId: Int!): MetadataStandard
  }

  "A metadata standard used when describing a research output"
  type MetadataStandard {
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
    errors: MetadataStandardErrors

    "The name of the metadata standard"
    name: String!
    "The taxonomy URL of the metadata standard"
    uri: String!
    "A description of the metadata standard"
    description: String
    "Research domains associated with the metadata standard"
    researchDomains: [ResearchDomain!]
    "Keywords to assist in finding the metadata standard"
    keywords: [String!]
  }

  type MetadataStandardSearchResults implements PaginatedQueryResults {
    "The TemplateSearchResults that match the search criteria"
    items: [MetadataStandard]
    "The total number of possible items"
    totalCount: Int
    "The number of items returned"
    limit: Int
    "The cursor to use for the next page of results (for infinite scroll/load more)"
    nextCursor: String
    "The current offset of the results (for standard offset pagination)"
    currentOffset: Int
    "Whether or not there is a next page"
    hasNextPage: Boolean
    "Whether or not there is a previous page"
    hasPreviousPage: Boolean
    "The sortFields that are available for this query (for standard offset pagination only!)"
    availableSortFields: [String]
  }

  "A collection of errors related to the MetadataStandard"
  type MetadataStandardErrors {
    "General error messages such as the object already exists"
    general: String

    name: String
    uri: String
    description: String
    researchDomainIds: String
    keywords: String
  }

  input AddMetadataStandardInput {
    "The name of the metadata standard"
    name: String!
    "The taxonomy URL (do not make this up! should resolve to an HTML/JSON representation of the object)"
    uri: String
    "A description of the metadata standard"
    description: String
    "Research domains associated with the metadata standard"
    researchDomainIds: [Int!]
    "Keywords to assist in finding the metadata standard"
    keywords: [String!]
  }

  input UpdateMetadataStandardInput {
    "The id of the MetadataStandard"
    id: Int!
    "The taxonomy URL (do not make this up! should resolve to an HTML/JSON representation of the object)"
    uri: String
    "The name of the metadata standard"
    name: String!
    "A description of the metadata standard"
    description: String
    "Research domains associated with the metadata standard"
    researchDomainIds: [Int!]
    "Keywords to assist in finding the metadata standard"
    keywords: [String!]
  }
`;
