import gql from "graphql-tag";

export const typeDefs = gql`
  enum PlanFeedbackStatusEnum {
    NONE
    REQUESTED
    COMPLETED
  }

  extend type Query {
    "Get all rounds of admin feedback for the plan"
    planFeedback(planId: Int!): [PlanFeedback]

    "Get all of the comments associated with the round of admin feedback"
    planFeedbackComments(planId: Int!, planFeedbackId: Int!): [PlanFeedbackComment]

    "Get the feedback status for a plan (NONE, REQUESTED, COMPLETED)"
    planFeedbackStatus(planId: Int!): PlanFeedbackStatus
  }

  extend type Mutation {
    "Request a round of admin feedback"
    requestFeedback(planId: Int!, messageToOrg: String): PlanFeedback
    "Mark the feedback round as complete"
    completeFeedback(planId: Int!, planFeedbackId: Int!, summaryText: String): PlanFeedback
    "Add feedback comment for an answer within a round of feedback"
    addFeedbackComment(planId: Int!, planFeedbackId: Int!, answerId: Int!, commentText: String!): PlanFeedbackComment
    "Update feedback comment for an answer within a round of feedback"
    updateFeedbackComment(planId: Int!, planFeedbackCommentId: Int!, commentText: String!): PlanFeedbackComment
    "Remove feedback comment for an answer within a round of feedback"
    removeFeedbackComment(planId: Int!, planFeedbackCommentId: Int!): PlanFeedbackComment
  }

  "A round of administrative feedback for a Data Managament Plan (DMP)"
  type PlanFeedback {
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
    errors: PlanFeedbackErrors

    "The plan the user wants feedback on"
    plan: Plan
    "The timestamp of when the user requested the feedback"
    requested: String
    "The user who requested the round of feedback"
    requestedBy: User
    "The timestamp that the feedback was marked as complete"
    completed: String
    "The admin who completed the feedback round"
    completedBy: User
    "An overall summary that can be sent to the user upon completion"
    summaryText: String
    "Message user sent to org when requesting feedback, which can be NULL"
    messageToOrg: String

    "The specific contextual commentary"
    feedbackComments: [PlanFeedbackComment!]
  }

  type PlanFeedbackComment {
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
    errors: PlanFeedbackCommentErrors

    "The answerId the comment is related to"
    answerId: Int
    "The round of plan feedback the comment belongs to"
    PlanFeedback: PlanFeedback
    "The comment"
    commentText: String
    "User who made the comment"
    user: User
  }

  "A collection of errors related to the PlanFeedback"
  type PlanFeedbackErrors {
    "General error messages such as the object already exists"
    general: String

    planId: String
    requestedById: String
    completedById: String
    summaryText: String
    feedbackComments: String
  }

  "A collection of errors related to the PlanFeedbackComment"
  type PlanFeedbackCommentErrors {
    "General error messages such as the object already exists"
    general: String

    answer: String
    planFeedback: String
    comment: String
  }

  "Info on the Plan Feedback Status"
  type PlanFeedbackStatus {
  "The status of the plan feedback (NONE, REQUESTED, COMPLETED)"
  status: PlanFeedbackStatusEnum  
  "The id of the feedback request if it exists"
  id: Int
  }
`;
