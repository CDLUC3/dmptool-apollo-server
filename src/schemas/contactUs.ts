import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend type Mutation {
    "Submit a contact us form — sends an email to the help desk"
    submitContactForm(input: ContactFormInput!): Boolean!
  }

  input ContactFormInput {
    "The submitter's name"
    name: String!
    "The submitter's email address"
    email: String!
    "The subject of the message"
    subject: String!
    "The message body"
    message: String!
  }
`;
