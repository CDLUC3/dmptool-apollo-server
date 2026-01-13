# DMP Tool Apollo Server Change Log

### Updated
- Updated tests and isValid functions on `Question`, `VersionedQuestion` and `Answer` to work with new version of `@dmptool/types` v2.0
- Related works stored procedures so that they can insert existing related works and ground truth data.

### Added
- Added `hasAssociatedPlans` method to VersionedTemplate model to check if any plans are associated with a template
- Added `deactivateByTemplateId` method to VersionedTemplate model to deactivate all versionedTemplates for a given template
- Added unit tests for `hasAssociatedPlans` and `deactivateByTemplateId` methods in VersionedTemplate model
- Added unit tests for `archiveTemplate` resolver in template resolver
- Added `overrides` section to `package.json` for `qs` since `supertest` is still using old version
- Added `slug` to tags array returned in `PlanSectionOverview`
- Added new `ssoPassthruController` and `ssoCallbackController` stub controllers
- Added a `findByEmailDomain` endpoint to the `Affiliation` model

### Updated
- Fixed issue with package-lock which was using local `../dmptool/types` instead of `@dmptool/types`
- Upgrade `express` due to vulnerability in `qs`
- Fixed data-migration script: `2025-12-01-1512-add-recommended-licenses.sql` [#552]
- Updated `RepositoryType` enum to cover all the ones in our db [#552]
- Update Repository model to get all unique repositoryTypes from db and return that info [#552]
- Updated repository resolver to return `subject areas` [#552]
- Fixed auth0/node-jws vulnerability [#552]

### Fixed
- Fixed relatedWorksTables.spec.ts tests.
- Fixed a small data-migration issue related to using the wrong createdById
- Updated `auth0/node-jws Improperly Verifies HMAC Signature` due to vulnerability
============================================================================
prior to 2025-12-05

### Added
- Added local data migrations to set default member role and set the createdById for seed users 
- Added a `allProjects` resolver to return all projects relevant to the Admin
- Added a new `test-no-db` script to `package.json` to run all tests but the ones that need a running docker env
- Added a data migration SQL file to drop all existing tables and recreate with `utf8mb4_0900_ai_ci` collation and use of `INT UNSIGNED` for ids
- Added a data migration SQL file to create the stored procedures needed by the related works matching process
- Added seed SQL files for use in local dev environments
- Added models, resolvers, mutators for Guidance, GuidanceGroup, VersionedGuidance and versionedGuidanceGroup [#12]
- Added `AffiliationDepartments` model
- Added `TemplateLinks` and `VersionedTemplateLinks` models
- Added `slug` to the `Tag` schema

### Updated
- Updated `archiveTemplate` resolver to check for associated plans before deleting: if plans exist, unpublishes the template by clearing `latestPublishVersion` and `latestPublishDate`, setting `isDirty` to true, and deactivating all related versionedTemplates; if no plans exist, deletes the template as before
- Added `description` column to `guidanceGroups` and `versionedGuidanceGroups` db tables [#528]
- Added `description` to `GuidanceGroup` model
- Fixed issue in `VersionedGuidance` model's `create` method to ignore `tagId` [#528]
- Added `user` chained resolver to `guidance` resolver [#528]
- Added `description` to `guidanceGroup` resolver, and added both `user` and `versionedGuidanceGroup` chained resolvers [#528]
- Updated `guidanceService` to get current tags for the guidance to add them to versionedGuidanceTags table [#528]
- Fixed an issue with the the `addProject` resolver not returning errors
- Updated `planService` to save roles for the default plan member
- Updated ORCID datasource so that the API and Auth URLs are independent: Removed `ORCID_BASE_URL` and replaced with `ORCID_API_BASE_URL`, `ORCID_AUTH_BASE_URL`
- Updated the README to reflect recent changes
- Updated dependencies: `@aws-sdk/client-dynamodb`, `@graphql-tools/merge`, `ts-jest` and `@eslint/js`
- Updated the `myProjects` resolver to only return the projects the user owns or collaborates on
- Updated husky precommit hook to run `npm run test-no-db`
- Updated the `data-migrations/process.sh` script so that you can pass a `local` argument which will run all migrations in the `local-only` subdirectory
- Bumped the node version in the Dockerfiles to 22.x
- Renamed local DB in `docker-compose.yaml` from `dmsp` to `dmptool`
- Updated `affiliationEmailDomains` to use the `affiliations.uri` as the FKey
- Updated `data-migrations.process.sh` script to use `utf8mb4_0900_ai_ci` collation when creating the database
- Replace `findByURL` with `findByAffiliationAndURL` in `AffiliationLinks` model
- Updated `Projects` model so that the search includes both `DRAFT` and `COMPLETE` plans by default. Migrated data wasn't showing up because it was `COMPLETE`
- Fixed some typos in `AffiliationLinks` model and updated to use `affiliationId` as a URI
- Updated `Tag` model to include new `slug` field
- Updated `User` model to include the new `oldPasswordHash` field

### Deleted
- Removed old `Output` and `OutputType` models and references to them in `Repository`, `MetadataStandard`, `Project` and `Plan` models
- Removed references to `outputs` from schemas and reslvers
- Removed the `@types/eslint__js` dependency because `@eslint/jest` includes its own types now

### Fixed
- Removed the setting of `dmspr` token in the `refreshTokenController` because it was overriding the expiration of that refreshToken to be the same as the default `authToken`

============================================================================
prior to 2025-10-21

### Added
- Added migration for the `guidance`-related tables [#483]
- Added planFeedbackStatus resolver and tests (status of NONE, REQUESTED, COMPLETE)
- Added related works resolvers and tests.
- Added data migration to ensure collaborator tables allow for NULL in `userId` field
- Added tables to support template customizations
- Added stub models for each new template customization table with comments on what needs to be done
- Added dependabot config
- Added new `parameterStore` datasource to fetch values from AWS Systems Manager Parameter Store
- Add new ENV variables `ORCID_CLIENT_ID`, `ORCID_CLIENT_SECRET`, `ORCID_BASE_URL`, `ORCID_AUTH_PATH` and `ORCID_READ_ONLY_SCOPE`.
- Added `src/config/ocidConfig` to provide access to the above ENV variables and also defaults for some of them
- Added new `src/datasources/orcid` to support interactions with the ORCID API
- Added `findPotentialCollaboratorByORCID` and `findPotentialCollaboratorsByTerm` to the `ProjectCollaborator` model:
- Added a `findByOrcid` function to the `User` model
- Added relatedWorks, workVersions, and works tables to database and two stored procedures that will be used to update the related works.
- Added tmp dir for jest caching (ignored by git)
- Added Trivy scan and `npm run build` to precommit hooks
- Added some logic to the `prepareObjectForLogs` function to redact sensitive info
- Added `redact` to the pino logger to prevent sensitive information from being logged
- Added ability for `VersionedSections` `search` function to return only `bestPractice` sections, only sections without `bestPractice` or all sections[#436]
- Added resolver to handle resending of invite for project collaborators [#433]
- Added bash to AWS Dockerfile for session manager
- Added `CONTRIBUTING.md` and `CODE_OF_CONDUCT.md` files
- Added a data migration script to update `visibility` to `latestPublishVisibility` in `templates` table. [#405]
- Added code to update `latestPublishVisibility` whenever a `template` is published [#405]
- Added model/resolver for `PlanProgress` and nested `progress` in `Plan` resolver [#720]
- Added checks in `ProjectMember` and `PlanMember` to prevent the deletion of a member if they are the last one [#358]
- Added a fallback to set a `default` role if none was provided while adding a new `ProjectMember` [#358]
- Added `findDMPIdsForEmail` helper method to `TokenService` so that the JWT will now contain a list of DMP ids and the user's access level
- Added `hasPermissionOnPlan` to the `planService` that checks the info contained within the token to determine access instead of making DB calls
- Added `ProjectFilterOptions` as a possible input for the `myProjects` resolver
- Added `PlanFeedback` and `PlanFeedbackComments` models [#243]
- Added `projectCollaboratorCommentsAdded` to `emailService` so that we can email `project collaborators` when new comments added [#243]
- Added comment mutations to `answers` resolver and created `feedback` resolver [#243]
- data migration to change collation to `utf8mb4` on all tables
- added `publishedSection` resolver to `src/resolvers/versionedSection.ts`
- added `publishedQuestion` resolver to `src/resolvers/versionedQuestion.ts`

### Updated
- Updated the `js-yaml` dependency
- Updated `popularFunders` resolver to return only 5 popular funders [#500]
- Upgrade `nodemailer` from `6.10.1` to `7.0.10` to address security vulnerability
- Updated `ORCID_REGEX` in `helper.ts` so that urls can be submitted without a the `www.` Also, added `stripORCIDIdentifierBaseURL` to just strip out all protocols and domains to extract the OrcidID [#251]
- Updated `OrcidAPI` to handle `404` errors so that we return null rather than throwing an error [#251]
- Updated `addProjectMemberInput` schema to include `affiliationName` since we are using a TypeAhead field and sometimes we only get the `affiliationName` [#251]
- Updated `addProjectMember` resolver to use either `affiliationId` or `affiliationName` to process affiliation info [#251]
- Updated related works resolvers to return aggregated counts for the UI, and modifications to some fields in database for UI.
- Updated the `findCollaborator` resolver to allow for searching by ORCID or by a search term. 
- Updated cursor pagination logic to accept sort information
- Update `user.register` model function to auto-accept all open template and project collaboration invites
- Upgraded @dmptool/types to v1.2.3 in package.json and rebuilt package-lock
- Updated `answer` and `addAnswerComment` permissions to include a collaborator who has `COMMENT` privileges [#243]
- Update `removeAnswerComment` and `removeFeedbackComment` to allow deletion by creator, plan creator, or OWN-level collaborator [#243]
- Created `commentPermissions.ts` service to determine if a comment can be deleted [#243]
- Updated `docker-compose.yaml` to use the `dmptool-network` which will be shared with other repos
- Updated `answer`, `fundings`, `members` and `plans` resolver to use new `hasPermissionOnPlan` function
- Update the `tokenService` to add `dmpIds` array that stores the DMPs the user has access to
- Updated the `ProjectSearchResult.search` query to provide plan counts by status and filter by status options
- updated all existing data migrations and scripts to use `utf8mb4` instead of `utf8mb3`
- updated `PlanSectionProgress` to use better terminology. Changed `sectionId` to `versionedSectionId` (what it really was) and `sectionTtitle` to `title`
- changed `sections` resolver to `versionedSections` on the `src/resolvers/plan.ts` file and changed the reference for `PlanSearchResult.sections` to `versionedSections`

### Fixed
- Fixed migration error for versionedGuidance where can't be too strict since NULLs set for deleted parent Guidance. Related to [#12]
- Fixed breaking build by removing `NODE_ENV=production` before `npm ci` which was skipping devDependencies, but needed for the build process.
- `addSection` mutation resolver was not saving `tags`. Added code to add tags for new section [#445]
- Fixed issue where updating an answer, funding or members was not triggering the creation of a new PlanVersion
- Fixed bug with maintaining the latest PlanVersion (common standard JSON) when a plan is updated
- Fixed issue where the title of the DMP in the common standard JSON is using the template title instead of plan title
- Updated `PlanSectionProgress`model so it correctly shows how many answers have been filled. [#719]
- Fixed an issue where signup failed because context had been reset to different object
- Fixed an issue causing the DMP version to not include sections/questions in the narrative if they had not been answered
- Fixed an issue with the null/undefined check on model queries that use 'searchTerm'
- When generating a new `versionedTemplate`, we need to deactivate the old ones in the db [#363]
- Bug with `FunderPopularityResult` in the GraphQL schema that was making `apiTarget` non-nullable
- added a data migration script to repair bad option based question JSON

### Removed
- Removed `dmproadmap_template` from the common standard. That information is now stored in `dmproadmap_narrative`
- Removed `dmpIds` array from the JWT payload.
- Removed `hasPermissionOnPlan` function from `planService` since JWT no longer has `dmpIds` array

### Chore
- Addressed `fast-redact` vulnerability by updating the `pino` version to `9.12.0`, which removes fast-redact

## v0.2 - Initial deploy to the stage environment

### Added
- Added `findFilledAnswersByQuestionIds` which takes plan and question ids and only returns filled answers for those questions.
- Added data migration to clean up old question JSON so it conforms with new @dmptool/types schemas
- Added data migration to drop the old `questionTypes` table
- Added `updatePlanFunding` to allow the update of multiple `planFunding` records [#305]
- Added 'apiTarget' to the PopularFunders objects and query for use in the frontend
- Added `updatePlanTitle` resolver
- Added a `title` field to the `plans` table and then updated Plan model and schema to use it
- Added a `normaliseDateTime` function in `utils/helper.ts`
- Added `projectMembers.isPrimaryContact` field to DB and `ProjectMember` model and GraphQL schema
- Added `setCurrentUserAsProjectOwner` and `ensureDefaultProjectContact` functions to the `projectService` and updated the `project` resolver to call them.
- Added the new `ensureDefaultPlanContact` function to the `planService` module and updated the `plan` resolver to use it
- Added a `sendEmailNotification` argument to the `create` function of `ProjectCollaborator` (defaults to true) so that we can bypass sending an email when setting the project creator as the default contact.
- Added `PlanMember.findPrimaryContact` function
- Added `return formatISO9075(new Date(parent.blah));` to all resolvers so that dates are always in the correct format
- Added `invitedBy` to the `ProjectCollaborator` resolver
- Added SQL script to convert `affiliations.types` to upper case to work with the `AffiliationType` enum
- Added a `validateConnection` function to the mysql datasource
- Added time constraints to the `Affiliation.top20` function so that it is inclusive of the current day
- Added `sqlStatement` to the log output when `MySQLModel.query` fails
- Added `getEmail` method to the `User` model to retrieve the email address for a user.
- Added a new resolver for `answerByVersionedQuestionId` so that we can get the question-specific answer to populate the question in the Question detail page.
- Added a new MySQL container to host the test DB to the docker compose stack
- Added JSON column `questionType` to `questions` and `versionedQuestions` tables
- Added JSON column `json` to the `answers` table
- Added the new [@dmptool/types](https://github.com/CDLUC3/dmptool-types) package 
- Added `reorderDisplayOrder` herlper function to help maintain the `displayOrder` field on a set of objects
- Added `updateDisplayOrders` to both the `sectionService` and `questionService`
- Added `updateSectionsDisplayOrder` and `updateQuestionsDisplayOrder` schema and resolvers
- Added data migrations for new `versionedSectionTags` table and seed script
- Added `maxDisplayOrder` queries to Section model
- Added `aws-process.sh` to allow migrations to be run in the AWS environment
- Added `init-tables` and `init-seed` data migration files
- Added `queryWithPagination` function to `MySQLModel`.
- Added `VersionedSectionSearchResult` to optimize the query for displaying an org's published sections and the bestPractice sections
- Added `popularFunders` query to the `affiliations` resolver
- Added `accessLevel` to projectCollaborator and removed `userId`
- Added new resolvers related to `projectCollaborators`. Also, when project is created, automatically add user as `projectCollaborator` with `access level`= `OWN`
- Added dynamoDb to the docker-compose file and setup dev to use the local instance
- Added tests for `plan` resolver and added tests for `contributor` resolver's queries
- Added mocks for most of the MySQL tables and the Dynamo table
- Added a new `dynamo` datasource (to replace the DMPHub API one ... much faster to access the table directly)
- Added `getAwards` method to `DMPHubAPI`.
- Added `searchExternalProjects` query and `projectImport` mutation.
- Added `TemplateSearchResult`, `VersionedTemplateSearchResult` and `ProjectSearchResult` to optimize querying
- Added `sections` to `Plan` schema and to plan resolver
- Added the `relatedWorks` data migration
- Added model and resolvers for `RelatedWork`
- Added model and resolvers mutations for `PlanContributor` and `PlanFunder`
- Added the `Answer`, `AnswerComment` model and supporting resolvers
- Added the `PlanVersion` table and model
- Added a `commonStandardService` and a `planService`
- Added the `apiTarget` to the `affiliations` table
- Added `Plan`, `PlanFunder`, `PlanContributor`, `ProjectCollaborator`, `DMP` and `RelatedIdentifier` models
- Added data-migration script to add additional columns to the `plans` table
- Added data-migration to add `isPrimaryContact` flag to the `planContributors` table
- Added new seed data-migration for `plans`, `planContributors`, `planFunders`
- Added "mocks" for use in tests for `Affiliation`, `Collaborator` (Template/Project), `Contributor` (Project/Plan), `ContributorRole`, `Funder` (Project/Plan), `Plan`
- Added a `findById` function to the `VersionedTemplate` model
- Added a default ORCID base URL and regex to `User` model
- Added `getMockDOI` and `getMockDMPId` helper functions for tests
- Added an `IsNullOrUndefined` and `valueIsEmpty` (null, undefined or an empty string) helper functions
- Added `config/dmpHubConfig.ts` for DMPHub specific configuration
- Added `projectPlans` join table which acts as a bridge between the `projects` table in the MySQL database and the `plans` stored in the DMPHub DynamoDB table
- Added model mocks for Affiliation and Collaborator
- Added resolver integration tests for affilian and collaborator resolvers
- Added `useSampleTextAsDefault` column to questions table and add `admins` to Template schema and chained it in the resolver
- Added `requestId` to the Apollo context
- Added `questionOptions` schema, resolver and `QuestionOption` model, which will be used for `option` question types
- Added a new query to get all versionedTemplates, called `myVersionedTemplates`, under user's affiliation, and added a new method in the model called `findByAffiliationId`
- Updated `templates` resolver to handle updates to `sections` and `questions` when copying a `template`
- Added "remove" method to SectionTag model. Updated "updateSection" method in Section resolvers to remove sectionTags when user is updating their Section. Added "getTagsToRemove" method to the Section resolver. Added associated unit tests.
- Added "lastPublishedDate" field to templates table, and changed "currentVersion" field to "lastPublishedVersion"
- Added support for creating "other" affiliations
- Added update and updatePassword to User
- Added resolvers for User
- Added userService to handle random password generation, anonymization and merging
- Added recordLogIn and update functions to User model
- Added data-fns package to help with Date validation and formatting
- Added Language model, resolver and type. Added LanguageId to User and Template
- Built Question resolvers and models(#13)
- Fixed some bugs to allow frontend to access token change(Frontend #116)
- Added data migrations for QuestionType, Question, QuestionCondition, VersionedQuestion and VersionedQuestionCondition
- Added missing VersionedQuestionCondition schema file
- Added schemas for Question, QuestionType, QuestionCondition and VersionedQuestion
- Added resolvers and models for Section, Tag and VersionedSection
- Added acceptedTerms to User schema and to user sql table
- Added schema for Section and Tag
- Initial schema, model, mocks and resolver for Templates
- Initial schema, model, mocks and resolver for Collaborators
- added templateService to assist with actions that work on a Template and all of it's child objects
- Added stub emailService as a placeholder for now. We will build that out once the AWS infrastructire is in place
- Added new `src/__mocks__/context` to mock the Apollo Server context object
- Added `insert`, `update` `delete` functions to the `MySqlModel` abstract class
- Missing data-migration for the dataMigrations table
- Script to nuke the DB so it can be easily rebuilt from scratch
- Added husky precommit tasks
- Added data migrations for Section and Tag
- Added Redis to the docker-compose file
- Added Cache data source (and tests)
- Added CSRF middleware
- Added signoutController and refreshTokenController
- Added tests for all Controllers
- Added supertest to support integration tests
- Added integration tests for token management (signin, signup, signout, refresh)
- Data migrations for affiliations table
- Added Project, ProjectContributor, ProjectFunder schemas and supporting tables
- Added Plan, PlanContributor, PlanCollaborator, PlanFunder, PlanFeedback, PlanFeedbackComment, Answer and AnswerComment schemas and supporting tables
- Added models and resolvers for MetadataStandard, Repository, ResearchDomain, and License
- Added models and resolvers for ProjectContributor, ProjectFunder, ProjectOutput and Project

### Updated
- Updated to work with the new @dmptool/types v1.2.0
- Updated all resolvers to call `normaliseDateTime` for the date fields 
- Replace old `ProjectMember.findPrimaryByPlanId` function with `ProjectMember.findPrimaryContact`
- Updated the `project` resolver and schema so that `searchExternalProjects` has its own `input` type definition
- Exposed the DynamoDB port in the local `docker-compose.yaml` so that AWS CLI commands can be run against it
- Discovered some intermittent issues with the new MySQL connection pool. Changed `keepAliveInitialDelay` to zero and also added an `initPromise` to the class so that we can effectively wait for the connection pool to finish initializing before attaching it to the Apollo server context
- Updated the `index.ts` to use the new `initPromise` and also added some missing `process.exit` statements
- Found that `Collaborator` classes were not awaiting the call to `super` in their `isValid` functions
- Fixed an issue where `isValid` was being called too soon in the `Collaborator` classes
- Fixed an issue with `PlanMember` classes' `findByProjectMemberId` function so that it returns an empty array instead of null
- Fixed some typos in `MemberRole` SQL queries
- Fixed a bug where `Plan.isPublished` was not returning the correct result
- Fixed a bug where `Plan.visibility` was not being defaulted to `PRIVATE`
- Fixed a bug on `Project` model that was not allowing SuperAdmins or Admins to fetch a Project
- Fixed a bug where `ProjectSearch` was still trying to fetch the user's email from the old table
- Fixed a bug that was preventing `ResearchDomain.create` from working because `parentResearchDomain` is an unknown field
- Fixed a bug on `VersionedSection` so that `findBySectionId` and `findByTemplateId` return an empty array instead of null when no results are found
- Fixed a bug on the `affiliation` resolver that was incorrectly checking the record's provenance
- Fixed some bugs in the permissions checks for `collaborator`, `member`, `funding`, `project` and `plan`
- Fixed an issue with the `planFunder` schema that was referencing `project` instead of `plan`
- Fixed some auth check bugs in `templateService`
- Fixed bug with `Affiliation.top20` query which was still referencing the old `projectFunders` table 
- Updated package.json and tsconfig.json with options for sourcemaps which is supposed to help making debugging/breakpoints in IDEs more reliable.
- Updated most tests since they mostly require tokens which require email which is now async because it comes from the UserEmail model.
- Updated resolvers, models and controllers to use correct methods for using email from the UserEmail model (or use convenience method `getEmail` on the User model).
- Updated table `user.failed_sign_in_attemps` to be spelled correctly as `failed_sign_in_attempts`
- Updated `sections` and `questions` queries to order by `displayOrder` [#324]
- Refactor the way we initialize the pino Logger and pass it around. Also removed the old `formatLogMessage` function and replaced with `prepareObjectForLogs`
- Consolidated handling of the Cache, so that we always pass the `adapter`
- Updated `mysqlConfig` to use the new test DB when running in `test` mode
- Refactored `mysql` datasource to properly use a connection pool. Updated the `index.ts` to initialize the connection pool and then pass it, the dmpHubAPI, cache and logger around properly.
- Updated `data-migrations` scripts to work with new test MySQL DB in  the docker compose stack
- Updated the `Question` schema to allow `questionJSON: String` to be used in GraphQL query
- Updated `Question` model to access `questionJSON` input, parse the JSON using the Zod schemas provided by `@dmptool/types`, and populate the `questionType` with the parsed JSON.
- Updated cursor pagination to always return `null` for `nextCursor` if we are at the end of the results
- Rename all occurrences of `Contributor` to `Member` and `Funder` to `Funding` to match newer terminology
- Updated `addSection` resolver to properly copy questions and tags when creating a new section by copying one
- Replaced all instances of `TemplateVisibility.PRIVATE` with `TemplateVisibility.ORGANIZATION` [#159]
- Renamed the `outputTypes` table to `projectOutputTypes`
- Updated `buildspec` to allow for a "MODE" env variable to be set so that we can run migrations, tests and the build separately
- Updated `publishedTemplates`, `users`, `myTemplates`, `topLevelResearchDomains`, `repositories`, `myProjects`, `metadataStandards`, `licenses`, `affiliations` queries to use the new `paginationService`
- Updated `publishedTemplates`, `users`, `myTemplates`, `topLevelResearchDomains`, `repositories`, `myProjects`, `metadataStandards`, `licenses`, `affiliations` queries to use the new `paginationService`
- Updated `publishedSections` resolver to return the new `VersionedSectionSearchResult` array
- Format ORCID identifiers consistently, in the `Contributor` and `User` models, the `projectImport` resolver and `orcid` scalar.
- Changed a number of GraphQL definitions to PascalCase.
- Fixed projectCollaborators table which had an FKey on the plans table instead of the projects table
- Updated the `dmpHubAPI` datasource to support CRUD operations
- Updated the `Plan` resolver and model to support mutations
- Updated the `Affiliation` schema and model to include the new `apiTarget` property.
- Renamed old `planCollaborators` table to `projectCollaborators`
- Renamed old `PlanCollaborator` resolved functions so that they point to `ProjectCollaborator` since we decided to capture that at the project level
- Updated `ProjectService` permission check so that it looks at the ProjectCollaborators as well
- Updated `QuestionCondition` model to return the object with functions
- Updated `ContributorRole` model so that it has functions to associate them with `PlanContributor` records.
- Moved config for `dmpHubAPI` from the datasource into a `config/dmphubConfig.ts` file
- Removed old unused `Affiliation` methods from `dmpHubAPI` and added `getDMP` and `validate` (for use in the near future when syncing changes within our system and the DMPHub)
- Updated structure of `cacheConfig.ts` to match other configs
- Moved config for `MysSQLDataSource` from the datasource into its config file
- Moved `SigTerm` handler tests for `mysql` into a separate test file. They were failing for some reason when run together
- Refactored `context.ts` and tests to use new `dmpHubAPI` datasource
- Refactored old "mocks" to extract duplicative code into the `MySQLMock.ts`
- Update existing resolver tests to use new mocks
- Made sure all config entries were covered in the `__tests__/setup.ts`
- Updated the `emailService` to support `projectCollaborators` instead of `planCollaborators`
- Updated `question` and `section` resolvers to update `isDirty` in associated `template` when mutations were made. That way a user can `Save Draft` in the `Edit Template` page.
- Updated models and resolvers to handle errors in a consistent way
- Refactored the way Sections handle the association with Tag to follow pattern used elsewhere
- Updated `formatLogMessage` to accept the Apollo context instead of the logger so that it can being to record the `requestId`, `jti` and `userId` (when available)
- Updated `questionTypes` table to remove 'Rich Text Editor' and to add `usageDescription`. Also, updated Question model's `create` method to allow for entries with duplicate `questionText`
- Updated User update method to prevent password manipulation
- Updated User registration so that the terms and conditions must have been accepted
- Updated User schema, model and data migrations with new properties
- Change default JWT TTL to 30 minutes
- Added user id to the JTI to help ensure uniqueness
- Update sign out controller to always clear the cookies and return 200 regardless of the state of the tokens
- Updated `src/context.ts` to use a `buildContext` wrapper function that can be called when building the context for Apollo Server and our `signin` and `signup` endpoints.
- Updated use of `toUTCString()` to `toISOString()`
- Updated `tokenService` to properly catch and throw errors
- Updated `graphQLErrors` with more error types
- Added MariaDB to docker-compose
- data-migrations/README.md with instructions on running migrations in the Docker container
- tokenService now supports refresh tokens, CSRF tokens and signout
- updated express middelware to fetch the access token and refresh tokens from the cookies instead of the headers
- removed old oauth-server package which had security vulnerabilities
- moved authMiddleware function from the router.ts into its own class in src/middelware
- updated Affiliation Schema, Resolver, Models to use new affiliations tables in the database
- updated all of the cache key structures to wrap them in `{}` due to the way Redis handles keys in cluster mode
- updated emailService to use nodemailer and to support emailConfirmation templateCollaboration and planCollaboration email messages
- added bestPractice flag to the Section

### Removed
- Removed self referential foreign key constraints from the `users` table (makes it impossible to delete user records)
- Removed `NOT NULL` constraint from the `users.affiliationId` field (makes it hard to create an initial user record)
- Dropped the `versionedQuestions.questionTypeId` field and foreign key constraints (missed this one when those changes were made)
- Removed test MySQL from the docker-compose.yaml
- Removed test DB values from `.env.example`
- Removed logic that used the test MySQL DB in the `data-migrations/nuke-db.sh` and `data-migrations/process.sh` scripts
- Dropped the `email` from the `users` table
- Dropped FKeys on `users` and `affiliations`
- Dropped `questionTypes` and `questionOptions` tables
- Dropped the `questionTypeId` field from the `questions` and `versionedQuestions` tables
- Dropped the `answerText` field from `answers`
- Removed the old `QuestionType` and `QuestionOptions` schema and resolvers
- Removed the `getQuestionOptionsToRemove` from `questionService`.
- Dropped all previous `data-migration` files in favor of the new `init-tables` and `init-seed` files
- Removed duplicate section check from `Section.create` that was just going off of the "name"
- Dropped the `PlanVersion` table
- Removed `prepareAPITarget` function.
- Removed `id` from `Project` model's constructor (already handled in base `MySQLModel`)
- Removed old `dmphubAPI` datasource and renamed `dmptoolAPI` to `dmpHubAPI`
- Old DMPHubAPI datasource and renamed DMPToolAPI to DMPHubAPI since that one had all of the new auth logic

### Fixed
- Added `publishedQuestions` to the `versionedQuestion` resolver to return all published questions with boolean for answered or not.
- Fixed a bug where clients calling `createTemplateVersion` in the `template` resolver would get an error when trying to publish because adding data to `versionedQuestions` required that `questionTypeId` not be null. I added a data-migration script to allow null because I believe we store the question type in the `json` field now and do not require `questionTypeId` [#328]
- Update profile was not working due to missing `createdById` and `modifiedById` values in db. Added data migration script to populate those fields [#278]
- Fixed myTemplates query so that `TemplateSearchResult` returns the `ownerDisplayName` specified in schema.
- Fixed an issue where adding `templateCollaborators` was failing due to the fact that the `userId` field was required.
- Was getting `undefined` bestPractice in `updateTemplate` when none was passed in because of the logic on how it was set. Added a check for whether `bestPractice` is defined before setting value. Also, added an update to `createTemplateVersion`, so that errors from the `generateTemplateVersion` will be caught and passed back in graphql response. Previously, when trying to save a DRAFT of a template, the mutation wouldn't return an error to the client, even though the `Save draft` did not successfully complete. [#265]
- Removed `Copy of` from in front of copied `Section` and `Template` names [#261]
- Fixed an issue where adding `templateCollaborators` was failing due to the fact that the `userId` field was required.
- Fixed an issue where adding `projectCollaborators` was failing due to the fact that the `userId` field was required. This should not be required to add a new collaborator [#260]
- When calling `updatePlanContributors`, the resolver should set isPrimaryContact to `false` for all contributors other than the one marked as isPrimary.
- Fixed an issue where Jest tests failed on Linux due to case-sensitive file paths. The tests passed on macOS because its file system is case-insensitive by default.
- Fixed bugs related to addPlanContributor and updatePlanContributor since these were not working without missing contributorRoles
- Converted DateTimeISO to String in schemas so that dates could be inserted into mariaDB database, and updated MySqlModel and associated unit test

## v0.0.1
Initial Apollo Server build

### Added
- Added unit tests for User model and contributorRole resolver, and added @types/pino
- Added editor config
- initial Apollo server config
- Initial Schema for ContributorRole
- Initial Schema for DMSP
- Resolvers for ContributorRole
- Initial resolver to fetch a single DMSP from the DMPHub API
- Initial DMPHub API data source
- Initial MySQL data source
- Custom GraphQL scalars for ROR, ORCID and DMSP IDs
- Mechanism for Apollo to use mocks when a resolver has not yet been implemented
- Mocks for User
- Data migration mechanism `./data-migrations/process.sh`
- Documentation!
- Local Docker Compose config
- Pino logger with ECS formatter
- Plugin to log request/response lifecycle events
- Add Logger to the context and then used it in the resolvers
- Schema, Mocks, Models and Resolvers for Affiliations and tests for the Models and Resolvers
- Added new DataSource for the DmptoolApi with endpoints for Affiliations and a new mock for this data source for use in tests

### Updated
- Made some updates to auth code based on testing out recent changes with frontend [#34]
