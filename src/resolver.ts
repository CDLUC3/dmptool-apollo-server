import { mergeResolvers } from '@graphql-tools/merge';
import { IResolvers } from '@graphql-tools/utils';

import { dmspIdScalar } from './resolvers/scalars/dmspId.js';
import { orcidScalar } from './resolvers/scalars/orcid.js';
import { rorScalar } from './resolvers/scalars/ror.js';
import { md5Scalar } from "./resolvers/scalars/md5.js";

import { resolvers as adminNotificationResolvers } from './resolvers/adminNotifications.js';
import { resolvers as affiliationResolvers } from './resolvers/affiliation.js';
import { resolvers as answerResolvers } from './resolvers/answer.js';
import { resolvers as collaboratorResolvers } from './resolvers/collaborator.js';
import { resolvers as contactUsResolvers } from './resolvers/contactUs.js';
import { resolvers as feedback } from './resolvers/feedback.js';
import { resolvers as memberResolvers } from './resolvers/member.js';
import { resolvers as memberRoleResolvers } from './resolvers/memberRole.js';
import { resolvers as fundingResolvers } from './resolvers/funding.js';
import { resolvers as guidanceResolvers } from './resolvers/guidance.js';
import { resolvers as guidanceGroupResolvers } from './resolvers/guidanceGroup.js';
import { resolvers as languageResolvers } from './resolvers/language.js';
import { resolvers as licenseResolvers } from './resolvers/license.js';
import { resolvers as metadataStandardResolvers } from './resolvers/metadataStandard.js';
import { resolvers as planResolvers } from './resolvers/plan.js';
import { resolvers as projectResolvers } from './resolvers/project.js';
import { resolvers as questionConditionResolvers } from './resolvers/questionCondition.js';
import { resolvers as questionCustomizationResolvers } from './resolvers/questionCustomization.js';
import { resolvers as questionResolvers } from './resolvers/question.js';
import { resolvers as relatedWorkResolvers } from './resolvers/relatedWork.js';
import { resolvers as repositoryResolvers } from './resolvers/repository.js';
import { resolvers as researchDomainResolvers } from './resolvers/researchDomain.js';
import { resolvers as researchOutputResolvers } from './resolvers/researchOutputTypes.js';
import { resolvers as sectionCustomizationResolvers } from './resolvers/sectionCustomization.js';
import { resolvers as sectionResolvers } from './resolvers/section.js';
import { resolvers as superAdminResolvers } from './resolvers/superAdmin.js';
import { resolvers as tagResolvers } from './resolvers/tag.js';
import { resolvers as templateResolvers } from './resolvers/template.js';
import { resolvers as templateCustomizationResolvers } from './resolvers/templateCustomization.js';
import { resolvers as userResolvers } from './resolvers/user.js';
import { resolvers as versionedGuidanceResolvers } from './resolvers/versionedGuidance.js';
import { resolvers as versionedQuestionResolvers } from './resolvers/versionedQuestion.js';
import { resolvers as versionedQuestionConditionResolvers } from './resolvers/versionedQuestionCondition.js';
import { resolvers as versionedSectionResolvers } from './resolvers/versionedSection.js';
import { resolvers as versionedTemplateResolvers } from './resolvers/versionedTemplate.js';
import { resolvers as passwordResetResolvers } from './resolvers/passwordReset.js';

const scalarResolvers = {
  DmspId: dmspIdScalar,
  Orcid: orcidScalar,
  Ror: rorScalar,
  MD5: md5Scalar
}

export const resolvers: IResolvers = mergeResolvers([
  scalarResolvers,
  adminNotificationResolvers,
  affiliationResolvers,
  answerResolvers,
  collaboratorResolvers,
  contactUsResolvers,
  feedback,
  memberResolvers,
  memberRoleResolvers,
  fundingResolvers,
  guidanceResolvers,
  guidanceGroupResolvers,
  languageResolvers,
  licenseResolvers,
  metadataStandardResolvers,
  planResolvers,
  projectResolvers,
  questionConditionResolvers,
  questionCustomizationResolvers,
  questionResolvers,
  relatedWorkResolvers,
  repositoryResolvers,
  researchDomainResolvers,
  researchOutputResolvers,
  sectionCustomizationResolvers,
  sectionResolvers,
  superAdminResolvers,
  tagResolvers,
  templateResolvers,
  templateCustomizationResolvers,
  userResolvers,
  versionedGuidanceResolvers,
  versionedQuestionResolvers,
  versionedQuestionConditionResolvers,
  versionedSectionResolvers,
  versionedTemplateResolvers,
  passwordResetResolvers,
]);
