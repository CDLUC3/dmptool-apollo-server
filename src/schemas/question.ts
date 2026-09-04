import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Get the Questions that belong to the associated sectionId"
    questions(sectionId: Int!): [Question]
    "Get the specific Question based on questionId"
    question(questionId: Int!): Question
    "Get all prior option-type questions across the template for display-logic triggers"
    triggerQuestionsForQuestion(questionId: Int!): [Question]
  }

  extend type Mutation {
    "Create a new Question"
    addQuestion(input: AddQuestionInput!): Question!
    "Update a Question"
    updateQuestion(input: UpdateQuestionInput!): Question!
    "Change the question's display order"
    updateQuestionDisplayOrder(questionId: Int!, newDisplayOrder: Int!): ReorderQuestionsResult!
    "Delete a Question"
    removeQuestion(questionId: Int!): Question
  }

  "Question always belongs to a Section, which always belongs to a Template"
  type Question {
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
    errors: QuestionErrors

    "The unique id of the Template that the question belongs to"
    templateId: Int!
    "The unique id of the Section that the question belongs to"
    sectionId: Int!
    "The original question id if this question is a copy of another"
    sourceQestionId: Int
    "The display order of the question"
    displayOrder: Int
    "Whether or not the Question has had any changes since the related template was last published"
    isDirty: Boolean
    "This will be used as a sort of title for the Question"
    questionText: String
    "The JSON representation of the question type"
    json: String
    "Requirements associated with the Question"
    requirementText: String
    "Guidance to complete the question"
    guidanceText: String
    "Sample text to possibly provide a starting point or example to answer question"
    sampleText: String
    "Boolean indicating whether we should use content from sampleText as the default answer"
    useSampleTextAsDefault: Boolean
    "To indicate whether the question is required to be completed"
    required: Boolean
    "The Tags associated with this question. A question might not have any tags"
    tags: [Tag]

    "The conditional logic triggered by this question"
    conditionGroups: [QuestionConditionGroup]
    "Whether to show or hide the question (or send an email) when its display logic conditions match"
    displayLogicAction: QuestionConditionActionType
    "Whether ANY or ALL of the question's condition groups must match"
    displayLogicMatchType: QuestionConditionMatchType
  }

  "A collection of errors related to the Question"
  type QuestionErrors {
    "General error messages such as the object already exists"
    general: String

    templateId: String
    sectionId: String
    sourceQestionId: String
    displayOrder: String
    questionText: String
    json: String
    requirementText: String
    guidanceText: String
    sampleText: String
    questionConditionIds: String
  }

  "The results of reordering the questions"
  type ReorderQuestionsResult {
    "The reordered sections"
    questions: [Question!]
    "Error messages"
    errors: QuestionErrors
  }

  input AddQuestionInput {
    "The unique id of the Template that the question belongs to"
    templateId: Int!
    "The unique id of the Section that the question belongs to"
    sectionId: Int!
    "The display order of the question"
    displayOrder: Int
    "Whether or not the Question has had any changes since it was last published"
    isDirty: Boolean
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
    "Boolean indicating whether we should use content from sampleText as the default answer"
    useSampleTextAsDefault: Boolean
    "To indicate whether the question is required to be completed"
    required: Boolean
    "The Tags associated with this question. A question might not have any tags"
    tags: [TagInput!]
  }

  input UpdateQuestionInput {
    "The unique identifier for the Question"
    questionId: Int!
    "The display order of the Question"
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
    "Boolean indicating whether we should use content from sampleText as the default answer"
    useSampleTextAsDefault: Boolean
    "To indicate whether the question is required to be completed"
    required: Boolean
    "The Tags associated with this question. A question might not have any tags"
    tags: [TagInput!]
  }
`
