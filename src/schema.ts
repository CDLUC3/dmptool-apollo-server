import { mergeTypeDefs } from '@graphql-tools/merge';

import { typeDefs as baseTypeDefs } from './schemas/base.js';
import { typeDefs as adminNotificationTypeDefs } from './schemas/adminNotifications.js';
import { typeDefs as affiliationTypeDefs } from './schemas/affiliation.js';
import { typeDefs as answerTypeDefs } from './schemas/answer.js';
import { typeDefs as collaboratorTypeDefs } from './schemas/collaborator.js';
import { typeDefs as contactUsTypeDefs } from './schemas/contactUs.js';
import { typeDefs as memberTypeDefs } from './schemas/member.js';
import { typeDefs as memberRoleTypeDefs } from './schemas/memberRole.js';
import { typeDefs as feedbackTypeDefs } from './schemas/feedback.js';
import { typeDefs as languageTypeDefs } from './schemas/language.js';
import { typeDefs as licenseTypeDefs } from './schemas/license.js'
import { typeDefs as metadataStandardTypeDefs } from './schemas/metadataStandard.js';
import { typeDefs as planTypeDefs } from './schemas/plan.js';
import { typeDefs as projectTypeDefs } from './schemas/project.js';
import { typeDefs as fundingTypeDefs } from './schemas/funding.js';
import { typeDefs as guidanceTypeDefs } from './schemas/guidance.js';
import { typeDefs as guidanceGroupTypeDefs } from './schemas/guidanceGroup.js';
import { typeDefs as questionTypeDefs } from './schemas/question.js';
import { typeDefs as questionCustomizationTypeDefs } from './schemas/questionCustomization.js';
import { typeDefs as questionConditionTypeDefs } from './schemas/questionCondition.js';
import { typeDefs as questionConditionGroupTypeDefs } from './schemas/questionConditionGroup.js';
import { typeDefs as relatedWorkTypeDefs } from './schemas/relatedWork.js';
import { typeDefs as repositoryTypeDefs } from './schemas/repository.js';
import { typeDefs as researchDomainTypeDefs } from './schemas/researchDomain.js';
import { typeDefs as researchOutputTypeDefs } from './schemas/researchOutputType.js';
import { typeDefs as sectionTypeDefs } from './schemas/section.js';
import { typeDefs as sectionCustomizationTypeDefs } from './schemas/sectionCustomization.js';
import { typeDefs as superAdminTypeDefs } from './schemas/superAdmin.js';
import { typeDefs as tagTypeDefs } from './schemas/tag.js';
import { typeDefs as templateTypeDefs } from './schemas/template.js';
import { typeDefs as templateCustomizationTypeDefs } from './schemas/templateCustomization.js';
import { typeDefs as userTypeDefs } from './schemas/user.js';
import { typeDefs as versionedQuestionTypeDefs } from './schemas/versionedQuestion.js';
import { typeDefs as versionedGuidanceTypeDefs } from './schemas/versionedGuidance.js';
import { typeDefs as versionedQuestionConditionTypeDefs } from './schemas/versionedQuestionCondition.js';
import { typeDefs as versionedSectionTypeDefs } from './schemas/versionedSection.js';
import { typeDefs as versionedTemplateTypeDefs } from './schemas/versionedTemplate.js';
import { typeDefs as passwordResetTypeDefs } from './schemas/passwordReset.js';

export const typeDefs = mergeTypeDefs([
  baseTypeDefs,
  adminNotificationTypeDefs,
  affiliationTypeDefs,
  answerTypeDefs,
  collaboratorTypeDefs,
  contactUsTypeDefs,
  memberRoleTypeDefs,
  memberTypeDefs,
  feedbackTypeDefs,
  fundingTypeDefs,
  guidanceTypeDefs,
  guidanceGroupTypeDefs,
  languageTypeDefs,
  licenseTypeDefs,
  metadataStandardTypeDefs,
  planTypeDefs,
  projectTypeDefs,
  questionTypeDefs,
  questionConditionTypeDefs,
  questionConditionGroupTypeDefs,
  questionCustomizationTypeDefs,
  relatedWorkTypeDefs,
  repositoryTypeDefs,
  researchDomainTypeDefs,
  researchOutputTypeDefs,
  sectionTypeDefs,
  sectionCustomizationTypeDefs,
  superAdminTypeDefs,
  tagTypeDefs,
  templateTypeDefs,
  templateCustomizationTypeDefs,
  userTypeDefs,
  versionedGuidanceTypeDefs,
  versionedQuestionTypeDefs,
  versionedQuestionConditionTypeDefs,
  versionedSectionTypeDefs,
  versionedTemplateTypeDefs,
  passwordResetTypeDefs,
]);
