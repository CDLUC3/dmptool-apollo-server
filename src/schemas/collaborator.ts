import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get all of the Users that belong to another affiliation that can edit the Template"
    templateCollaborators(templateId: Int!): [TemplateCollaborator]

    "Get all of the Users that are collaborators for the Project"
    projectCollaborators(projectId: Int!): [ProjectCollaborator]

    "Search for a User to add as a collaborator"
    findCollaborator(term: String!, options: PaginationOptions): CollaboratorSearchResults
  }

  extend type Mutation {
    "Add a collaborator to a Template"
    addTemplateCollaborator(templateId: Int!, email: String!): TemplateCollaborator
    "Remove a TemplateCollaborator from a Template"
    removeTemplateCollaborator(templateId: Int!, email: String!): TemplateCollaborator

    "Add a collaborator to a Plan"
    addProjectCollaborator(projectId: Int!, email: String!, accessLevel: ProjectCollaboratorAccessLevel): ProjectCollaborator
    "Change a collaborator's accessLevel on a Plan"
    updateProjectCollaborator(projectCollaboratorId: Int!, accessLevel: ProjectCollaboratorAccessLevel!): ProjectCollaborator
    "Remove a ProjectCollaborator from a Plan"
    removeProjectCollaborator(projectCollaboratorId: Int!): ProjectCollaborator
    "Resend an invite to a ProjectCollaborator"
    resendInviteToProjectCollaborator(projectCollaboratorId: Int!): ProjectCollaborator
  }

  enum ProjectCollaboratorAccessLevel {
    "The user is ONLY able to comment on the Plan's answers"
    COMMENT
    "The user is able to perform most actions on a Project/Plan except (publish, mark as complete and change access)"
    EDIT
    "Has admin rights to project (can invite other users, edit the plans and publish them)"
    OWN
    "The user is able to perform all actions on a Plan (typically restricted to the owner/creator)"
    PRIMARY
  }

  "A user that that belongs to a different affiliation that can edit the Template"
  type TemplateCollaborator {
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
    errors: TemplateCollaboratorErrors

    "The template the collaborator may edit"
    template: Template
    "The collaborator's email"
    email: String!
    "The collaborator (if they have an account)"
    user: User
    "The user who invited the collaborator"
    invitedBy: User
  }

  "A collection of errors related to the TemplateCollaborator"
  type TemplateCollaboratorErrors {
    "General error messages such as the object already exists"
    general: String

    templateId: String
    email: String
    userId: String
    invitedById: String
  }

  "A user that that belongs to a different affiliation that can edit the Plan"
  type ProjectCollaborator {
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
    errors: ProjectCollaboratorErrors

    "The project the collaborator may edit"
    project: Project
    "The project member id"
    projectMemberId: Int
    "The collaborator's email"
    email: String!
    "The collaborator (if they have an account)"
    user: User
    "The user who invited the collaborator"
    invitedBy: User
    "The user's access level"
    accessLevel: ProjectCollaboratorAccessLevel
  }

  "A collection of errors related to the ProjectCollaborator"
  type ProjectCollaboratorErrors {
    "General error messages such as affiliation already exists"
    general: String

    planId: String
    email: String
    userId: String
    invitedById: String
    accessLevel: String
  }

  "The result of the findCollaborator query"
  type CollaboratorSearchResult {
    "The unique identifier for the Object"
    id: Int
    "The collaborator's first/given name"
    givenName: String
    "The collaborator's last/sur name"
    surName: String
    "The collaborator's ORCID"
    orcid: String
    "The collaborator's email"
    email: String
    "The collaborator's affiliation ID (ROR URL)"
    affiliationId: String
    "The collaborator's affiliation name"
    affiliationName: String
    "The affiliation's ROR ID"
    affiliationRORId: String
    "The affiliation's ROR URL"
    affiliationURL: String
  }

  type CollaboratorSearchResults implements PaginatedQueryResults {
    "The TemplateSearchResults that match the search criteria"
    items: [CollaboratorSearchResult]
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
`;
