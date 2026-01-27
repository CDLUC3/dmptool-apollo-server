import gql from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Search for VersionedQuestions that belong to Section specified by sectionId and answer status for a plan"
    publishedQuestions(planId: Int!, versionedSectionId: Int!): [VersionedQuestionWithFilled]
    "Get a specific VersionedQuestion based on versionedQuestionId"
    publishedQuestion(versionedQuestionId: Int!): VersionedQuestion
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

"A snapshot of a Question when it became published, but includes extra information about if answer is filled."
type VersionedQuestionWithFilled {
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

    "Indicates whether the question has an answer"
    hasAnswer: Boolean
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
`
