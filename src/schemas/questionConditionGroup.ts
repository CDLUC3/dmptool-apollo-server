import gql from 'graphql-tag';

export const typeDefs = gql`

  extend type Query {
    "Get the QuestionConditionGroups (and their nested conditions) that belong to a specific question"
    questionConditionGroups(questionId: Int!): [QuestionConditionGroup]
  }

  extend type Mutation {
    """
    Replace all display logic for a question in one transactional operation:
    sets the question's action/matchType and replaces its groups/conditions
    wholesale with the ones provided.
    """
    saveQuestionDisplayLogic(input: SaveQuestionDisplayLogicInput!): Question!
    "Remove all display logic (all groups and their conditions) for a question"
    removeQuestionDisplayLogic(questionId: Int!): Boolean!
  }

  "QuestionCondition action — now set once per Question, not per condition"
  enum QuestionConditionActionType {
    "Show the question"
    SHOW_QUESTION
    "Hide the question"
    HIDE_QUESTION
    "Send email"
    SEND_EMAIL
  }

  "How multiple QuestionConditionGroups combine to determine the overall match"
  enum QuestionConditionMatchType {
    "Any one group matching is sufficient"
    ANY
    "All groups must match"
    ALL
  }

  """
  One "trigger question" box in the Display Logic UI: groups together the
  conditions (option checks) that apply to a single prior question
  (triggerQuestionId). A Question's overall display logic is the combination
  of all its QuestionConditionGroups, joined by its matchType (ANY/ALL).
  """
  type QuestionConditionGroup {
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
    errors: QuestionConditionGroupErrors

    "The question id that this group's display logic applies to"
    questionId: Int!
    "The id of the prior question whose answer is being checked"
    triggerQuestionId: Int!
    "The prior question whose answer is being checked"
    triggerQuestion: Question
    "The individual conditions (option checks) within this group — combined with OR"
    conditions: [QuestionCondition]
  }

  "A collection of errors related to the QuestionConditionGroup"
  type QuestionConditionGroupErrors {
    "General error messages such as the object already exists"
    general: String

    questionId: String
    triggerQuestionId: String
  }

  "Input for a single trigger-question group, used by saveQuestionDisplayLogic"
  input QuestionConditionGroupInput {
    "The id of the prior question whose answer is being checked"
    triggerQuestionId: Int!
    "The conditions (option checks) within this group — combined with OR"
    conditions: [QuestionConditionInput!]!
  }

  "Input for replacing a question's entire display logic configuration"
  input SaveQuestionDisplayLogicInput {
    "The id of the question this display logic applies to"
    questionId: Int!
    "Whether to show or hide the question (or send an email) when the logic matches"
    action: QuestionConditionActionType!
    "Whether ANY or ALL of the groups must match"
    matchType: QuestionConditionMatchType!
    "The full set of trigger-question groups replacing any existing ones"
    groups: [QuestionConditionGroupInput!]!
  }

`
