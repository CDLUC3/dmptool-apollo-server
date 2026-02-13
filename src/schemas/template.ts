import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get the Templates that belong to the current user's affiliation (user must be an Admin)"
    myTemplates(term: String, paginationOptions: PaginationOptions): TemplateSearchResults
    "Get the specified Template (user must be an Admin)"
    template(templateId: Int!): Template
  }

  extend type Mutation {
    "Create a new Template. Leave the 'copyFromTemplateId' blank to create a new template from scratch"
    addTemplate(name: String!, copyFromTemplateId: Int, copyFromVersionedTemplateId: Int): Template
    "Update a Template"
    updateTemplate(templateId: Int!, name: String!, bestPractice: Boolean): Template
    "Archive a Template (unpublishes any associated PublishedTemplate"
    archiveTemplate(templateId: Int!): Template

    "Publish the template or save as a draft"
    createTemplateVersion(templateId: Int!, comment: String, versionType: TemplateVersionType, latestPublishVisibility: TemplateVisibility!): Template
  }

  "Template visibility"
  enum TemplateVisibility {
    "Visible only to users of your institution/affiliation"
    ORGANIZATION
    "Visible to all users"
    PUBLIC
  }

  "A search result for templates"
  type TemplateSearchResult {
    "The unique identifer for the Object"
    id: Int
    "The name/title of the template"
    name: String
    "A description of the purpose of the template"
    description: String
    "Visibility set for the last published template"
    latestPublishVisibility: TemplateVisibility
    "Whether or not this Template is designated as a 'Best Practice' template"
    bestPractice: Boolean
    "The last published version"
    latestPublishVersion: String
    "The last published date"
    latestPublishDate: String
    "Whether or not the Template has had any changes since it was last published"
    isDirty: Boolean
    "The id of the affiliation that owns the Template"
    ownerId: String
    "The display name of the affiliation that owns the Template"
    ownerDisplayName: String
    "versionedTemplateId of the template"
    latestVersionedTemplateId: Int
    "The id of the person who created the template"
    createdById: Int
    "the name of the person who created the template"
    createdByName: String
    "The timestamp when the Template was created"
    created: String
    "The id of the person who last modified the template"
    modifiedById: Int
    "The name of the person who last modified the template"
    modifiedByName: String
    "The timestamp when the Template was last modified"
    modified: String
  }

   "Paginated results of a search for templates"
   type TemplateSearchResults implements PaginatedQueryResults {
    "The TemplateSearchResults that match the search criteria"
    items: [TemplateSearchResult]
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

  "A Template used to create DMPs"
  type Template {
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
    errors: TemplateErrors

    "The template that this one was derived from"
    sourceTemplateId: Int
    "The versioned template that this one was derived from"
    sourceVersionedTemplateId: Int
    "The name/title of the template"
    name: String!
    "A description of the purpose of the template"
    description: String
    "The affiliation that the template belongs to"
    owner: Affiliation
    "Visibility set for the last published template"
    latestPublishVisibility: TemplateVisibility
    "The last published version"
    latestPublishVersion: String
    "The last published date"
    latestPublishDate: String
    "Whether or not the Template has had any changes since it was last published"
    isDirty: Boolean!
    "Whether or not this Template is designated as a 'Best Practice' template"
    bestPractice: Boolean!
    "The Sections associated with the template"
    sections: [Section]
    "The template's language"
    languageId: String!

    "Users from different affiliations who have been invited to collaborate on this template"
    collaborators: [TemplateCollaborator!]
    "Admin users associated with the template's owner"
    admins: [User!]
  }

  "A collection of errors related to the Template"
  type TemplateErrors {
    "General error messages such as the object already exists"
    general: String

    sourceTemplateId: String
    sourceVersionedTemplateId: String
    name: String
    description: String
    ownerId: String
    latestPublishVisibility: String
    latestPublishVersion: String
    sectionIds: String
    languageId: String
    collaboratorIds: String
  }
`;
