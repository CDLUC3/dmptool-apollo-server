import gql from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Get all of the related works for a project"
    relatedWorksByProject(
      projectId: Int!
      paginationOptions: PaginationOptions
      filterOptions: RelatedWorksFilterOptions
    ): RelatedWorkSearchResults

    "Get all of the related works for a plan"
    relatedWorksByPlan(
      planId: Int!
      paginationOptions: PaginationOptions
      filterOptions: RelatedWorksFilterOptions
    ): RelatedWorkSearchResults

    "Find a work with an identifier"
    findWorkByIdentifier(
      planId: Int!,
      doi: String,
      paginationOptions: PaginationOptions
    ): RelatedWorkSearchResults
  }

  extend type Mutation {
    "Insert or update a related work, the work is looked up in OpenSearch and details added"
    upsertRelatedWork(input: UpsertRelatedWorkInput!): RelatedWorkSearchResult
    "Add a related work manually, by specifying all work details"
    addRelatedWorkManual(input: AddRelatedWorkManualInput!): RelatedWorkSearchResult
    "Update the status of a related work"
    updateRelatedWorkStatus(input: UpdateRelatedWorkStatusInput!): RelatedWorkSearchResult
  }

  type RelatedWorkSearchResults implements PaginatedQueryResults {
    "The TemplateSearchResults that match the search criteria"
    items: [RelatedWorkSearchResult]
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
    "The count of the number of related works after the status filter is applied but doesn't include any other filters"
    statusOnlyCount: Int
    "Counts of work types returned in the query"
    workTypeCounts: [TypeCount!]
    "Count of confidence values returned in the query"
    confidenceCounts: [TypeCount!]
  }

  type TypeCount {
    typeId: String!
    count: Int!
  }

  type RelatedWorkSearchResult {
    "The unique identifier for the Object"
    id: Int
    "The unique identifier of the plan that this related work has been matched to"
    planId: Int
    "The version of the work that the plan was matched to"
    workVersion: WorkVersion!
    "Whether the related work was automatically or manually added"
    sourceType: RelatedWorkSourceType
    "The confidence score indicating how well the work matches the plan"
    score: Float
    "The maximum confidence score returned when this work was matched to the plan"
    scoreMax: Float
    "The normalised confidence score from 0.0-1.0"
    scoreNorm: Float
    "The confidence of the related work match"
    confidence: RelatedWorkConfidence
    "The status of the related work"
    status: RelatedWorkStatus!
    "Details whether the work's DOI was found on a funder award page"
    doiMatch: DoiMatch
    "Details how relevant the title and abstract of the work were to the plan"
    contentMatch: ContentMatch
    "Details which authors matched from the work and the fields they matched on"
    authorMatches: [ItemMatch!]
    "Details which institutions matched from the work and the fields they matched on"
    institutionMatches: [ItemMatch!]
    "Details which funders matched from the work and the fields they matched on"
    funderMatches: [ItemMatch!]
    "Details which awards matched from the work and the fields they matched on"
    awardMatches: [ItemMatch!]
    "The timestamp when the Object was created"
    created: String
    "The user who created the Object. Null if the related work was automatically found"
    createdById: Int
    "The timestamp when the Object was last modified"
    modified: String
    "The user who last modified the Object"
    modifiedById: Int
  }

  type WorkVersion {
    "The unique identifier for the Object"
    id: Int!
    "The work"
    work: Work!
    "A hash of the content of this version of a work"
    hash: MD5!
    "The type of the work"
    workType: WorkType!
    "The date that the work was published YYYY-MM-DD"
    publicationDate: String
    "The title of the work"
    title: String
    "The authors of the work"
    authors: [Author!]!
    "The unique institutions of the authors of the work"
    institutions: [Institution!]!
    "The funders of the work"
    funders: [Funder!]!
    "The awards that funded the work"
    awards: [Award!]!
    "The venue where the work was published, e.g. IEEE Transactions on Software Engineering, Zenodo etc"
    publicationVenue: String
    "The name of the source where the work was found"
    sourceName: String!
    "The URL for the source of the work"
    sourceUrl: String
    "The timestamp when the Object was created"
    created: String!
    "The user who created the Object. Null if the work was automatically found"
    createdById: Int
    "The timestamp when the Object was last modified"
    modified: String!
    "The user who last modified the Object"
    modifiedById: Int
  }

  type Work {
    "The unique identifier for the Object"
    id: Int!
    "The Digital Object Identifier (DOI) of the work"
    doi: String!
    "The timestamp when the Object was created"
    created: String!
    "The user who created the Object. Null if the work was automatically found"
    createdById: Int
    "The timestamp when the Object was last modified"
    modified: String!
    "The user who last modified the Object"
    modifiedById: Int
  }

  "An award that funded a work"
  type Award {
    "The Award ID"
    awardId: String
  }

  "An author of a work"
  type Author {
    "The author's ORCID ID"
    orcid: String
    "The author's first initial"
    firstInitial: String
    "The author's given name"
    givenName: String
    "The author's middle initials"
    middleInitials: String
    "The author's middle names"
    middleNames: String
    "The author's surname"
    surname: String
    "The author's full name"
    full: String
  }

  "An institution of an author of a work"
  type Institution {
    "The name of the institution"
    name: String
    "The ROR ID of the institution"
    ror: String
  }

  "A funder of a work"
  type Funder {
    "The name of the funder"
    name: String
    "The ROR ID of the funder"
    ror: String
  }

  type DoiMatch {
    "Indicates whether the work's DOI was found on a funder award page associated with the plan"
    found: Boolean!
    "A confidence score representing the strength or reliability of the DOI match"
    score: Float!
    "The funder award entries and specific award pages where the DOI was found"
    sources: [DoiMatchSource!]!
  }

  type DoiMatchSource {
    "The parent award ID, if the award has a parent"
    parentAwardId: String
    "The award ID"
    awardId: String!
    "The award URL"
    awardUrl: String!
  }

  type ContentMatch {
    "The confidence score indicating how well the work content matches the plan content"
    score: Float!
    "Highlighted title showing relevant matched terms"
    titleHighlight: String
    "Highlighted fragments from the abstract showing relevant matched terms"
    abstractHighlights: [String!]!
  }

  type ItemMatch {
    "The position of the matched item within the work (zero-based index)"
    index: Int!
    "A confidence score representing how strongly this item matches the corresponding item in the plan"
    score: Float!
    "The specific fields that contributed to the match (e.g. name, orcid etc)"
    fields: [String!]
  }

  "The origin of the related work entry"
  enum RelatedWorkSourceType {
    USER_ADDED
    SYSTEM_MATCHED
  }

  "The type of work"
  enum WorkType {
    ARTICLE
    AUDIO_VISUAL
    BOOK
    BOOK_CHAPTER
    COLLECTION
    DATASET
    DATA_PAPER
    DISSERTATION
    EDITORIAL
    ERRATUM
    EVENT
    GRANT
    IMAGE
    INTERACTIVE_RESOURCE
    LETTER
    LIBGUIDES
    MODEL
    OTHER
    PARATEXT
    PEER_REVIEW
    PHYSICAL_OBJECT
    PREPRINT
    PRE_REGISTRATION
    PROTOCOL
    REFERENCE_ENTRY
    REPORT
    RETRACTION
    REVIEW
    SERVICE
    SOFTWARE
    SOUND
    STANDARD
    SUPPLEMENTARY_MATERIALS
    TEXT
    TRADITIONAL_KNOWLEDGE
    WORKFLOW
  }

  "The confidence of the related work match"
  enum RelatedWorkConfidence {
    "High confidence"
    HIGH
    "Medium confidence"
    MEDIUM
    "Low confidence"
    LOW
  }

  "The status of the related work"
  enum RelatedWorkStatus {
    "The related work is pending assessment by a user"
    PENDING
    "The related work has been marked as related to a plan by a user"
    ACCEPTED
    "The related work has been marked as not related to a plan by a user"
    REJECTED
  }

  "Related work search filter options"
  input RelatedWorksFilterOptions {
    "Filter results by the related work status"
    status: RelatedWorkStatus
    "The confidence of the match"
    confidence: RelatedWorkConfidence
    "The type of work to filter by"
    workType: WorkType
  }

  input AddRelatedWorkManualInput {
    "The unique identifier of the plan that this related work has been matched to"
    planId: Int
    "The Digital Object Identifier (DOI) of the work"
    doi: String!
    "A hash of the content of this version of a work"
    hash: MD5!
    "The type of the work"
    workType: WorkType!
    "The date that the work was published YYYY-MM-DD"
    publicationDate: String
    "The title of the work"
    title: String
    "The abstract of the work"
    abstractText: String
    "The authors of the work"
    authors: [AuthorInput!]!
    "The unique institutions of the authors of the work"
    institutions: [InstitutionInput!]!
    "The funders of the work"
    funders: [FunderInput!]!
    "The awards that funded the work"
    awards: [AwardInput!]!
    "The venue where the work was published, e.g. IEEE Transactions on Software Engineering, Zenodo etc"
    publicationVenue: String
    "The name of the source where the work was found"
    sourceName: String!
    "The URL for the source of the work"
    sourceUrl: String!
  }

  input UpsertRelatedWorkInput {
    "The unique identifier of the plan that this related work has been matched to"
    planId: Int
    "The Digital Object Identifier (DOI) of the work"
    doi: String!
    "A hash of the content of this version of a work"
    hash: MD5!
    "The status to give the related work"
    status: RelatedWorkStatus!
  }

  input UpdateRelatedWorkStatusInput {
    "The related work ID"
    id: Int!
    "The status of the related work"
    status: RelatedWorkStatus
  }

  "An award that funded a work"
  input AwardInput {
    "The Award ID"
    awardId: String!
  }

  "An author of a work"
  input AuthorInput {
    "The author's ORCID ID"
    orcid: String
    "The author's first initial"
    firstInitial: String
    "The author's given name"
    givenName: String
    "The author's middle initials"
    middleInitials: String
    "The author's middle names"
    middleNames: String
    "The author's surname"
    surname: String
    "The author's full name"
    full: String
  }

  "An institution of an author of a work"
  input InstitutionInput {
    "The name of the institution"
    name: String
    "The ROR ID of the institution"
    ror: String
  }

  "A funder of a work"
  input FunderInput {
    "The name of the funder"
    name: String
    "The ROR ID of the funder"
    ror: String
  }

  "Work metadata returned by the OpenSearch works-index"
  type OpenSearchWork {
    "The DOI of the work"
    doi: String!
    "The title of the work"
    title: String
    "The abstract of the work"
    abstractText: String
    "A hash of the content of this version of a work"
    hash: MD5!
    "The type of the work"
    workType: WorkType!
    "The date that the work was published YYYY-MM-DD"
    publicationDate: String
    "The date that the work was updated YYYY-MM-DD"
    updatedDate: String
    "The venue where the work was published, e.g. IEEE Transactions on Software Engineering, Zenodo etc"
    publicationVenue: String
    "The unique institutions of the authors of the work"
    institutions: [Institution!]!
    "The authors of the work"
    authors: [Author!]!
    "The funders of the work"
    funders: [Funder!]!
    "The awards that funded the work"
    awards: [Award!]!
    "The source of the work"
    source: OpenSearchWorkSource!
  }

  type OpenSearchWorkSource {
    "The name of the source where the work was found"
    name: String!
    "The URL for the source of the work"
    url: String
  }
`;
