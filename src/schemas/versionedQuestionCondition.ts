import gql from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Get the published VersionedQuestionConditionGroups (and their nested conditions) for the specified versioned question"
    publishedConditionGroupsForQuestion(versionedQuestionId: Int!): [VersionedQuestionConditionGroup]
  }

  "VersionedQuestionCondition types"
  enum VersionedQuestionConditionCondition {
    "When a question has an answer"
    HAS_ANSWER
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
  Point-in-time snapshot of a QuestionConditionGroup, taken when a Question
  is versioned/published. Mirrors the live QuestionConditionGroup's shape:
  one "trigger question" box, containing the individual conditions that
  applied to it at publish time.
  """
  type VersionedQuestionConditionGroup {
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
    errors: VersionedQuestionConditionGroupErrors

    "The versionedQuestion id that this group's display logic applied to"
    versionedQuestionId: Int!
    "Id of the original (live) QuestionConditionGroup this was snapshotted from"
    questionConditionGroupId: Int!
    "The id of the prior question whose answer was being checked at publish time"
    triggerQuestionId: Int!
    "The prior question whose answer was being checked at publish time"
    triggerQuestion: Question
    "The individual conditions (option checks) within this group at publish time — combined with OR"
    conditions: [VersionedQuestionCondition]
  }

  "A collection of errors related to the VersionedQuestionConditionGroup"
  type VersionedQuestionConditionGroupErrors {
    "General error messages such as the object already exists"
    general: String

    versionedQuestionId: String
    questionConditionGroupId: String
    triggerQuestionId: String
  }

  """
  Point-in-time snapshot of a single condition (operator + value) within a
  VersionedQuestionConditionGroup, taken when a Question is versioned/published.
  """
  type VersionedQuestionCondition {
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
    errors: VersionedQuestionConditionErrors

    "The VersionedQuestionConditionGroup this condition belongs to"
    versionedQuestionConditionGroupId: Int!
    "Id of the original (live) QuestionCondition this was snapshotted from"
    questionConditionId: Int!
    "The type of condition/operator that was evaluated at publish time"
    conditionType: VersionedQuestionConditionCondition!
    "The value(s) that were matched on at publish time (e.g., HAS_ANSWER should equate to null here), JSON-encoded as a string"
    conditionMatch: String
  }

  "A collection of errors related to the VersionedQuestionCondition"
  type VersionedQuestionConditionErrors {
    "General error messages such as the object already exists"
    general: String

    versionedQuestionConditionGroupId: String
    questionConditionId: String
    conditionType: String
    conditionMatch: String
  }
`;
