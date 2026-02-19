import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get the custom guidance and sample text the affiliation has added to a funder question question (user must be an Admin)"
    questionCustomization(questionCustomizationId: Int!): QuestionCustomization
    "Get the custom question the affiliation has added to a funder section or custom section (user must be an Admin)"
    customQuestion(customQuestionId: Int!): CustomQuestion
  }

  extend type Mutation {
    "Add custom guidance and sample answer to a funder question"
    addQuestionCustomization(input: AddQuestionCustomizationInput!): QuestionCustomization!
    "Update custom guidance and sample answer for a funder question"
    updateQuestionCustomization(input: UpdateQuestionCustomizationInput!): QuestionCustomization!
    "Remove custom guidance and sample answer from a funder question"
    removeQuestionCustomization(questionCustomizationId: Int!): QuestionCustomization!

    "Add a custom question to a funder section"
    addCustomQuestion(input: AddCustomQuestionInput!): CustomQuestion!
    "Update a custom question"
    updateCustomQuestion(input: UpdateCustomQuestionInput!): CustomQuestion!
    "Remove a custom question"
    removeCustomQuestion(customQuestionId: Int!): CustomQuestion!
    "Move a custom question to a different position within the section (null means move to the top of the section)"
    moveCustomQuestion(input: MoveCustomQuestionInput!): CustomQuestion!
  }

  "Customization of a funder question"
  type QuestionCustomization {
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
    errors: QuestionCustomizationErrors

    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The funder question this customization applies to"
    questionId: Int!
    "The current status of the customization with regard to the base funder template"
    migrationStatus: TemplateCustomizationMigrationStatus
    "Guidance specific to the customizing affiliation's users"
    guidanceText: String
    "A sample answer specific to the customizing affiliation's users"
    sampleText: String

    "The version of the funder question this customization applies to"
    versionedQuestion: VersionedQuestion
  }

  "A question created/owned by the affiliation that owns the customization"
  type CustomQuestion {
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
    errors: CustomQuestionErrors

    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The current status of the customization with regard to the base funder template"
    migrationStatus: TemplateCustomizationMigrationStatus!

    "The type of the section (VersionedSection or CustomSection) this question belongs to"
    sectionType: CustomizableObjectOwnership!
    "The id of the section this question belongs to"
    sectionId: Int!
    "The type (BASE: VersionedQuestion, CUSTOM: CustomQuestion) this CustomQuestion is pinned to (null means it is the first question in the section)"
    pinnedQuestionType: CustomizableObjectOwnership
    "The id of the VersionedQuestion or CustomQuestion this CustomQuestion is pinned to (null means it is the first question in the section)"
    pinnedQuestionId: Int

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

  "Errors related to the SectionCustomization"
  type QuestionCustomizationErrors {
    "General error messages such as the object already exists"
    general: String
    versionedQuestionId: String
    templateCustomizationId: String
    migrationStatus: String
    guidanceText: String
    sampleText: String
  }

  "Errors related to the CustomSection"
  type CustomQuestionErrors {
    "General error messages such as the object already exists"
    general: String
    templateCustomizationId: String
    migrationStatus: String
    sectionType: String
    sectionId: String
    pinnedQuestionType: String
    pinnedQuestionId: String
    questionText: String
    json: String
    requirementText: String
    guidanceText: String
    sampleText: String
    useSampleTextAsDefault: String
    required: String
  }

  "Input parameters for adding custom guidance and sample text to a funder question"
  input AddQuestionCustomizationInput {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
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

  "Input parameters for adding a custom section to a funder template"
  input AddCustomQuestionInput {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The type of the section this new custom question should appear within"
    sectionType: CustomizableObjectOwnership!
    "The identifier of the section this new custom question should appear within"
    sectionId: Int!
    "The type of the question this new custom question should appear after (null means it is the first question in the section)"
    pinnedQuestionType: CustomizableObjectOwnership
    "The identifier of the question this new custom question should appear after (null means it is the first question in the section)"
    pinnedQuestionId: Int
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
    useSampleTextAsDefault: Boolean
    "Whether the user is required to answer the question"
    required: Boolean
  }

  "Move a custom question to a different position within the section (null means move to the top of the section)"
  input MoveCustomQuestionInput {
    "the id of the custom question to move"
    customQuestionId: Int!
    "The type of the section this new custom question should appear within"
    sectionType: CustomizableObjectOwnership!
    "The identifier of the section this new custom question should appear within"
    sectionId: Int!
    "The type of the question this new custom question should appear after (null means it is the first question in the section)"
    pinnedQuestionType: CustomizableObjectOwnership
    "The identifier of the question this new custom question should appear after (null means it is the first question in the section)"
    pinnedQuestionId: Int
  }
`;
