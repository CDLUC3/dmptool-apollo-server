import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get all of the VersionedTemplate for the specified Template (a.k. the Template history)"
    templateVersions(templateId: Int!): [VersionedTemplate]
    "Search for VersionedTemplate whose name or owning Org's name contains the search term"
    publishedTemplates(term: String, paginationOptions: PaginationOptions): PublishedTemplateSearchResults
    "Search for templates for lightweight info on what unique affiliations are in the data set, and whether any of them have best practice"
    publishedTemplatesMetaData(term: String, paginationOptions: PaginationOptions): PublishedTemplateMetaDataResults
    "Get the VersionedTemplates that belong to the current user's affiliation (user must be an Admin)"
    myVersionedTemplates: [VersionedTemplateSearchResult]
  }

  "Template version type"
  enum TemplateVersionType {
    "Draft - saved state for internal review"
    DRAFT
    "Published - saved state for use when creating DMPs"
    PUBLISHED
  }

  type PublishedTemplateMetaDataResults {
    "Whether the result set includes bestPractice templates"
    hasBestPracticeTemplates: Boolean
    "The available affiliations in the result set"
    availableAffiliations: [String]
  }

  type PublishedTemplateSearchResults implements PaginatedQueryResults {
    "The TemplateSearchResults that match the search criteria"
    items: [VersionedTemplateSearchResult]
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

  "An abbreviated view of a Template for pages that allow search/filtering of published Templates"
  type VersionedTemplateSearchResult {
    "The unique identifer for the Object"
    id: Int
    "The id of the template that this version is based on"
    templateId: Int
    "The name/title of the template"
    name: String
    "A description of the purpose of the template"
    description: String
    "The major.minor semantic version"
    version: String
    "The template's availability setting: Public is available to everyone, Private only your affiliation"
    visibility: TemplateVisibility
    "Whether or not this Template is designated as a 'Best Practice' template"
    bestPractice: Boolean
    "The id of the affiliation that owns the Template"
    ownerId: Int
    "The URI of the affiliation that owns the Template"
    ownerURI: String
    "The search name of the affiliation that owns the Template"
    ownerSearchName: String
    "The display name of the affiliation that owns the Template"
    ownerDisplayName: String
    "The name of the last person who modified the Template"
    modifiedById: Int
    "The name of the last person who modified the Template"
    modifiedByName: String
    "The timestamp when the Template was last modified"
    modified: String
  }

  "A snapshot of a Template when it became published. DMPs are created from published templates"
  type VersionedTemplate {
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
    errors: VersionedTemplateErrors

    "The template that this published version stems from"
    template: Template
    "The major.minor semantic version"
    version: String!
    "The publisher of the Template"
    versionedBy: User
    "The type of version: Published or Draft (default: Draft)"
    versionType: TemplateVersionType
    "A comment/note the user enters when publishing the Template"
    comment: String
    "Whether or not this is the version provided when users create a new DMP (default: false)"
    active: Boolean!

    "The name/title of the template"
    name: String!
    "A description of the purpose of the template"
    description: String
    "The owner of the Template"
    owner: Affiliation
    "The template's availability setting: Public is available to everyone, Private only your affiliation"
    visibility: TemplateVisibility!
    "Whether or not this Template is designated as a 'Best Practice' template"
    bestPractice: Boolean!

    "The VersionedSections that go with the VersionedTemplate"
    versionedSections: [VersionedSection!]
  }

  "A collection of errors related to the VersionedTemplate"
  type VersionedTemplateErrors {
    "General error messages such as the object already exists"
    general: String

    templateId: String
    version: String
    versionedById: String
    versionType: String
    comment: String

    name: String
    description: String
    ownerId: String
    visibility: String
    versionedSectionIds: String
  }
`;
