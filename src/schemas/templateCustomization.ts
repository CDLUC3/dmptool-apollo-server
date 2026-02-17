import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get the specified template customization (user must be an Admin)"
    templateCustomization(templateCustomizationId: Int!): TemplateCustomizationOverview!

    "Get the specified section customization (user must be an Admin)"
    sectionCustomization(sectionCustomizationId: Int!): SectionCustomization!
    "Get the specified question customization (user must be an Admin)"
    questionCustomization(questionCustomizationId: Int!): QuestionCustomization!
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

    "Add custom guidance to a funder section"
    addSectionCustomization(input: AddSectionCustomizationInput!): SectionCustomization!
    "Update custom guidance for a funder section"
    updateSectionCustomization(input: UpdateSectionCustomizationInput!): SectionCustomization!
    "Remove custom guidance from a funder section"
    removeSectionCustomization(sectionCustomizationId: Int!): SectionCustomization!
    "Add custom guidance and sample answer to a funder question"
    addQuestionCustomization(input: AddQuestionCustomizationInput!): QuestionCustomization!
    "Update custom guidance and sample answer for a funder question"
    updateQuestionCustomization(input: UpdateQuestionCustomizationInput!): QuestionCustomization!
    "Remove custom guidance and sample answer from a funder question"
    removeQuestionCustomization(questionCustomizationId: Int!): QuestionCustomization!

    "Add a custom section to a funder template"
    addCustomSection(templateCustomizationId: Int!): CustomSection!
    "Update a custom section"
    updateCustomSection(input: UpdateCustomSectionInput!): CustomSection!
    "Remove a custom section"
    removeCustomSection(customSectionId: Int!): CustomSection!
    "Move a custom section to a different position in the template (null means move to the top of the template)"
    moveCustomSection(customSectionId: Int!, newVersionedSectionId: Int): CustomSection!
    "Add a custom question to a funder section"
    addCustomQuestion(input: AddCustomQuestionInput!): CustomQuestion!
    "Update a custom question"
    updateCustomQuestion(input: UpdateCustomQuestionInput!): CustomQuestion!
    "Remove a custom question"
    removeCustomQuestion(customQuestionId: Int!): CustomQuestion!
    "Move a custom question to a different position within the section (null means move to the top of the section)"
    moveCustomQuestion(input: MoveCustomQuestionInput!): CustomQuestion!
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
    customizationLastCustomizedById: Int!
    customizationLastCustomizedByName: String!
    customizationLastCustomized: String!

    sections: [SectionCustomizationOverview!]
  }

  "An overview of a Section Customization"
  type SectionCustomizationOverview {
    "Whether the section belongs to a base funder template or to the customizing affiliation"
    sectionType: CustomizableObjectOwnership!
    "The unique identifier for the Section"
    sectionId: Int!
    "The section title"
    sectionName: String!
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
    questionId: Int!
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

  "Customization of a funder section"
  type SectionCustomization {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The identifier of the published funder section"
    versionedSectionId: Int!
    "The current status of the customization with regard to the base funder template"
    migrationStatus: TemplateCustomizationMigrationStatus

    "Guidance specific to the customizing affiliation's users"
    guidance: String
  }

  "A section created/owned by the affiliation that owns the customization"
  type CustomSection {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The current status of the customization with regard to the base funder template"
    migrationStatus: TemplateCustomizationMigrationStatus

    "The type (BASE: VersionedSection, CUSTOM: CustomSection) this CustomSection is pinned to (null means it is the first section)"
    pinnedSectionType: CustomizableObjectOwnership
    "The id of the VersionedSection or CustomSection this CustomSection is pinned to (null means it is the first section)"
    pinnedSectionId: Int

    "The section title"
    name: String
    "An introduction to the section"
    introduction: String
    "Requirements that a user must consider in this section"
    requirements: String
    "The guidance to help user with answering questions in this section"
    guidance: String
  }

  "Customization of a funder question"
  type QuestionCustomization {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The identifier of the published funder question"
    versionedQuestionId: Int!
    "The current status of the customization with regard to the base funder template"
    migrationStatus: TemplateCustomizationMigrationStatus
    "Guidance specific to the customizing affiliation's users"
    guidanceText: String
    "A sample answer specific to the customizing affiliation's users"
    sampleText: String
  }

  "A question created/owned by the affiliation that owns the customization"
  type CustomQuestion {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The current status of the customization with regard to the base funder template"
    migrationStatus: TemplateCustomizationMigrationStatus!

    "The type of the section (VersionedSection or CustomSection) this question belongs to"
    sectionType: CustomizableObjectOwnership!
    "The id of the section this question belongs to"
    sectionId: Int!
    "The type (BASE: VersionedQuestion, CUSTOM: CustomQuestion) this CustomQuestion is pinned to (null means it is the first question in the section)"
    pinnedSectionType: CustomizableObjectOwnership
    "The id of the VersionedQuestion or CustomQuestion this CustomQuestion is pinned to (null means it is the first question in the section)"
    pinnedSectionId: Int

    "The question text"
    questionText: String
    "The JSON representation of the question type"
    json: String
    "Requirements a user must consider when answering this question"
    requirementText: String
    "Guidance to help the user answer the question"
    guidanceText: String
    "An example answer for the question"
    sampleText: String
    "Whether the sample answer should be used as the default answer"
    useSampleTextAsDefault: Boolean
    "Whether the user is required to answer the question"
    required: Boolean
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
    "The id of the published funder template"
    versionedTemplateId: Int!
    "The status of the customization"
    status: TemplateCustomizationStatus
  }

  "Input parameters for adding custom guidance to a funder section"
  input AddSectionCustomizationInput {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The identifier of the published funder section"
    versionedSectionId: Int!
  }

  "Input parameters for updating custom guidance to a funder section"
  input UpdateSectionCustomizationInput {
    "The identifier of the parent template customization"
    sectionCustomizationId: Int!
    "The custom guidance for the section"
    guidance: String
  }

  "Input parameters for adding custom guidance and sample text to a funder question"
  input AddQuestionCustomizationInput {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The identifier of the published funder section the question belongs to"
    versionedSectionId: Int!
    "The identifier of the published funder question"
    versionedQuestionId: Int!
  }

  "Input parameters for updating custom guidance and sample text to a funder question"
  input UpdateQuestionCustomizationInput {
    "The identifier of the parent template customization"
    questionCustomizationId: Int!
    "The custom guidance for the question"
    guidanceText: String
    "The sample answer for the question"
    sampleText: String
  }

  "Input parameters for updating a custom section"
  input UpdateCustomSectionInput {
    "The id of the custom section"
    customSectionId: Int!
    "The custom section name"
    name: String!
    "The introduction to the custom section"
    introduction: String
    "The requirements for the custom section"
    requirements: String
    "The custom guidance for the custom section"
    guidance: String
  }

  "Move a custom section to a different position in the template (null means move to the top of the template)"
  input MoveCustomSectionInput {
    "the id of the custom section to move"
    customSectionId: Int!
    "The type of the section (BASE: VersionedSection, CUSTOM: CustomSection) this CustomSection will be pinned to (null means it is the first section in the template)"
    sectionType: CustomizableObjectOwnership
    "The id of the section this CustomSection will be pinned to (null means it is the first section in the template)"
    sectionId: Int
  }

  "Input parameters for adding a custom section to a funder template"
  input AddCustomQuestionInput {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The identifier of the published funder section"
    versionedSectionId: Int!
  }
  "Input parameters for updating a custom section"
  input UpdateCustomQuestionInput {
    "The id of the custom question"
    customQuestionId: Int!
    "The custom question text"
    questionText: String!
    "The custom question JSON"
    json: String!
    "The custom question requirements"
    requirementText: String
    "The custom question guidance"
    guidanceText: String
    "The custom question sample answer"
    sampleText: String
    "Whether the sample answer should be used as the default answer"
    useSampleTextAsDefault: Boolean!
    "Whether the user is required to answer the question"
    required: Boolean!
  }

  "Move a custom question to a different position within the section (null means move to the top of the section)"
  input MoveCustomQuestionInput {
    "the id of the custom question to move"
    customQuestionId: Int!
    "The type of the question (BASE: VersionedQuestion, CUSTOM: CustomQuestion) this CustomQuestion will be pinned to (null means it is the first question in the section)"
    questionType: CustomizableObjectOwnership
    "The id of the section this CustomQuestion will be pinned to (null means it is the first question in the section)"
    questionId: Int
  }
`;
