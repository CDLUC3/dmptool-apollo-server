import { mergeResolvers } from '@graphql-tools/merge';
import { IResolvers } from '@graphql-tools/utils';

import { dmspIdScalar } from './resolvers/scalars/dmspId';
import { orcidScalar } from './resolvers/scalars/orcid';
import { rorScalar } from './resolvers/scalars/ror';
import { md5Scalar } from "./resolvers/scalars/md5";

import { resolvers as affiliationResolvers } from './resolvers/affiliation';
import { resolvers as answerResolvers } from './resolvers/answer';
import { resolvers as collaboratorResolvers } from './resolvers/collaborator';
import { resolvers as feedback } from './resolvers/feedback';
import { resolvers as memberResolvers } from './resolvers/member';
import { resolvers as memberRoleResolvers } from './resolvers/memberRole';
import { resolvers as fundingResolvers } from './resolvers/funding';
import { resolvers as guidanceResolvers } from './resolvers/guidance';
import { resolvers as guidanceGroupResolvers } from './resolvers/guidanceGroup';
import { resolvers as languageResolvers } from './resolvers/language';
import { resolvers as licenseResolvers } from './resolvers/license';
import { resolvers as metadataStandardResolvers } from './resolvers/metadataStandard';
import { resolvers as planResolvers } from './resolvers/plan';
import { resolvers as projectResolvers } from './resolvers/project';
import { resolvers as questionConditionResolvers } from './resolvers/questionCondition';
import { resolvers as questionCustomizationResolvers } from './resolvers/questionCustomization';
import { resolvers as questionResolvers } from './resolvers/question';
import { resolvers as relatedWorkResolvers } from './resolvers/relatedWork';
import { resolvers as repositoryResolvers } from './resolvers/repository';
import { resolvers as researchDomainResolvers } from './resolvers/researchDomain';
import { resolvers as researchOutputResolvers } from './resolvers/researchOutputTypes';
import { resolvers as sectionCustomizationResolvers } from './resolvers/sectionCustomization';
import { resolvers as sectionResolvers } from './resolvers/section';
import { resolvers as superAdminResolvers } from './resolvers/superAdmin';
import { resolvers as tagResolvers } from './resolvers/tag';
import { resolvers as templateResolvers } from './resolvers/template';
import { resolvers as templateCustomizationResolvers } from './resolvers/templateCustomization';
import { resolvers as userResolvers } from './resolvers/user';
import { resolvers as versionedGuidanceResolvers } from './resolvers/versionedGuidance';
import { resolvers as versionedQuestionResolvers } from './resolvers/versionedQuestion';
import { resolvers as versionedQuestionConditionResolvers } from './resolvers/versionedQuestionCondition';
import { resolvers as versionedSectionResolvers } from './resolvers/versionedSection';
import { resolvers as versionedTemplateResolvers } from './resolvers/versionedTemplate';

const scalarResolvers = {
  DmspId: dmspIdScalar,
  Orcid: orcidScalar,
  Ror: rorScalar,
  MD5: md5Scalar
}

export const resolvers: IResolvers = mergeResolvers([
  scalarResolvers,

  affiliationResolvers,
  answerResolvers,
  collaboratorResolvers,
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
]);
