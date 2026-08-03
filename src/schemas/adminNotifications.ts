import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Retrieve all read notifications for a specific affiliation"
    adminNotificationsRead(paginationOptions: PaginationOptions): AdminNotificationResultsPage
    "Retrieve all unread notifications for a specific affiliation"
    adminNotificationsUnread(paginationOptions: PaginationOptions): AdminNotificationResultsPage
    "Retrieve all notifications for a specific affiliation"
    adminNotifications(paginationOptions: PaginationOptions): AdminNotificationResultsPage
  }

  extend type Mutation {
    "Mark a notification as read"
    markNotificationAsRead(id: Int!): Boolean!
    "Mark a notification as unread"
    markNotificationAsUnRead(id: Int!): Boolean!
  }

  type AdminNotificationMetadata {
    "The associated plan Id for the notification, if applicable"
    planId: Int
    "The associated template Id for the notification, if applicable"
    templateId: Int
    "The associated template customization Id for the notification, if applicable"
    templateCustomizationId: Int
  }

  input AdminNotificationMetadataInput {
    "The associated plan Id for the notification, if applicable"
    planId: Int
    "The associated template Id for the notification, if applicable"
    templateId: Int
    "The associated template customization Id for the notification, if applicable"
    templateCustomizationId: Int
  }

  type AdminNotificationResultsPage {
    items: [AdminNotificationResults!]!
    totalCount: Int
    hasNextPage: Boolean!
    hasPreviousPage: Boolean
    currentOffset: Int
    nextCursor: String
  }


  type AdminNotificationResults {
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
    errors: AdminNotificationErrors

    "The notification type"
    notificationType: AdminNotificationType
    "Additional data providing the associated Ids for the notification"
    metadata: AdminNotificationMetadata
    "The affiliation associated with the notification"
    affiliationId: String
    "Whether the notification has been read"
    isRead: Boolean
    "The userId of the user associated with the notification"
    userId: Int

    "The plan associated with the notification if metadata contains a planId"
    plan: Plan
    "The template associated with the notification if metadata contains a templateId"
    template: Template
    "The template customization associated with the notification if metadata contains a templateCustomizationId"
    templateCustomization: TemplateCustomization
    "The feedback associated with the plan if metadata contains a planId"
    feedback: PlanFeedback
    "The user who created the notification"
    createdBy: User
    }

  "A collection of errors related to the Section"
  type AdminNotificationErrors {
    "General error messages such as the object already exists"
    general: String
  }


  "The types of notifications for Admin Notification"
  enum AdminNotificationType {
    "When feedback is requested on a plan"
    FEEDBACK_REQUESTED
    "When a template is created"
    TEMPLATE_CREATED
    "When customization to a template has changed"
    TEMPLATE_CUSTOMIZATION_CHANGED
  }
`;
