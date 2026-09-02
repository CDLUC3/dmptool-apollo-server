import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Get all GuidanceGroups for the user's organization (or for a specified affiliationId if provided and permitted)"
    guidanceGroups(affiliationId: String): [GuidanceGroup!]!
    "Get a specific GuidanceGroup by ID"
    guidanceGroup(guidanceGroupId: Int!): GuidanceGroup
  }

  extend type Mutation {
    "Create a new GuidanceGroup"
    addGuidanceGroup(input: AddGuidanceGroupInput!): GuidanceGroup!
    "Update an existing GuidanceGroup"
    updateGuidanceGroup(input: UpdateGuidanceGroupInput!): GuidanceGroup!
    "Delete a GuidanceGroup"
    removeGuidanceGroup(guidanceGroupId: Int!): GuidanceGroup!
    "Publish a GuidanceGroup (creates a VersionedGuidanceGroup snapshot)"
    publishGuidanceGroup(guidanceGroupId: Int!): GuidanceGroup!
    "Unpublish a GuidanceGroup (sets active flag to false on current version)"
    unpublishGuidanceGroup(guidanceGroupId: Int!): GuidanceGroup!
  }

  "A GuidanceGroup contains a collection of Guidance items for an organization"
  type GuidanceGroup {
    "The unique identifier for the Object"
    id: Int
    "The user who created the Object"
    createdById: Int
    "The timestamp when the Object was created"
    created: String
    "The user who last modified the Object"
    modifiedById: Int
    "The timestamp when the Object was last modified"
    modified: String
    "Errors associated with the Object"
    errors: GuidanceGroupErrors

    "The affiliation (organization) that owns this GuidanceGroup"
    affiliationId: String!
    "The name of the GuidanceGroup"
    name: String!
    "The description of the GuidanceGroup"
    description: String
    "Whether this GuidanceGroup has been modified since last publish"
    isDirty: Boolean!
    "Whether this is a best practice GuidanceGroup"
    bestPractice: Boolean!
    "Whether this is an optional subset for departmental use"
    optionalSubset: Boolean!
    "The version identifier of the latest published version"
    latestPublishedVersion: String
    "The date when this was last published"
    latestPublishedDate: String

    "The Guidance items in this group"
    guidance: [Guidance!]

    "User who modified the guidance group last"
    modifiedBy: User

    "VersionedGuidanceGroups associated with this GuidanceGroup"
    versionedGuidanceGroup: [VersionedGuidanceGroup]
  }

  "A collection of errors related to the GuidanceGroup"
  type GuidanceGroupErrors {
    "General error messages such as the object already exists"
    general: String

    affiliationId: String
    name: String
    bestPractice: String
    description: String
  }

  "Input for adding a new GuidanceGroup"
  input AddGuidanceGroupInput {
    "The affiliation (organization ror) that owns this GuidanceGroup. Optional: super-admins may set this; regular admins should omit it (their own affiliation will be used)."
    affiliationId: String
    "The name of the GuidanceGroup"
    name: String!
    "The description of the GuidanceGroup"
    description: String
    "Whether this is a best practice GuidanceGroup"
    bestPractice: Boolean
    "Whether this is an optional subset for departmental use"
    optionalSubset: Boolean
  }

  "Input for updating a GuidanceGroup"
  input UpdateGuidanceGroupInput {
    "The unique identifier for the GuidanceGroup to update"
    guidanceGroupId: Int!
    "The name of the GuidanceGroup"
    name: String
    "The description of the GuidanceGroup"
    description: String
    "Whether this is a best practice GuidanceGroup"
    bestPractice: Boolean
    "Whether this is an optional subset for departmental use"
    optionalSubset: Boolean
  }
`;
