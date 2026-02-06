import gql from "graphql-tag";

// This schema file contains queries and mutations that are meant to assist Super Admins with
// maintenance tasks

export const typeDefs = gql`
  extend type Mutation {
    "Initialize a PLanVersion record in the DynamoDB for all Plans that do not have one"
    superSyncPlanMaDMP(planId: Int!): Boolean!
  }
`;
