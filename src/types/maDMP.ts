import { DMPToolDMPType } from "@dmptool/types";

/**
 * Shortcuts to different segments of the maDMP record
 */
export type maDMPType = DMPToolDMPType['dmp'];
export type maDMPIdentifiersType = maDMPType['alternate_identifier'];
export type maDMPIdentifierType = maDMPType['dmp_id'];
export type maDMPAffiliationType = maDMPType['contact']['affiliation'];
export type maDMPAffiliationIdType =NonNullable<maDMPAffiliationType['affiliation_id']>[0];
export type maDMPContactType = maDMPType['contact'];
export type maDMPContributorsType = maDMPType['contributor'];
export type maDMPContributorType = NonNullable<maDMPContributorsType>[0];
export type maDMPDatasetsType = maDMPType['datasets'];
export type maDMPDatasetType = NonNullable<maDMPDatasetsType>[0];
export type maDMPDistributionType = NonNullable<maDMPDatasetType['distribution']>[0];
export type maDMPHostType = NonNullable<maDMPDistributionType['host']>[0];
export type maDMPFunderProjectNumberType = maDMPType['funding_project'][0];
export type maDMPFunderOpportunityNumberType = maDMPType['funding_opportunity'][0];
export type maDMPFundingType = NonNullable<maDMPProjectType['funding']>[0];
export type maDMPLicenseType = NonNullable<maDMPDatasetType['license_ref']>[0];
export type maDMPMetadataType = NonNullable<maDMPDatasetType['metadata']>[0];
export type maDMPNarrativeType = maDMPType['narrative'];
export type maDMPNarrativeTemplateType = NonNullable<maDMPNarrativeType['template']>;
export type maDMPNarrativeSectionsType = maDMPNarrativeTemplateType['section'];
export type maDMPNarrativeSectionType = NonNullable<maDMPNarrativeSectionsType>[0];
export type maDMPNarrativeQuestionsType = maDMPNarrativeSectionType['question'];
export type maDMPNarrativeQuestionType = NonNullable<maDMPNarrativeQuestionsType>[0];
export type maDMPProjectsType = maDMPType['project'];
export type maDMPProjectType = NonNullable<maDMPProjectsType>[0];
export type maDMPResearchDomainType = maDMPType['research_domain'];
export type maDMPAlternateIdentifiersType = maDMPType['alternate_identifier'];
export type maDMPAlternateIdentifierType = NonNullable<maDMPAlternateIdentifiersType>[0];
export type maDMPRelatedIdentifierType = maDMPType['related_identifier'][0];
export type maDMPVersionsType = maDMPType['version'];
export type maDMPVersionType = NonNullable<maDMPVersionsType>[0];
