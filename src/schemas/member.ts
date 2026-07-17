import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get all of the Users that a Members to the research project"
    projectMembers(projectId: Int!): [ProjectMember]

    "Get a specific Member on the research project"
    projectMember(projectMemberId: Int!): ProjectMember

    "Get all of the Users that are Members for the specific Plan"
    planMembers(planId: Int!): [PlanMember]
  }

  extend type Mutation {
    "Add a Member to a research project"
    addProjectMember(input: AddProjectMemberInput!): ProjectMember
    "Update a Member on the research project"
    updateProjectMember(input: UpdateProjectMemberInput!): ProjectMember
    "Remove a research project Member"
    removeProjectMember(projectMemberId: Int!): ProjectMember

    "Add a Member to a Plan"
    addPlanMember(planId: Int!, projectMemberId: Int!, roleIds: [Int!]): PlanMember
    "Chnage a Member's accessLevel on a Plan"
    updatePlanMember(planId: Int!, planMemberId: Int!, memberRoleIds: [Int!], isPrimaryContact: Boolean): PlanMember
    "Remove a PlanMember from a Plan"
    removePlanMember(planMemberId: Int!): PlanMember
  }

  "A person involved with a research project"
  type ProjectMember {
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
    errors: ProjectMemberErrors

    "The research project"
    project: Project
    "The Member's affiliation"
    affiliation: Affiliation
    "The Member's first/given name"
    givenName: String
    "The Member's last/sur name"
    surName: String
    "The Member's ORCID"
    orcid: String
    "The Member's email address"
    email: String
    "Whether or not the Member the primary contact for the Plan"
    isPrimaryContact: Boolean
    "The roles the Member has on the research project"
    memberRoles: [MemberRole!]
  }

  "A Member associated with a plan"
  type PlanMember {
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
    errors: PlanMemberErrors

    "The plan that the Member is associated with"
    plan: Plan
    "The project Member"
    projectMember: ProjectMember
    "Whether or not the Member the primary contact for the Plan"
    isPrimaryContact: Boolean
    "The roles associated with the Member"
    memberRoles: [MemberRole!]
  }

  "A collection of errors related to the ProjectMember"
  type ProjectMemberErrors {
    "General error messages such as the object already exists"
    general: String

    projectId: String
    affiliationId: String
    givenName: String
    surName: String
    orcid: String
    email: String
    memberRoleIds: String
  }

  "A collection of errors related to the PlanMember"
  type PlanMemberErrors {
    "General error messages such as affiliation already exists"
    general: String
    "The project that the Member is associated with"
    projectId: String
    "The project Member"
    projectMemberId: String
    "The isPrimaryContact flag"
    primaryContact: String
    "The roles associated with the Member"
    memberRoleIds: String
  }

  input AddProjectMemberInput {
    "The research project"
    projectId: Int!
    "The Member's affiliation URI"
    affiliationId: String
    "The Member's affiliation name"
    affiliationName: String
    "The Member's first/given name"
    givenName: String
    "The Member's last/sur name"
    surName: String
    "The Member's ORCID"
    orcid: String
    "The Member's email address"
    email: String
    "The roles the Member has on the research project"
    memberRoleIds: [Int!]
  }

  input UpdateProjectMemberInput {
    "The project Member"
    projectMemberId: Int!
    "The Member's affiliation URI"
    affiliationId: String
    "The Member's affiliation name"
    affiliationName: String
    "The Member's first/given name"
    givenName: String
    "The Member's last/sur name"
    surName: String
    "The Member's ORCID"
    orcid: String
    "The Member's email address"
    email: String
    "The roles the Member has on the research project"
    memberRoleIds: [Int!]
  }
`;
