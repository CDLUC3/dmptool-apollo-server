import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Returns the currently logged in user's information"
    me: User
    "Returns all of the users associated with the current admin's affiliation (Super admins get everything)"
    users(term: String, role: UserRole, affiliationId: String, paginationOptions: PaginationOptions): UserSearchResults
    "Returns the specified user (Admin only)"
    user(userId: Int!): User
  }

  extend type Mutation {
    "Update the current user's information"
    updateUserProfile(input: UpdateUserProfileInput!): User
    "Update the specified user's information (SuperAdmin only)"
    updateUserInfo(input: UpdateUserInfoInput!): User
    " Update the specified user's role (SuperAdmin and Admin only)"
    updateUserRole(input: UpdateUserRoleInput!): User
    "Update the current user's email notifications"
    updateUserNotifications(input: UpdateUserNotificationsInput!): User
    "Set the user's ORCID"
    setUserOrcid(orcid: String!): User
    "Anonymize the current user's account (essentially deletes their account without orphaning things)"
    removeUser: User

    "Add an email address for the current user"
    addUserEmail(email: String!, isPrimary: Boolean!): UserEmail
    "Remove an email address from the current user"
    removeUserEmail(email: String!): UserEmail
    "Designate the email as the current user's primary email address"
    setPrimaryUserEmail(email: String!): [UserEmail]

    "Change the current user's password"
    updatePassword(oldPassword: String!, newPassword: String!, email: String!): User

    "Deactivate the specified user Account (Admin only)"
    deactivateUser(userId: Int!): User
    "Reactivate the specified user Account (Admin only)"
    activateUser(userId: Int!): User
    "Archive the specified user and anonymize their data (Admin only)"
    archiveUser(userId: Int!): User
    "Merge the 2 user accounts (Admin only)"
    mergeUsers(userIdToBeMerged: Int!, userIdToKeep: Int!): User
  }

  "The types of roles supported by the DMPTool"
  enum UserRole {
    RESEARCHER
    ADMIN
    SUPERADMIN
  }

  "The types of object a User can be invited to Collaborate on"
  enum InvitedToType {
    PLAN
    TEMPLATE
  }

  "A user of the DMPTool"
  type User {
    "The unique identifier for the Object"
    id: Int
    "The user who created the Object"
    createdById: Int
    "The timestamp when the Object was created"
    created: String
    "The user who last modified the Object"
    modifiedById: Int
    "The timestamp when the Object was last modified"
    modified: String
    "Errors associated with the Object"
    errors: UserErrors

    "The user's first/given name"
    givenName: String
    "The user's last/family name"
    surName: String
    "The user's role within the DMPTool"
    role: UserRole!
    "The user's organizational affiliation"
    affiliation: Affiliation
    "The plans that the user created"
    plans: [Plan]
    "Whether the user has accepted the terms and conditions of having an account"
    acceptedTerms: Boolean
    "The user's ORCID"
    orcid: Orcid
    "The user's SSO ID"
    ssoId: String
    "The user's preferred language"
    languageId: String!

    "Whether or not email notifications are on for when a Plan has a new comment"
    notify_on_comment_added: Boolean
    "Whether or not email notifications are on for when a Template is shared with the User (Admin only)"
    notify_on_template_shared: Boolean
    "Whether or not email notifications are on for when feedback on a Plan is completed"
    notify_on_feedback_complete: Boolean
    "Whether or not email notifications are on for when a Plan is shared with the user"
    notify_on_plan_shared: Boolean
    "Whether or not email notifications are on for Plan visibility changes"
    notify_on_plan_visibility_change: Boolean

    "Whether or not the account is locked from failed login attempts"
    locked: Boolean
    "Whether or not account is active"
    active: Boolean
    "Whether or not account is archived"
    isArchived: Boolean

    "The timestamp of the last login"
    last_sign_in: String
    "The method user for the last login: PASSWORD or SSO"
    last_sign_in_via: String
    "The number of failed login attempts"
    failed_sign_in_attempts: Int

    "The user's email addresses"
    emails: [UserEmail]
    "The user's primary email address"
    email: String
  }

  type UserSearchResults implements PaginatedQueryResults {
    "The TemplateSearchResults that match the search criteria"
    items: [User]
    "The total number of possible items"
    totalCount: Int
    "The number of items returned"
    limit: Int
    "The cursor to use for the next page of results (for infinite scroll/load more)"
    nextCursor: String
    "The current offset of the results (for standard offset pagination)"
    currentOffset: Int
    "Whether or not there is a next page"
    hasNextPage: Boolean
    "Whether or not there is a previous page"
    hasPreviousPage: Boolean
    "The sortFields that are available for this query (for standard offset pagination only!)"
    availableSortFields: [String]
  }

  "A collection of errors related to the User"
  type UserErrors {
    "General error messages such as the object already exists"
    general: String

    givenName: String
    surName: String
    email: String
    role: String
    affiliationId: String
    otherAffiliationName: String
    orcid: String
    ssoId: String
    languageId: String
    password: String
    confirmPassword: String

    emailIds: String
  }

  type UserEmail {
    "The unique identifier for the Object"
    id: Int
    "The user who created the Object"
    createdById: Int
    "The timestamp when the Object was created"
    created: String
    "The user who last modified the Object"
    modifiedById: Int
    "The timestamp when the Object was last modified"
    modified: String
    "Errors associated with the Object"
    errors: UserEmailErrors

    "The user the email belongs to"
    userId: Int!
    "The email address"
    email: String!
    "Whether or not the email address has been confirmed"
    isConfirmed: Boolean!
    "Whether or not this is the primary email address"
    isPrimary: Boolean!
  }

  "A collection of errors related to the UserEmail"
  type UserEmailErrors {
    "General error messages such as the object already exists"
    general: String

    userId: String
    email: String
  }

  input UpdateUserProfileInput {
    "The user's first/given name"
    givenName: String!
    "The user's last/family name"
    surName: String!
    "The id of the affiliation if the user selected one from the typeahead list"
    affiliationId: String
    "The name of the affiliation if the user did not select one from the typeahead list"
    otherAffiliationName: String
    "The user's preferred language"
    languageId: String
  }

  input UpdateUserInfoInput {
    "The user's id"
    userId: Int!
    "The user's email address"
    email: String!
    "The user's given name"
    givenName: String!
    "The user's surname"
    surName: String!
    "The id of the affiliation if the user selected one from the typeahead list"
    affiliationId: String
    "The name of the affiliation if the user did not select one from the typeahead list"
    otherAffiliationName: String
    "The user's preferred language"
    languageId: String
  }

  input UpdateUserRoleInput {
    "The user's id"
    userId: Int!
    "The new role for the user"
    role: UserRole!
  }

  input UpdateUserNotificationsInput {
    "Whether or not email notifications are on for when a Plan has a new comment"
    notify_on_comment_added: Boolean!
    "Whether or not email notifications are on for when a Template is shared with the User (Admin only)"
    notify_on_template_shared: Boolean!
    "Whether or not email notifications are on for when feedback on a Plan is completed"
    notify_on_feedback_complete: Boolean!
    "Whether or not email notifications are on for when a Plan is shared with the user"
    notify_on_plan_shared: Boolean!
    "Whether or not email notifications are on for Plan visibility changes"
    notify_on_plan_visibility_change: Boolean!
  }
`;
