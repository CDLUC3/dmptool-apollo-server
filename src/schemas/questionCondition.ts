import gql from 'graphql-tag';

export const typeDefs = gql`

  "QuestionCondition types"
  enum QuestionConditionCondition {
    "When a question equals a specific value"
    EQUAL
    "When a question does not equal a specific value"
    DOES_NOT_EQUAL
    "When a question (multi-value) includes a specific value"
    INCLUDES
    "When a question (multi-value) does not include a specific value"
    DOES_NOT_INCLUDE
  }

  """
  A single condition (operator + value) within a QuestionConditionGroup,
  e.g. "is 'Charlie'" or "is NOT 'Apples'".
  """
  type QuestionCondition {
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
    errors: QuestionConditionErrors

    "The QuestionConditionGroup this condition belongs to"
    groupId: Int!
    "The type of condition/operator to evaluate"
    conditionType: QuestionConditionCondition!
    "The value(s) to match on"
    conditionMatch: String
  }

  "A collection of errors related to the QuestionCondition"
  type QuestionConditionErrors {
    "General error messages such as the object already exists"
    general: String

    groupId: String
    conditionType: String
    conditionMatch: String
  }

  "Input for a single condition within a group, used by saveQuestionDisplayLogic"
  input QuestionConditionInput {
    "The type of condition/operator to evaluate"
    conditionType: QuestionConditionCondition!
    "The value(s) to match on"
    conditionMatch: String
  }

`