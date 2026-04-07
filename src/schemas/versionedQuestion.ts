import gql from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Search for VersionedQuestions that belong to Section specified by sectionId and answer status for a plan"
    publishedQuestions(planId: Int!, versionedSectionId: Int!): [PublishedQuestion]
    "Fetch all published custom questions for the specified versioned section"
    publishedCustomQuestions(versionedCustomSectionId: Int!, planId: Int!): [PublishedQuestion]
    "Get a specific VersionedQuestion based on versionedQuestionId"
    publishedQuestion(versionedQuestionId: Int!): VersionedQuestion
    "Get a specific published custom question based on versionedCustomQuestionId"
    publishedCustomQuestion(versionedCustomQuestionId: Int!): VersionedCustomQuestion
  }

  "A snapshot of a Question when it became published."
  type VersionedQuestion {
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
    errors: VersionedQuestionErrors

    "The unique id of the VersionedTemplate that the VersionedQuestion belongs to"
    versionedTemplateId: Int!
    "The unique id of the VersionedSection that the VersionedQuestion belongs to"
    versionedSectionId: Int!
    "Id of the original question that was versioned"
    questionId: Int!
    "The display order of the VersionedQuestion"
    displayOrder: Int
    "The JSON representation of the question type"
    json: String
    "This will be used as a sort of title for the Question"
    questionText: String
    "Requirements associated with the Question"
    requirementText: String
    "Guidance to complete the question"
    guidanceText: String
    "Sample text to possibly provide a starting point or example to answer question"
    sampleText: String
    "Whether or not the sample text should be used as the default answer for this question"
    useSampleTextAsDefault: Boolean
    "To indicate whether the question is required to be completed"
    required: Boolean

    "The conditional logic associated with this VersionedQuestion"
    versionedQuestionConditions: [VersionedQuestionCondition!]
    "Owner affiliation for the question"
    ownerAffiliation: Affiliation
  }

  "A collection of errors related to the VersionedQuestion"
  type VersionedQuestionErrors {
    "General error messages such as the object already exists"
    general: String

    versionedTemplateId: String
    versionedSectionId: String
    questionId: String
    displayOrder: String
    json: String
    questionText: String
    requirementText: String
    guidanceText: String
    sampleText: String
    versionedQuestionConditionIds: String
    }

  "A snapshot of a CustomQuestion when the template customization was published."
  type VersionedCustomQuestion {
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

    "The VersionedTemplateCustomization this snapshot belongs to"
    versionedTemplateCustomizationId: Int!
    "The CustomQuestion this is a snapshot of"
    customQuestionId: Int!

    "Whether this question is pinned inside a BASE or CUSTOM section"
    versionedSectionType: String!
    "The id of the section this question belongs to"
    versionedSectionId: Int!

    "The type of question this custom question is pinned after (null = first question in section)"
    pinnedVersionedQuestionType: String
    "The id of the question this custom question is pinned after"
    pinnedVersionedQuestionId: Int

    "The question text"
    questionText: String!
    "The question JSON schema definition"
    json: String!
    "The requirement text for this question"
    requirementText: String
    "Guidance to help the user answer this question"
    guidanceText: String
    "A sample answer for this question"
    sampleText: String
    "Whether the sample text should be pre-populated as the default answer"
    useSampleTextAsDefault: Boolean
    "Whether this question is required"
    required: Boolean

    "Owner affiliation for the question"
    ownerAffiliation: Affiliation

    "Errors associated with the Object"
    errors: VersionedCustomQuestionErrors
  }


  "A collection of errors related to the VersionedCustomQuestion"
  type VersionedCustomQuestionErrors {
    "General error messages"
    general: String
    versionedTemplateCustomizationId: String
    customQuestionId: String
    versionedSectionId: String
    questionText: String
    json: String
  }

  "A normalized question result covering both base and custom questions, with answer status"
type PublishedQuestion {
  "The unique identifier for the Object"
  id: Int
  "Whether this is a BASE or CUSTOM question"
  questionType: String
  "Present when questionType is BASE"
  versionedQuestionId: Int
  "Present when questionType is CUSTOM"
  customQuestionId: Int
  "The JSON representation of the question type"
  json: String
  "This will be used as a sort of title for the Question"
  questionText: String
  "Requirements associated with the Question"
  requirementText: String
  "Guidance to complete the question"
  guidanceText: String
  "Sample text to possibly provide a starting point or example to answer question"
  sampleText: String
  "Whether or not the sample text should be used as the default answer for this question"
  useSampleTextAsDefault: Boolean
  "To indicate whether the question is required to be completed"
  required: Boolean
  "Indicates whether the question has an answer"
  hasAnswer: Boolean
} 
`
