import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get all Guidance items for a specific GuidanceGroup"
    guidanceByGroup(guidanceGroupId: Int!): [Guidance!]!
    "Get a specific Guidance item by ID"
    guidance(guidanceId: Int!): Guidance
    "Get guidance items for a specific plan and user"
    planGuidance(planId: Int!): [PlanGuidance!]!
    "Get all guidance sources for a plan, optionally filtered by section"
    guidanceSourcesForPlan(planId: Int!, versionedSectionId: Int, versionedQuestionId: Int): [GuidanceSource!]!
  }

  extend type Mutation {
    "Create a new Guidance item"
    addGuidance(input: AddGuidanceInput!): Guidance!
    "Update an existing Guidance item"
    updateGuidance(input: UpdateGuidanceInput!): Guidance!
    "Delete a Guidance item"
    removeGuidance(guidanceId: Int!): Guidance!
    "Add Plan Guidance affiliation for current user"
    addPlanGuidance(planId: Int!, affiliationId: String!): PlanGuidance!
    "Remove Plan Guidance affiliation for current user"
    removePlanGuidance(planId: Int!, affiliationId: String!): PlanGuidance
  }

  "A Guidance item contains guidance text and associated tag id"
  type Guidance {
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
    errors: GuidanceErrors

    "The GuidanceGroup this Guidance belongs to"
    guidanceGroupId: Int!
    "The guidance text content"
    guidanceText: String
    "The tag id associated with this Guidance"
    tagId: Int

    "The GuidanceGroup this Guidance belongs to"
    guidanceGroup: GuidanceGroup

    "The Tag associated with the guidance"
    tag: Tag

    "User who modified the guidance last"
    modifiedBy: User
  }

  "A collection of errors related to Guidance"
  type GuidanceErrors {
    "General error messages such as the object already exists"
    general: String

    guidanceGroupId: String
    guidanceText: String
    tagId: String
  }

  "Input for adding a new Guidance item"
  input AddGuidanceInput {
    "The GuidanceGroup this Guidance belongs to"
    guidanceGroupId: Int!
    "The guidance text content"
    guidanceText: String
    "The Tags associated with this Guidance"
    tagId: Int
  }

  "Input for updating a Guidance item"
  input UpdateGuidanceInput {
    "The unique identifier for the Guidance"
    guidanceId: Int!
    "The guidance text content"
    guidanceText: String
    "The Tags associated with this Guidance"
    tagId: Int
  }

  "Guidance items for a plan and user"
  type PlanGuidance {
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
    errors: PlanGuidanceErrors

    "The id of the plan"
    planId: Int!
    "The id of the affiliation who has the guidance"
    affiliationId: String!
    "The id of the user in the plan who selected the guidance"
    userId: Int!

    "The plan the guidance is associated with"
    plan: Plan
    "The affiliation the guidance is associated with"
    affiliation: Affiliation
    "The user who selected the guidance"
    user: User
  }

  "A collection of errors related to PlanGuidance"
  type PlanGuidanceErrors {
    "General error messages"
    general: String
    planId: String
    affiliationId: String
    userId: String
  }

  "A source of guidance (organization, best practice, etc.)"
  type GuidanceSource {
    "Unique identifier for this guidance source"
    id: String!
    "The type of guidance source"
    type: GuidanceSourceType!
    "Full label/name of the organization"
    label: String!
    "Short name or acronym"
    shortName: String!
    "Organization URI (ROR ID)"
    orgURI: String!
    "Guidance items from this source"
    items: [GuidanceItem!]!
    "Whether this source has any guidance"
    hasGuidance: Boolean!
  }

  "A single guidance item with its content"
  type GuidanceItem {
    "Tag ID this guidance is associated with"
    id: Int
    "Title/name of the tag"
    title: String
    "The guidance text content (HTML)"
    guidanceText: String!
  }

  "Types of guidance sources"
  enum GuidanceSourceType {
    "Best practice guidance from DMP Tool"
    BEST_PRACTICE
    "Guidance from the template owner organization"
    TEMPLATE_OWNER
    "Guidance from the user's affiliation"
    USER_AFFILIATION
    "Guidance from user-selected organizations"
    USER_SELECTED
  }
`;