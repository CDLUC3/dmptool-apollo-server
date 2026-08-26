import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Get all of the Funding information for the research project"
    projectFundings(projectId: Int!): [ProjectFunding]

    "Get a specific ProjectFunding"
    projectFunding(projectFundingId: Int!): ProjectFunding

    "Get all of the Funding information for the specific Plan"
    planFundings(planId: Int!): [PlanFunding]
  }

  extend type Mutation {
    "Add Funding information to a research project"
    addProjectFunding(input: AddProjectFundingInput!): ProjectFunding
    "Update Funding information on the research project"
    updateProjectFunding(input: UpdateProjectFundingInput!): ProjectFunding
    "Remove Funding from the research project"
    removeProjectFunding(projectFundingId: Int!): ProjectFunding

    "Add Funding information to a Plan"
    addPlanFunding(planId: Int!, projectFundingIds: [Int!]!): Plan
    "Update multiple Plan Fundings passing in an array of projectFundingIds"
    updatePlanFunding(planId: Int!, projectFundingIds: [Int!]!): [PlanFunding]
    "Remove a Funding from a Plan"
    removePlanFunding(planFundingId: Int!): PlanFunding
  }

  "The status of the funding"
  enum ProjectFundingStatus {
    "The project will be submitting a grant, or has not yet heard back from the funder"
    PLANNED
    "The funder did not award the project"
    DENIED
    "The funding has been awarded to the project"
    GRANTED
  }

  "Funding that is supporting a research project"
  type ProjectFunding {
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
    errors: ProjectFundingErrors

    "The project that is seeking (or has aquired) funding"
    project: Project
    "The funder"
    affiliation: Affiliation
    "The status of the funding resquest"
    status: ProjectFundingStatus
    "The funder's unique id/url for the research project (normally assigned after the grant has been awarded)"
    funderProjectNumber: String
    "The funder's unique id/url for the award/grant (normally assigned after the grant has been awarded)"
    grantId: String
    "The funder's unique id/url for the call for submissions to apply for a grant"
    funderOpportunityNumber: String
  }

  "Funding associated with a plan"
  type PlanFunding {
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
    errors: PlanFundingErrors

    "The plan that is seeking (or has aquired) funding"
    plan: Plan
    "The project funder"
    projectFunding: ProjectFunding
  }

  input AddProjectFundingInput {
    "The project"
    projectId: Int
    "The funder URI"
    affiliationId: String!
    "The status of the funding resquest"
    status: ProjectFundingStatus
    "The funder's unique id/url for the research project (normally assigned after the grant has been awarded)"
    funderProjectNumber: String
    "The funder's unique id/url for the award/grant (normally assigned after the grant has been awarded)"
    grantId: String
    "The funder's unique id/url for the call for submissions to apply for a grant"
    funderOpportunityNumber: String
  }

  input UpdateProjectFundingInput {
    "The project funder"
    projectFundingId: Int!
    "The status of the funding resquest"
    status: ProjectFundingStatus
    "The funder's unique id/url for the research project (normally assigned after the grant has been awarded)"
    funderProjectNumber: String
    "The funder's unique id/url for the award/grant (normally assigned after the grant has been awarded)"
    grantId: String
    "The funder's unique id/url for the call for submissions to apply for a grant"
    funderOpportunityNumber: String
  }

  "A collection of errors related to the ProjectFunding"
  type ProjectFundingErrors {
    "General error messages such as the object already exists"
    general: String

    projectId: String
    affiliationId: String
    status: String
    funderProjectNumber: String
    grantId: String
    funderOpportunityNumber: String
  }

  "A collection of errors related to the PlanFunding"
  type PlanFundingErrors {
    "General error messages such as the object already exists"
    general: String

    planId: String
    ProjectFundingId: String
  }
`;
