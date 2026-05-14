import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get all of the member role types"
    memberRoles: [MemberRole]
    "Get the member role by it's id"
    memberRoleById(memberRoleId: Int!): MemberRole
    "Get the member role by it's URL"
    memberRoleByURL(memberRoleURL: URL!): MemberRole
  }

  extend type Mutation {
    "Add a new member role (URL and label must be unique!)"
    addMemberRole(url: URL!, label: String!, displayOrder: Int!, description: String): MemberRole
    "Update the member role"
    updateMemberRole(id: Int!, url: URL!, label: String!, displayOrder: Int!, description: String): MemberRole
    "Delete the member role"
    removeMemberRole(id: Int!): MemberRole
  }

  type MemberRole {
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
    errors: MemberRoleErrors

    "The order in which to display these items when displayed in the UI"
    displayOrder: Int!
    "The Ui label to display for the member role"
    label: String!
    "The taxonomy URL for the member role"
    uri: String!
    "A longer description of the member role useful for tooltips"
    description: String
    "Whether this is the default role"
    isDefault: Boolean
  }

  "A collection of errors related to the member role"
  type MemberRoleErrors {
    "General error messages such as the object already exists"
    general: String

    uri: String
    label: String
    displayOrder: String
    description: String
  }
`;
