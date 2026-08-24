import gql from "graphql-tag";

export const typeDefs = gql`
  extend type Query {
    "Get all plans for the research project with pagination support"
    plans(userId: Int!,term: String, paginationOptions: PaginationOptions): PaginatedPlanResults
    "Get all of the plans for a specific Project"
    plansByProjectId(projectId: Int!): [Plan]

    "Get a specific plan"
    plan(planId: Int!): Plan
    "Lookup a plan by its DMP id"
    planByDMPId(dmpId: String!): Plan
    "Get data for a specific version of a plan"
    publicPlanVersionByDMPId(dmpId: String!, version: String!): PlanVersionSnapshot
    "Lookup a plan by an alternate identifier"
    planByAlternateIdentifier(alternateIdentifier: String!): Plan
  }

  extend type Mutation {
    "Create a plan"
    addPlan(projectId: Int!, versionedTemplateId: Int!): Plan
    "Upload a plan"
    uploadPlan(projectId: Int!, fileName: String, fileContent: String): Plan
    "Publish a plan (changes status to PUBLISHED)"
    publishPlan(planId: Int!, visibility: PlanVisibility): Plan
    "Update a plan"
    updatePlan(input: UpdatePlanInput!): Plan
    "Change the plan's status"
    updatePlanStatus(planId: Int!, status: PlanStatus!): Plan
    "Change the plan's title"
    updatePlanTitle(planId: Int!, title: String!): Plan
    "Archive a plan"
    archivePlan(planId: Int!): Plan

    "Assign an alternate identifier to the plan"
    addAlternateIdentifierToPlan(planId: Int!, alternateIdentifier: String!): AlternateIdentifier
    "Assign an alternate identifier to the plan"
    removeAlternateIdentifierFromPlan(planId: Int!, alternateIdentifier: String!): AlternateIdentifier

    "Create an entire plan (and project if applicable) in one shot"
    addEntirePlan(input: AddEntirePlanInput!): Plan
    "Replace an entire plan (and update components of the project) in one shot"
    updateEntirePlan(input: UpdateEntirePlanInput!): Plan
    "Delete/tomb-stone an entire plan (and project if applicable) in one shot"
    removeEntirePlanByDMPId(dmpId: String!): Boolean
  }

  type PlanVersionSnapshot {
  isHistoricalVersion: Boolean!
  versionTimestamp: String!
  latestVersionTimestamp: String!

  title: String
  dmpId: String
  created: String
  modified: String
  registered: String
  visibility: PlanVisibility

  owner: PlanVersionSnapshotOwner

  versionedTemplate: PlanVersionSnapshotTemplate

  project: PlanVersionSnapshotProject
  members: [PlanVersionSnapshotMember!]
  fundings: [PlanVersionSnapshotFunding!]
  answers: [PlanVersionSnapshotAnswer!]
  versions: [PlanVersionSnapshotVersion!]
  relatedWorks: [PlanVersionSnapshotRelatedWork!]

  "Bare related-work identifiers only — full citation metadata isn't preserved in archived snapshots"
  relatedWorkIdentifiers: [String!]
}

type PlanVersionSnapshotOwner {
  id: Int
  name: String
  displayName: String
  uri: String
  homepage: String
}

type PlanVersionSnapshotTemplate {
  id: Int
  title: String
  version: String
}

type PlanVersionSnapshotVersion {
  timestamp: String
  url: String
}

type PlanVersionSnapshotProject {
  title: String
  abstractText: String
  startDate: String
  endDate: String
  researchDomain: PlanVersionSnapshotResearchDomain
}

type PlanVersionSnapshotResearchDomain {
  name: String
}

type PlanVersionSnapshotFunding {
  funderName: String
  funderUri: String
  status: ProjectFundingStatus
  grantId: String
  funderOpportunityNumber: String
  funderProjectNumber: String
}

type PlanVersionSnapshotMemberRole {
  id: Int
  label: String
  uri: String
}

type PlanVersionSnapshotMember {
  name: String
  orcid: String
  affiliationName: String
  isPrimaryContact: Boolean
  memberRoles: [PlanVersionSnapshotMemberRole!]
}

type PlanVersionSnapshotRelatedWork {
  "The unique identifier for the Object"
  id: Int
  "The version of the work"
  workVersion: PlanVersionSnapshotWorkVersion!
}

"""
A lighter-weight view of a WorkVersion for use within a plan version snapshot —
 only the fields needed for citation display, since full work-version metadata
 (hash, institutions, funders, awards, timestamps) isn't preserved in archived snapshots.
"""
type PlanVersionSnapshotWorkVersion {
  "The type of the work"
  workType: WorkType!
  "The date that the work was published YYYY-MM-DD"
  publicationDate: String
  "The title of the work"
  title: String
  "The authors of the work"
  authors: [Author!]!
  "The venue where the work was published, e.g. IEEE Transactions on Software Engineering, Zenodo etc"
  publicationVenue: String
  "The name of the source where the work was found"
  sourceName: String!
  "The URL for the source of the work"
  sourceUrl: String
  "The work"
  work: PlanVersionSnapshotWork!
}

"A lighter-weight view of a Work for use within a plan version snapshot."
type PlanVersionSnapshotWork {
  "The Digital Object Identifier (DOI) of the work"
  doi: String!
}


type PlanVersionSnapshotAnswer {
  id: Int
  questionText: String
  json: String
}
    
  type PlanSearchResult{
    "The unique identifer for the Object"
    id: Int
    "The user who created the Object"
    createdBy: String
    "The timestamp when the Object was created"
    created: String
    "The user who last modified the Object"
    modifiedBy: String
    "The timestamp when the Object was last modifed"
    modified: String

    "The title of the plan"
    title: String
    "The current status of the plan"
    status: PlanStatus
    "The visibility/permission setting"
    visibility: PlanVisibility
    "The DMP ID/DOI for the plan"
    dmpId: String
    "The person who published/registered the plan"
    registeredBy: String
    "The timestamp for when the Plan was registered/published"
    registered: String
    "The funding information for the plan"
    funding: String
    "The names of the members"
    members: String
    "The name of the template the plan is based on"
    templateTitle: String
    "The section search results"
    versionedSections: [PlanSectionProgress!]
    "The versioned template id the plan is based on"
    versionedTemplateId: Int
    "The name of the affiliation that owns the template the plan is based on"
    templateOwnerAffiliationName: String
    "The user who created the plan"
    planCreator: User
  }

  type PaginatedPlanResults implements PaginatedQueryResults {
  "The plans that match the search criteria"
  items: [PlanSearchResult]
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


  "The progress the user has made within a section of the plan"
  type PlanSectionProgress {
    "Whether or not the section is a customization (i.e. added by the user and not part of the original template)"
    sectionType: CustomizableObjectOwnership!
    "The id of the Section"
    versionedSectionId: Int
    "The custom section id if the section is a customization, otherwise null"
    customSectionId: Int
    "The title of the section"
    title: String!
    "The display order of the section"
    displayOrder: Int!
    "The number of questions in the section"
    totalQuestions: Int!
    "The number of questions the user has answered"
    answeredQuestions: Int!
    "The number of required questions in the section"
    totalRequiredQuestions: Int!
    "The number of required questions the user has answered"
    answeredRequiredQuestions: Int!
    "Tags associated with the section"
    tags: [Tag!]
  }

  type PlanProgress {
    "The total number of questions in the plan"
    totalQuestions: Int!
    "The total number of questions the user has answered"
    answeredQuestions: Int!
    "The percentage of questions the user has answered"
    percentComplete: Float!
  }

  enum PlanDownloadFormat {
    CSV
    DOCX
    HTML
    JSON
    PDF
    TEXT
  }

  "The visibility/privacy setting for the plan"
  enum PlanVisibility {
    "Visible only to people at the user's (or editor's) affiliation"
    ORGANIZATIONAL
    "Visible only to people who have been invited to collaborate (or provide feedback)"
    PRIVATE
    "Visible to anyone"
    PUBLIC
  }

  "The status/state of the plan"
  enum PlanStatus {
    "The Plan has been archived"
    ARCHIVED
    "The Plan is still being written and reviewed"
    DRAFT
    "The Plan is ready for submission or download"
    COMPLETE
  }

  "A Data Managament Plan (DMP)"
  type Plan {
    "The unique identifer for the Object"
    id: Int
    "The user who created the Object"
    createdById: Int
    "The user who created the plan"
    planCreator: User
    "The affiliation that owns the plan"
    owner: Affiliation
    "The timestamp when the Object was created"
    created: String
    "The user who last modified the Object"
    modifiedById: Int
    "The timestamp when the Object was last modifed"
    modified: String
    "Errors associated with the Object"
    errors: PlanErrors

    "The project the plan is associated with"
    project: Project
    "The template the plan is based on"
    versionedTemplate: VersionedTemplate
    "The title of the plan"
    title: String
    "The DMP ID/DOI for the plan"
    dmpId: String
    "The status/state of the plan"
    status: PlanStatus
    "The visibility/privacy setting for the plan"
    visibility: PlanVisibility
    "The individual who registered the plan"
    registeredById: Int
    "The timestamp for when the Plan was registered"
    registered: String
    "The language of the plan"
    languageId: String
    "Whether or not the plan is featured on the public plans page"
    featured: Boolean
    "The section search results"
    versionedSections: [PlanSectionProgress!]
    "The progress the user has made within the plan"
    progress: PlanProgress

    "The members for the plan"
    members: [PlanMember!]
    "The funding for the plan"
    fundings: [PlanFunding!]

    "Prior versions of the plan"
    versions: [PlanVersion!]

    "Answers associated with the plan"
    answers: [Answer!]

    "Feedback associated with the plan"
    feedback: [PlanFeedback!]

    "Feedback status"
    feedbackStatus: PlanFeedbackStatus

    "Alternate identifiers for the plan"
    alternateIdentifiers: [AlternateIdentifier!]

    "Indicates that the plan is not editable by the user (i.e. readOnly = true means the user cannot edit the plan)"
    readOnly: Boolean

    "Other works related to this plan's project (e.g. publications, datasets)"
    relatedWorks: [RelatedWorkSearchResult!]
  }
    
  input UpdatePlanInput {
    "The Plan id"
    id: Int
    "The title of the plan"
    title: String
    "The status of the plan"
    status: PlanStatus
    "The visibility of the plan"
    visibility: PlanVisibility
    "The language of the plan"
    languageId: String
    "Whether or not the plan is featured on the public plans page"
    featured: Boolean

    "Alternate identifiers for the plan"
    alternateIdentifiers: [String!]
  }

  type AlternateIdentifier {
    "The unique identifer for the Object"
    id: Int
    "The user who created the Object"
    createdById: Int
    "The user who created the plan"
    planCreator: User
    "The timestamp when the Object was created"
    created: String
    "The user who last modified the Object"
    modifiedById: Int
    "The timestamp when the Object was last modifed"
    modified: String
    "Errors associated with the Object"
    errors: AlternateIdentifierErrors

    "The alternate identifier"
    alternateIdentifier: String
    "The plan associated with the alternate identifier"
    plan: Plan
  }

  "The error messages for the plan"
  type PlanErrors {
    general: String

    versionedTemplateId: String
    projectId: String
    title: String
    dmp_id: String
    status: String
    visibility: String
    registeredById: String
    registered: String
    languageId: String
    featured: String

    members: String
    funding: String
    alternateIdentifiers: String
    relatedWorks: String
  }

  "A version of the plan"
  type PlanVersion {
    "The timestamp of the version, equates to the plan's modified date"
    modified: String
    "The DMP ID for the version"
    dmpId: String
  }

  "Errors associated with the AlternateIdentifier"
  type AlternateIdentifierErrors {
    general: String
    alternateIdentifier: String
    planId: String
  }

  "Input to create/replace a research Project"
  input EntirePlanProjectFragment {
    title: String!
    abstractText: String
    isTestProject: Boolean
    startDate: String
    endDate: String
    researchDomainUrl: String
  }

  "Input to create/replace a Project/Plan member"
  input EntirePlanMemberFragment {
    projectMemberId: Int
    givenName: String
    surname: String
    email: String
    orcid: String
    isPrimaryContact: Boolean
    affiliation: String
    memberRoles: [String!]
  }

  "Input to create/replace a Project/Plan funding"
  input EntirePlanFundingFragment {
    projectFundingId: Int
    funder: String!
    status: ProjectFundingStatus
    funderOpportunityNumber: String
    funderProjectNumber: String
    grantId: String
  }

  "Input to create/replace a Plan answer"
  input EntirePlanAnswerFragment {
    json: String!
    versionedSectionId: Int
    versionedCustomSectionId: Int
    versionedQuestionId: Int
    versionedCustomQuestion: Int
  }

  "Input to create an entire Plan (and Project if applicable)"
  input AddEntirePlanInput {
    "The title of the plan"
    title: String!
    "The status of the plan"
    status: PlanStatus!
    "The visibility of the plan"
    visibility: PlanVisibility!
    "The language of the plan"
    languageId: String!

    "The research project this plan is associated with"
    project: EntirePlanProjectFragment!

    "The id of the template being used (the default template will be used if not provided)"
    versionedTemplateId: Int

    "External identifiers for the plan (for use when integrating with external systems)"
    alternateIdentifiers: [String!]

    "The project members involved with the data described in the plan"
    members: [EntirePlanMemberFragment!]
    "The funding sources associated with the data described in the plan"
    funding: [EntirePlanFundingFragment!]
    "The answers to the questions in the plan's narrative"
    answers: [EntirePlanAnswerFragment!]
  }

  "Input to update an entire Project and Plan"
  input UpdateEntirePlanInput {
    "The title of the plan"
    title: String!
    "The id of the plan (required if no 'dmpId' is provided)"
    id: Int
    "The DMP id of the plan (required if no 'id' is provided)"
    dmpId: String
    "The status of the plan"
    status: PlanStatus
    "The visibility of the plan"
    visibility: PlanVisibility
    "The language of the plan"
    languageId: String

    "External identifiers for the plan (for use when integrating with external systems)"
    alternateIdentifiers: [String!]

    "The research project this plan is associated with"
    project: EntirePlanProjectFragment!

    "The project members involved with the data described in the plan"
    members: [EntirePlanMemberFragment!]
    "The funding sources associated with the data described in the plan"
    funding: [EntirePlanFundingFragment!]
    "The answers to the questions in the plan's narrative"
    answers: [EntirePlanAnswerFragment!]
  }

`;
