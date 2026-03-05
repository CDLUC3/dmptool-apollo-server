import gql from 'graphql-tag';

export const typeDefs = gql`
  extend type Query {
    "Return all licenses"
    licenses: [License]
    "Return the recommended Licenses"
    recommendedLicenses(recommended: Boolean!): [License]
    "Fetch a specific license"
    license(uri: String!): License
  }

  extend type Mutation {
    "Add a new License (don't make the URI up! should resolve to an taxonomy HTML/JSON representation of the object)"
    addLicense(name: String!, uri: String, description: String, recommended: Boolean): License
    "Update a License record"
    updateLicense(uri: String!, name: String!, description: String, recommended: Boolean): License
    "Delete a License"
    removeLicense(uri: String!): License

    "Merge two licenses"
    mergeLicenses(licenseToKeepId: Int!, licenseToRemoveId: Int!): License
  }

  "A license associated with a research output (e.g. CC0, MIT, etc.)"
  type License {
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
    errors: LicenseErrors

    "The name of the license"
    name: String!
    "The taxonomy URL of the license"
    uri: String!
    "A description of the license"
    description: String
    "Whether or not the license is recommended"
    recommended: Boolean!
  }

  "A collection of errors related to the License"
  type LicenseErrors {
    "General error messages such as the object already exists"
    general: String

    name: String
    uri: String
    description: String
  }
`;
