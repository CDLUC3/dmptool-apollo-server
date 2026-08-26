import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Validates the password reset token and returns the user if valid"
    validatePasswordResetToken(token: String!): Boolean
  }

  extend type Mutation {
    "Send a password reset email to the user"
    sendPasswordResetEmail(email: String!): Boolean
    "Reset the user's password using the reset token"
    resetPassword(token: String!, newPassword: String!): Boolean
  }
`;
