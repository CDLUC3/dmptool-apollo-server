import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get the overview of the template customization (user must be an Admin)"
    templateCustomizationOverview(templateCustomizationId: Int!): TemplateCustomizationOverview
  }

  extend type Mutation {
    "Add a new customization to a funder template (user must be an Admin)"
    addTemplateCustomization(input: AddTemplateCustomizationInput!): TemplateCustomizationOverview!
    "Update a customization (user must be an Admin)"
    updateTemplateCustomization(input: UpdateTemplateCustomizationInput!): TemplateCustomizationOverview!
    "Remove a customization (user must be an Admin)"
    removeTemplateCustomization(templateCustomizationId: Int!): TemplateCustomizationOverview!
    "Publish a customization (user must be an Admin)"
    publishTemplateCustomization(templateCustomizationId: Int!): TemplateCustomizationOverview!
    "Unpublish a customization (user must be an Admin)"
    unpublishTemplateCustomization(templateCustomizationId: Int!): TemplateCustomizationOverview!
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

  "Whether the object is pinned to an object on the base template or a custom object"
  enum CustomizableObjectOwnership {
    "A Section/Question managed by the funder"
    BASE
    "A Section/Question managed by the affiliation that owns the customization"
    CUSTOM
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

  "An overview of a Template Customization"
  type TemplateCustomizationOverview {
    versionedTemplateId: Int!
    versionedTemplateAffiliationId: String!
    versionedTemplateAffiliationName: String!
    versionedTemplateName: String!
    versionedTemplateVersion: String!
    versionedTemplateLastModified: String!

    customizationId: Int!
    customizationIsDirty: Boolean!
    customizationStatus: TemplateCustomizationStatus!
    customizationMigrationStatus: TemplateCustomizationMigrationStatus!
    customizationLastCustomizedById: Int
    customizationLastCustomizedByName: String
    customizationLastCustomized: String

    sections: [SectionCustomizationOverview!]

    errors: TemplateCustomizationErrors
  }

  "An overview of a Section Customization"
  type SectionCustomizationOverview {
    "Whether the section belongs to a base funder template or to the customizing affiliation"
    sectionType: CustomizableObjectOwnership!
    "The unique identifier for the Section"
    id: Int!
    "The section title"
    name: String!
    "The order of the section within the template"
    displayOrder: Int!
    "The status of the customization with regard to the base template (if applicable)"
    migrationStatus: TemplateCustomizationMigrationStatus
    "Whether the question has custom guidance (only applicable to base funder questions)"
    hasCustomGuidance: Boolean

    "The questions associated with this section"
    questions: [QuestionCustomizationOverview!]
  }

  "An overview of a Question Customization"
  type QuestionCustomizationOverview {
    "Whether the question belongs to a base funder template or to the customizing affiliation"
    questionType: CustomizableObjectOwnership!
    "The unique identifier for the Question"
    id: Int!
    "The question text"
    questionText: String!
    "The position of the question within the section"
    displayOrder: Int!
    "The status of the customization with regard to the base template (if applicable)"
    migrationStatus: TemplateCustomizationMigrationStatus
    "Whether the question has custom guidance (only applicable to base funder questions)"
    hasCustomGuidance: Boolean
    "Whether the question has a custom sample answer (only applicable to base funder questions)"
    hasCustomSampleAnswer: Boolean
  }

  "Input parameters for adding a new Template Customization"
  input AddTemplateCustomizationInput {
    "The id of the published funder template"
    versionedTemplateId: Int!
    "The status of the customization. Defaults to DRAFT if not specified"
    status: TemplateCustomizationStatus!
  }

  "Input parameters for updating a Template Customization"
  input UpdateTemplateCustomizationInput {
    "The id of the published funder template"
    templateCustomizationId: Int!
    "The status of the customization"
    status: TemplateCustomizationStatus
  }
`;
