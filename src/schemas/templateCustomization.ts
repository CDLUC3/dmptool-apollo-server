import gql from "graphql-tag";

export const typeDefs = gql`

  "The status of a Template Customization"
  enum TemplateCustomizationStatus {
    "The customization is not currently published"
    DRAFT
    "The customization is published and can be used by researchers"
    PUBLISHED
    "The customization has been archived"
    ARCHIVED
  }
  
  "The status of a Template Customization with regard to the funder template"
  enum TemplateCustomizationMigrationStatus {
    "The customization is tracking the published version of the funder template"
    OK
    "The customization is tracking an unpublished version of the funder template"
    STALE
    "The customization is tracking a funder template that is no longer published"
    ORPHANED
  }
`;
