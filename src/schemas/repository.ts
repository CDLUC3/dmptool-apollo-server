import gql from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Search for repositories from custom database and re3data combined"
    repositories(input: RepositorySearchInput!): RepositorySearchResults
    "Fetch a specific custom repository"
    repository(uri: String!): CustomRepository
    "return all distinct subject area keywords across all repositories"
    repositorySubjectAreas: [String!]
    "return all repositories whose unique uri values are provided"
    repositoriesByURIs(uris: [String!]!): [CustomRepository!]
  }

  extend type Mutation {
    "Add a new Repository"
    addRepository(input: AddRepositoryInput): CustomRepository
    "Update a Repository record"
    updateRepository(input: UpdateRepositoryInput): CustomRepository
    "Delete a Repository"
    removeRepository(repositoryId: Int!): CustomRepository

    "Merge two repositories"
    mergeRepositories(repositoryToKeepId: Int!, repositoryToRemoveId: Int!): CustomRepository
  }

  enum RepositorySource {
    "A custom repository managed in this system"
    CUSTOM
    "A preset repository from re3data"
    RE3DATA
  }

  enum RepositoryType {
    "A discipline specific repository (e.g. GeneCards, Arctic Data Centre, etc.)"
    DISCIPLINARY
    "A generalist repository (e.g. Zenodo, Dryad)"
    GENERALIST
    "An institution specific repository (e.g. ASU Library Research Data Repository, etc.)"
    INSTITUTIONAL
    "A repository that doesn't fit into any of the other categories"
    OTHER
    "A repository owned and managed by a government entity (e.g. NCBI, NASA)"
    GOVERNMENTAL
    "A repository created to support a specific project or initiative (e.g. Human Genome Project)"
    PROJECT_RELATED
    "A repository that accepts any type of dataset, from any discipline. Often used when no disciplinary repository exists."
    MULTI_DISCIPLINARY
  }

  "A custom repository where research outputs are preserved (database-backed)"
  type CustomRepository {
    "The unique identifer for the Object (returns as String for compatibility with Re3DataRepository)"
    id: String!
    "The user who created the Object"
    createdById: Int
    "The timestamp when the Object was created"
    created: String
    "The user who last modified the Object"
    modifiedById: Int
    "The timestamp when the Object was last modifed"
    modified: String
    "Errors associated with the Object"
    errors: RepositoryErrors

    "The name of the repository"
    name: String!
    "The taxonomy URL of the repository"
    uri: String
    "A description of the repository"
    description: String
    "The website URL"
    website: String
    "The re3data identifier if this is a local copy of re3data information (e.g. 'r3d100014782')"
    re3dataId: String
    "Research domains associated with the repository"
    researchDomains: [ResearchDomain!]
    "Keywords to assist in finding the repository"
    keywords: [String!]
    "The Categories/Types of the repository (aliases to repositoryTypes for backwards compatibility)"
    types: [String!]
    "The Categories/Types of the repository"
    repositoryTypes: [String!]
    "The source of this repository"
    source: RepositorySource!
  }

  "A preset repository from re3data (external source)"
  type Re3DataRepository {
    "The unique identifier from re3data"
    id: String!
    "The name of the repository"
    name: String!
    "A description of the repository"
    description: String
    "The homepage URL"
    homepage: String
    "Contact information"
    contact: String
    "The taxonomy URL of the repository"
    uri: String
    "The Categories/Types of the repository (compatible with CustomRepository)"
    types: [String!]
    "The Categories/Types of the repository (alias for types field)"
    repositoryTypes: [String!]
    "Subject areas covered by the repository"
    subjects: [String!]
    "Provider types"
    providerTypes: [String!]
    "Keywords to assist in finding the repository"
    keywords: [String!]
    "Access restrictions"
    access: String
    "Persistent identifier systems supported"
    pidSystem: [String!]
    "Data policies"
    policies: [String!]
    "Upload types supported"
    uploadTypes: [String!]
    "Certifications held"
    certificates: [String!]
    "Software used"
    software: [String!]
    "When the repository record was created"
    createdAt: String
    "When the repository record was last updated"
    updatedAt: String
    "The source of this repository"
    source: RepositorySource!
  }

  "Union type for repository search results (can be custom or re3data)"
  union Repository = CustomRepository | Re3DataRepository

  type RepositorySearchResults implements PaginatedQueryResults {
    "The Repository search results that match the search criteria"
    items: [Repository]
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

  "A collection of errors related to the Repository"
  type RepositoryErrors {
    "General error messages such as the object already exists"
    general: String

    name: String
    uri: String
    description: String
    website: String
    re3dataId: String
    researchDomainIds: String
    keywords: String
    repositoryTypes: String
  }

  input RepositorySearchInput {
    "The search term"
    term: String
    "The repository category/type (for custom repositories)"
    repositoryType: RepositoryType
    "The research domain associated with the repository (for custom repositories)"
    researchDomainId: Int
    "The subject area keyword associated with the repository"
    keyword: String
    "The subject area from re3data (for re3data repositories)"
    subject: String
    "The pagination options"
    paginationOptions: PaginationOptions
  }

  input AddRepositoryInput {
    "The name of the repository"
    name: String!
    "A description of the repository"
    description: String
    "The website URL"
    website: String
    "Research domains associated with the repository"
    researchDomainIds: [Int!]
    "Keywords to assist in finding the repository"
    keywords: [String!]
    "The Categories/Types of the repository"
    repositoryTypes: [String!]
    "The taxonomy URL (do not make this up! should resolve to an HTML/JSON representation of the object)"
    uri: String
    "The re3data identifier if this is a local copy of re3data information (e.g. 'r3d100014782')"
    re3dataId: String
  }

  input UpdateRepositoryInput {
    "The Repository id"
    id: Int!
    "The name of the repository"
    name: String!
    "A description of the repository"
    description: String
    "The website URL"
    website: String
    "Research domains associated with the repository"
    researchDomainIds: [Int!]
    "Keywords to assist in finding the repository"
    keywords: [String!]
    "The Categories/Types of the repository"
    repositoryTypes: [String!]
    "The re3data identifier if this is a local copy of re3data information (e.g. 'r3d100014782')"
    re3dataId: String
  }
`;
