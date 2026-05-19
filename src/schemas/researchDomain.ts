import gql from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Get all of the top level research domains (the most generic ones)"
    topLevelResearchDomains: [ResearchDomain]
    "Get all of the research domains related to the specified top level domain (more nuanced ones)"
    childResearchDomains(parentResearchDomainId: Int!): [ResearchDomain]
    "Get for research domains by its URI"
    researchDomainByURI(uri: String!): ResearchDomain
  }

  "An aread of research (e.g. Electrical Engineering, Cellular biology, etc.)"
  type ResearchDomain {
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
    errors: ResearchDomainErrors

    "The name of the domain"
    name: String!
    "The taxonomy URL of the research domain"
    uri: String!
    "A description of the type of research covered by the domain"
    description: String
    "The parent research domain (if applicable). If this is blank then it is a top level domain."
    parentResearchDomain: ResearchDomain
    "The ID of the parent research domain (if applicable)"
    parentResearchDomainId: Int
    "The child research domains (if applicable)"
    childResearchDomains: [ResearchDomain!]
  }

  type ResearchDomainSearchResults implements PaginatedQueryResults {
    "The TemplateSearchResults that match the search criteria"
    items: [ResearchDomain]
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

  "A collection of errors related to the ResearchDomain"
  type ResearchDomainErrors {
    "General error messages such as the object already exists"
    general: String

    name: String
    uri: String
    description: String
    parentResearchDomainId: String
    childResearchDomainIds: String
  }
`;
