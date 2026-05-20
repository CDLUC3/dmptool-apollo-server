import gql from "graphql-tag";
import { mergeTypeDefs } from "@graphql-tools/merge";
import { typeDefs as memberTypeDefs } from "./member"
import { typeDefs as funderTypeDefs } from "./funding"

export const projectTypeDefs = gql`
  extend type Query {
    "Get all of the user's projects"
    myProjects(
      term: String,
      paginationOptions: PaginationOptions,
      filterOptions: ProjectFilterOptions
    ): ProjectSearchResults

    "Get all projects for the Admin based on their role"
    allProjects(
      term: String,
      paginationOptions: PaginationOptions,
      filterOptions: ProjectFilterOptions
    ): ProjectSearchResults

    "Get a specific project"
    project(projectId: Int!): Project

    "Search for projects within external APIs"
    searchExternalProjects(input: ExternalSearchInput!): [ExternalProject]
  }

  extend type Mutation {
    "Create a project"
    addProject(title: String!, isTestProject: Boolean): Project
    "Edit a project"
    updateProject(input: UpdateProjectInput): Project
    "Download the plan"
    archiveProject(projectId: Int!): Project
    "Import a project from an external source"
    projectImport(input: ProjectImportInput): Project
  }

  type ProjectSearchResult {
    "The unique identifer for the Object"
    id: Int
    "The name/title of the research project"
    title: String
    "The research project abstract"
    abstractText: String
    "The estimated date the research project will begin (use YYYY-MM-DD format)"
    startDate: String
    "The estimated date the research project will end (use YYYY-MM-DD format)"
    endDate: String
    "The type of research being done"
    researchDomain: String
    "Whether or not this is test/mock research project"
    isTestProject: Boolean
    "The id of the person who created the project"
    createdById: Int
    "The name of the person who created the project"
    createdByName: String
    "The timestamp when the project was created"
    created: String
    "The id of the person who last modified the project"
    modifiedById: Int
    "The name of the person who last modified the project"
    modifiedByName: String
    "The timestamp when the project was last modified"
    modified: String
    "The names and access levels of the collaborators"
    collaborators: [ProjectSearchResultCollaborator!]
    "The names and roles of the members"
    members: [ProjectSearchResultMember!]
    "The names of the funders"
    fundings: [ProjectSearchResultFunding!]
    "Search results errors"
    errors: ProjectErrors
  }

  type ProjectSearchResults implements PaginatedQueryResults {
    "The TemplateSearchResults that match the search criteria"
    items: [ProjectSearchResult]
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

  "DMP Tool Project type"
  type Project {
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
    errors: ProjectErrors

    "The name/title of the research project"
    title: String!
    "The research project abstract"
    abstractText: String
    "The estimated date the research project will begin (use YYYY-MM-DD format)"
    startDate: String
    "The estimated date the research project will end (use YYYY-MM-DD format)"
    endDate: String
    "The type of research being done"
    researchDomain: ResearchDomain
    "Whether or not this is test/mock research project"
    isTestProject: Boolean

    "People who have access to modify or comment on the Project"
    collaborators: [ProjectCollaborator!]
    "People who are contributing to the research project (not just the DMP)"
    members: [ProjectMember!]
    "The funders who are supporting the research project"
    fundings: [ProjectFunding!]
    "The plans that are associated with the research project"
    plans: [PlanSearchResult!]
    "Indicates that the project is not editable by the user (i.e. readOnly = true means the user cannot edit the project)"
    readOnly: Boolean
  }

  "A collection of errors related to the Project"
  type ProjectErrors {
    "General error messages such as the object already exists"
    general: String

    title: String
    abstractText: String
    startDate: String
    endDate: String
    researchDomainId: String
    memberIds: String
    fundingIds: String
  }

  type ProjectSearchResultCollaborator {
    "The name of the collaborator"
    name: String
    "The access level of the collaborator"
    accessLevel: String
    "The ORCiD ID"
    orcid: String
  }

  type ProjectSearchResultMember {
    "The name of the member"
    name: String
    "The role of the member"
    role: String
    "The ORCiD ID"
    orcid: String
  }

  type ProjectSearchResultFunding {
    "The name of the funder"
    name: String
    "The grant id/url"
    grantId: String
  }

  "Project search filter options"
  input ProjectFilterOptions {
    "Filter results by the plan's status"
    status: PlanStatus
  }

  input UpdateProjectInput {
    "The project's id"
    id: Int!
    "The title of the research project"
    title: String!
    "The research project description/abstract"
    abstractText: String
    "The actual or anticipated start date for the project"
    startDate: String
    "The actual or anticipated end date of the project"
    endDate: String
    "The id of the research domain"
    researchDomainId: Int
    "Whether or not the project is a mock/test"
    isTestProject: Boolean
  }

  input ExternalSearchInput {
    "The URI of the funder we are using to search for projects"
    affiliationId: String!
    "The funder award/grant id/url (optional)"
    awardId: String
    "The funder award/grant name (optional)"
    awardName: String
    "The funder award/grant year (optional) as YYYY"
    awardYear: String
    "The principal investigator names (optional) can be any combination of first/middle/last names"
    piNames: [String]
  }

  "External Project type"
  type ExternalProject {
    "The project title"
    title: String
    "The project description"
    abstractText: String
    "The project start date"
    startDate: String
    "The project end date"
    endDate: String
    "Funding information for this project"
    fundings: [ExternalFunding!]
    "Member information for this project"
    members: [ExternalMember!]
  }

  type ExternalFunding {
    "The funder's unique id/url for the research project (normally assigned after the grant has been awarded)"
    funderProjectNumber: String
    "The funder's unique id/url for the award/grant (normally assigned after the grant has been awarded)"
    grantId: String
    "The funder's unique id/url for the call for submissions to apply for a grant"
    funderOpportunityNumber: String
  }

  type ExternalMember {
    "The ROR ID of the member's institution"
    affiliationId: String
    "The member's first/given name"
    givenName: String
    "The member's last/sur name"
    surName: String
    "The member's ORCID"
    orcid: String
    "The member's email address"
    email: String
  }

  input ProjectImportInput {
    "The external project data"
    project: UpdateProjectInput!
    "The external funding data"
    funding: [AddProjectFundingInput!]
    "The external member data"
    members: [AddProjectMemberInput!]
  }
`;

export const typeDefs = mergeTypeDefs([projectTypeDefs, funderTypeDefs, memberTypeDefs]);
