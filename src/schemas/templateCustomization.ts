import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get the specified customization (user must be an Admin)"
    templateCustomization(templateCustomizationId: Int!): TemplateCustomization
  }

  extend type Mutation {
    "Add a new customization to a funder template (user must be an Admin)"
    addTemplateCustomization(input: AddTemplateCustomizationInput!): TemplateCustomization!
    "Update a customization (user must be an Admin)"
    updateTemplateCustomization(input: UpdateTemplateCustomizationInput!): TemplateCustomization!
    "Remove a customization (user must be an Admin)"
    removeTemplateCustomization(templateCustomizationId: Int!): TemplateCustomization!
    "Publish a customization (user must be an Admin)"
    publishTemplateCustomization(templateCustomizationId: Int!): TemplateCustomization!
    "Unpublish a customization (user must be an Admin)"
    unpublishTemplateCustomization(templateCustomizationId: Int!): TemplateCustomization!
  }

  "The status of a Template Customization"
  enum TemplateCustomizationStatus {
    "The customization is not currently published"
    DRAFT
    "The customization is published and can be used by researchers"
    PUBLISHED
    "The customization has been archived"
    ARCHIVED
  }

  "The status of a Template Customization with regard to the funder template"
  enum TemplateCustomizationMigrationStatus {
    "The customization is tracking the published version of the funder template"
    OK
    "The customization is tracking an unpublished version of the funder template"
    STALE
    "The customization is tracking a funder template that is no longer published"
    ORPHANED
  }

  "A Customization of a funder template"
  type TemplateCustomization {
    "The unique identifier for the Object"
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
    errors: TemplateCustomizationErrors

    "The affiliation that the customization belongs to"
    affiliationId: String!
    "The current published version of the base funder template"
    currentVersionedTemplateId: Int!
    "The status of the customization"
    status: TemplateCustomizationStatus!
    "The status of the customizations with regard to the base template"
    migrationStatus: TemplateCustomizationMigrationStatus!
    "The date this customization was last published"
    latestPublishedDate: String
    "Whether the customization has been modified since it was last published"
    isDirty: Boolean!
  }

  "A collection of errors related to the Template Customization"
  type TemplateCustomizationErrors {
    "General error messages such as the object already exists"
    general: String

    affiliationId: String
    templateId: String
    currentVersionedTemplateId: String
  }

  "Input parameters for adding a new Template Customization"
  input AddTemplateCustomizationInput {
    versionedTemplateId: Int!
    status: TemplateCustomizationStatus!
  }

  "Input parameters for updating a Template Customization"
  input UpdateTemplateCustomizationInput {
    templateCustomizationId: Int!
    versionedTemplateId: Int!
    status: TemplateCustomizationStatus
  }
`;
