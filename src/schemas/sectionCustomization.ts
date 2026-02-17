import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get the custom guidance an affiliation has applied to a funder section (user must be an Admin)"
    sectionCustomization(sectionCustomizationId: Int!): SectionCustomization!
    "Get the specified custom section an affiliation has added to a funder template (user must be an Admin)"
    customSection(customSectionId: Int!): CustomSection!
  }

  extend type Mutation {
    "Add custom guidance to a funder section"
    addSectionCustomization(input: AddSectionCustomizationInput!): SectionCustomization!
    "Update custom guidance on a funder section"
    updateSectionCustomization(input: UpdateSectionCustomizationInput!): SectionCustomization!
    "Remove custom guidance from a funder section"
    removeSectionCustomization(sectionCustomizationId: Int!): SectionCustomization!

    "Add a custom section to a funder template"
    addCustomSection(templateCustomizationId: Int!): CustomSection!
    "Update a custom section"
    updateCustomSection(input: UpdateCustomSectionInput!): CustomSection!
    "Remove a custom section"
    removeCustomSection(customSectionId: Int!): CustomSection!
    "Move a custom section to a different position in the template (null means move to the top of the template)"
    moveCustomSection(customSectionId: Int!, newVersionedSectionId: Int): CustomSection!
  }

  "Customization of a funder section"
  type SectionCustomization {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The identifier of the published funder section"
    versionedSectionId: Int!
    "The current status of the customization with regard to the base funder template"
    migrationStatus: TemplateCustomizationMigrationStatus

    "Guidance specific to the customizing affiliation's users"
    guidance: String
  }

  "A section created/owned by the affiliation that owns the customization"
  type CustomSection {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The current status of the customization with regard to the base funder template"
    migrationStatus: TemplateCustomizationMigrationStatus

    "The type (BASE: VersionedSection, CUSTOM: CustomSection) this CustomSection is pinned to (null means it is the first section)"
    pinnedSectionType: CustomizableObjectOwnership
    "The id of the VersionedSection or CustomSection this CustomSection is pinned to (null means it is the first section)"
    pinnedSectionId: Int

    "The section title"
    name: String
    "An introduction to the section"
    introduction: String
    "Requirements that a user must consider in this section"
    requirements: String
    "The guidance to help user with answering questions in this section"
    guidance: String
  }

  "Input parameters for adding custom guidance to a funder section"
  input AddSectionCustomizationInput {
    "The identifier of the parent template customization"
    templateCustomizationId: Int!
    "The identifier of the published funder section"
    versionedSectionId: Int!
  }

  "Input parameters for updating custom guidance to a funder section"
  input UpdateSectionCustomizationInput {
    "The identifier of the parent template customization"
    sectionCustomizationId: Int!
    "The custom guidance for the section"
    guidance: String
  }

  "Input parameters for updating a custom section"
  input UpdateCustomSectionInput {
    "The id of the custom section"
    customSectionId: Int!
    "The custom section name"
    name: String!
    "The introduction to the custom section"
    introduction: String
    "The requirements for the custom section"
    requirements: String
    "The custom guidance for the custom section"
    guidance: String
  }

  "Move a custom section to a different position in the template (null means move to the top of the template)"
  input MoveCustomSectionInput {
    "the id of the custom section to move"
    customSectionId: Int!
    "The type of the section (BASE: VersionedSection, CUSTOM: CustomSection) this CustomSection will be pinned to (null means it is the first section in the template)"
    sectionType: CustomizableObjectOwnership
    "The id of the section this CustomSection will be pinned to (null means it is the first section in the template)"
    sectionId: Int
  }
`;
