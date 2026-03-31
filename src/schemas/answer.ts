import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get all answers for the given project and plan and section"
    answers(projectId: Int!, planId: Int!, versionedSectionId: Int!): [Answer]

    "Get an answer by versionedQuestionId"
    answerByVersionedQuestionId(projectId: Int!, planId: Int!, versionedQuestionId: Int!): Answer

    "Get the specific answer"
    answer(projectId: Int!, answerId: Int!): Answer
  }

  extend type Mutation {
    "Answer a question"
    addAnswer(planId: Int!,versionedSectionId: Int,versionedQuestionId: Int,versionedCustomSectionId: Int,versionedCustomQuestionId: Int,json: String): Answer
    "Edit an answer"
    updateAnswer(answerId: Int!, json: String): Answer
    "Add comment for an answer "
    addAnswerComment(answerId: Int!, commentText: String!): AnswerComment
    "Update comment for an answer "
    updateAnswerComment(answerCommentId: Int!, answerId: Int!, commentText: String!): AnswerComment
    "Remove answer comment"
    removeAnswerComment(answerCommentId: Int!, answerId: Int!): AnswerComment
  }

  "An answer to a question on a Data Managament Plan (DMP)"
  type Answer {
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
    errors: AffiliationErrors

    "The question in the template the answer is for"
    versionedSection: VersionedSection
    "The question in the template the answer is for"
    versionedQuestion: VersionedQuestion
    "The custom section the answer is for"
    versionedCustomSection: VersionedCustomSection
    "The custom question the answer is for"
    versionedCustomQuestion: VersionedCustomQuestion
    "The DMP that the answer belongs to"
    plan: Plan
    "The answer to the question"
    json: String

    "The comments associated with the answer"
    comments: [AnswerComment!]

    "The feedback comments associated with the answer"
    feedbackComments: [PlanFeedbackComment!]
  }

  "A collection of errors related to the Answer"
  type AffiliationErrors {
    "General error messages such as affiliation already exists"
    general: String

    versionedSectionId: String
    versionedQuestionId: String
    planId: String
    json: String
  }

  type AnswerComment {
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
    errors: AnswerCommentErrors

    "The answer the comment is associated with"
    answerId: Int!
    "The comment"
    commentText: String!
    "User who made the comment"
    user: User
  }

  "A collection of errors related to the Answer Comment"
  type AnswerCommentErrors {
    "General error messages such as affiliation already exists"
    general: String

    answerId: String
    commentText: String
  }
`;
