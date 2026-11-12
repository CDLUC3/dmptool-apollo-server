import { gql } from 'graphql-tag';

export const typeDefs = gql`
  extend type Mutation {
    "Add a funder or sample plan link to a Template (user must be an Admin with access to the Template, and the Template must be owned by a funder)"
    addTemplateLink(templateId: Int!, linkType: TemplateLinkType!, url: String!, text: String): TemplateLink
    "Update the URL and/or text of a Template link (user must be an Admin with access to the Template, and the Template must be owned by a funder)"
    updateTemplateLink(templateLinkId: Int!, url: String!, text: String): TemplateLink
    "Remove a link from a Template (user must be an Admin with access to the Template)"
    removeTemplateLink(templateLinkId: Int!): TemplateLink
  }

  extend type Template {
    "The funder and sample plan links associated with the Template (optionally filtered by type)"
    links(linkType: TemplateLinkType): [TemplateLink!]
    "The maximum number of links of the specified type that the Template can have"
    maxLinks(linkType: TemplateLinkType!): Int
  }

  extend type VersionedTemplate {
    "The funder and sample plan links captured when the Template was versioned (optionally filtered by type)"
    links(linkType: TemplateLinkType): [VersionedTemplateLink!]
  }

  "The type of link"
  enum TemplateLinkType {
    "A link to the funder's website or guidance about the requirements for the Template"
    FUNDER
    "A link to a sample plan provided by the funder"
    SAMPLE_PLAN
  }

  "A link that is displayed alongside a Template"
  type TemplateLink {
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
    errors: TemplateLinkErrors

    "The id of the Template the link belongs to"
    templateId: Int!
    "The type of link"
    linkType: TemplateLinkType!
    "The URL"
    url: String!
    "The text to display for the link"
    text: String
  }

  "A collection of errors related to the TemplateLink"
  type TemplateLinkErrors {
    "General error messages such as the object already exists"
    general: String

    templateId: String
    linkType: String
    url: String
    text: String
  }

  "A snapshot of a TemplateLink at the time the Template was versioned"
  type VersionedTemplateLink {
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

    "The id of the VersionedTemplate the link belongs to"
    versionedTemplateId: Int!
    "The type of link"
    linkType: TemplateLinkType!
    "The URL"
    url: String!
    "The text to display for the link"
    text: String
  }
`;
