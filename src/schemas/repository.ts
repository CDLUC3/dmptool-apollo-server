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
    "return all re3data repositories whose unique uri values are provided"
    re3byURIs(uris: [String!]!): [Re3DataRepository!]
    "return all distinct subject strings from re3data with optional counts"
    re3SubjectList(input: Re3SubjectListInput): Re3SubjectListResults!
    "return all distinct repository types from re3data with optional counts"
    re3RepositoryTypesList(input: Re3RepositoryTypesListInput): Re3RepositoryTypesListResults!
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

  """
  Repository type values follow the re3data standard:
  - disciplinary: A discipline specific repository (e.g. GeneCards, Arctic Data Centre, etc.)
  - institutional: An institution specific repository (e.g. ASU Library Research Data Repository, etc.)
  - other: A repository that doesn't fit into any of the other categories
  - multidisciplinary: A repository that accepts any type of dataset, from any discipline
  - project-related: A repository created to support a specific project or initiative (e.g. Human Genome Project)
  - governmental: A repository owned and managed by a government entity (e.g. NCBI, NASA)
  """
  scalar RepositoryTypeValue

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
    "The website URL"
    website: String
    "Contact information"
    contact: String
    "The taxonomy URL of the repository"
    uri: String
    "The Categories/Types of the repository"
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
    created: String
    "When the repository record was last updated"
    modified: String
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
    "The repository category/type (for custom and re3data repositories). Accepts values: disciplinary, institutional, other, multidisciplinary, project-related, governmental"
    repositoryType: String
    "The subject areas from re3data (for re3data repositories). Repositories matching ANY of the provided subjects will be returned. Custom repositories have no subject matching."
    subjects: [String!]
    "The keyword to filter custom repositories by"
    keyword: String
    "The pagination options"
    paginationOptions: PaginationOptions
  }

  input Re3SubjectListInput {
    "Whether to include the count of repositories for each subject"
    includeCount: Boolean
    "Maximum number of distinct subjects to return (default: 100)"
    maxResults: Int
  }

  "A subject area from re3data with optional count"
  type Re3Subject {
    "The subject string"
    subject: String!
    "The count of repositories with this subject (if requested)"
    count: Int
  }

  "Results from re3data subject list query"
  type Re3SubjectListResults {
    "The list of distinct subjects from re3data"
    subjects: [Re3Subject!]!
    "The total number of distinct subjects found"
    totalCount: Int!
  }

  "A repository type from re3data with optional count"
  type Re3RepositoryType {
    "The repository type string"
    type: String!
    "The count of repositories with this type (if requested)"
    count: Int
  }

  "Results from re3data repository types list query"
  type Re3RepositoryTypesListResults {
    "The list of distinct repository types from re3data"
    types: [Re3RepositoryType!]!
    "The total number of distinct repository types found"
    totalCount: Int!
  }

  input Re3RepositoryTypesListInput {
    "Whether to include the count of repositories for each type"
    includeCount: Boolean
    "Maximum number of distinct types to return (default: 100)"
    maxResults: Int
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
