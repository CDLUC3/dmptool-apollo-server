import { Client } from "@opensearch-project/opensearch";

type OpenSearchProperties = NonNullable<
  Parameters<Client["indices"]["putMapping"]>[0]["body"]
>["properties"];

// Look up the index type to get the singular MappingProperty schema
export type MappingProperty = NonNullable<OpenSearchProperties>[string];

import { OpenSearch, tokenizeText } from "../datasources/openSearch";
import { stripIdentifierBaseURL, validateDate } from "../utils/helpers";
import { Answer } from "../models/Answer";
import { Plan } from "../models/Plan";
import { Project } from "../models/Project";
import { PlanFunding, ProjectFunding, ProjectFundingStatus } from "../models/Funding";
import { PlanMember, ProjectMember } from "../models/Member";
import { Affiliation } from "../models/Affiliation";
import { AcceptedWork } from "../models/RelatedWork";
import { AlternateIdentifier } from "../models/AlternateIdentifier";
import { PlanVisibility } from "../models/Plan";
import {
  MetadataStandardSearchAnswerType,
  ResearchOutputDataFlagsColumnAnswerType,
  ResearchOutputLicenseColumnAnswerType,
  ResearchOutputMetadataStandardColumnAnswerType,
  ResearchOutputRepositoryColumnAnswerType,
  ResearchOutputTableAnswerType,
  ResearchOutputTableRowAnswerType
} from "@dmptool/types";
import { MyContext } from "../context";

export const INDEX_NAME = "dmp";
export const DEFAULT_MAX_RESULTS = 100;

/**
 * OpenSearch Index Definition
 */
export const PropertyDefinition: Record<string, MappingProperty> = {
  dmp_id: { type: "keyword" },
  title: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } },
  project_title: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 256 } } },
  visibility: { type: "keyword" },
  project_start: { type: "date" },
  project_end: { type: "date" },
  output_formats: { type: "keyword" },

  created: { type: "date" },
  modified: { type: "date" },
  registered: { type: "date" },

  contact_ids: { type: "keyword" },
  contributor_ids: { type: "keyword" },
  institution_ids: { type: "keyword" },
  funder_ids: { type: "keyword" },
  grant_ids: { type: "keyword" },
  opportunity_ids: { type: "keyword" },
  funder_project_ids: { type: "keyword" },
  dataset_ids: { type: "keyword" },
  repository_ids: { type: "keyword" },
  metadata_standard_ids: { type: "keyword" },
  license_ids: { type: "keyword" },
  alternate_identifier_ids: { type: "keyword" },
  related_identifier_ids: { type: "keyword" },

  funding_facets: { type: "keyword" },
  institutions_facets: { type: "keyword" },
  repositories_facets: { type: "keyword" },
  language: { type: "keyword" },
  status: { type: "keyword" },
  is_test: { type: "boolean" },
  featured: { type: "boolean" },
  research_domain: { type: "keyword" },
  funding_status: { type: "keyword" },
  personal_data: { type: "keyword" },
  sensitive_data: { type: "keyword" },
  data_access: { type: "keyword" },

  titles: { type: "keyword" },
  abstract: { type: "text", fields: { keyword: { type: "keyword", ignore_above: 512 } } },
  tags: { type: "keyword" },
  funding_search: { type: "keyword" },
  contributors_search: { type: "keyword" },
  institutions_search: { type: "keyword" },
  repositories_search: { type: "keyword" },

  contributors_display: { type: "object", enabled: false },
  funding_display: { type: "object", enabled: false },
  institutions_display: { type: "object", enabled: false },
  repositories_display: { type: "object", enabled: false },
};

// --- Interfaces ---

interface RepositoryDocumentFragment {
  id?: string;
  name: string;
  url?: string;
}

interface InstitutionDocumentFragment {
  id?: string;
  name?: string;
  acronym?: string;
}

interface FundingDocumentFragment extends InstitutionDocumentFragment {
  funding_status: string;
  grant_id?: string;
  funding_project_id?: string;
  opportunity_id?: string;
}

interface ContributorDocumentFragment {
  id?: string;
  affiliation_id?: string;
  given_name?: string;
  surname?: string;
  middle_initials?: number;
  full_name?: string;
}

interface DatasetDocumentFragment {
  title: string;
  type: string;
  description?: string;
  license?: string;
  issued?: string;
  data_flags?: string[];
  data_access?: string;
  byte_size?: number;
  metadata_standard_ids?: string[];
  repository_ids?: string[];
  repositories_display?: RepositoryDocumentFragment[];
}

interface ConversionOutput<T> {
  ids: string[];
  search_terms: string[];
  facet_value?: string;
  displayObject: T;
}

interface ReconciledFragment<T> {
  ids: string[];
  facets: string[];
  search_terms: string[];
  displayObjects: T[];
}

interface ReconciledFundingFragment extends ReconciledFragment<FundingDocumentFragment> {
  grantIds: string[];
  opportunityIds: string[];
  funderProjectIds: string[];
}

interface ReconciledFragments {
  members: ReconciledFragment<ContributorDocumentFragment>;
  institutions: ReconciledFragment<InstitutionDocumentFragment>;
  funding: ReconciledFundingFragment;
  datasets: ReconciledFragment<DatasetDocumentFragment>;
}

interface PlanIndexDocumentInterface {
  dmp_id: string;
  project_id: number;
  plan_id: number;
  title?: string;
  project_title?: string | null;
  visibility: string;
  project_start?: string | null;
  project_end?: string | null;
  output_formats?: string[]; // We don't capture this info yet, but it's part of the REST API spec
  is_test: boolean;
  featured: boolean;
  abstract?: string | null;

  created: string;
  modified: string;
  registered?: string | null;

  contributor_ids: string[];
  institution_ids: string[];
  funder_ids: string[];
  grant_ids: string[];
  opportunity_ids: string[];
  funder_project_ids: string[];
  alternate_identifier_ids: string[];
  repository_ids: string[];
  related_identifier_ids: string[];

  funding_facets: string[];
  institutions_facets: string[];
  repositories_facets?: string[];

  funding_search: string[];
  contributors_search: string[];
  institutions_search: string[];
  repositories_search?: string[];

  contributors_display?: ContributorDocumentFragment[];
  funding_display?: FundingDocumentFragment[];
  institutions_display?: InstitutionDocumentFragment[];
  datasets_display?: DatasetDocumentFragment[];
}

/**
 * The associated objects related to a plan and project
 */
interface AssociatedObjectInterface {
  alternateIdentifiers: string[];
  relatedWorks: string[];
  answers: Answer[],
  projectMembers: ProjectMember[],
  projectFunding: ProjectFunding[],
  planMembers: PlanMember[],
  planFunding: PlanFunding[],
  affiliations: Map<string, Affiliation>,
}

/**
 * Ensures no extra white spaces in the string
 *
 * @param val the string to clean
 * @returns the string without extra white space or undefined
 */
const cleanString = (val?: string): string | undefined => val?.trim() || undefined;

/**
 * Generate all the name variations we want to add to the search index for an institution
 *
 * @param name the name of the institution/funder/organization
 * @param acronyms an array of acronyms for the institution/funder/organization
 * @param aliases an array of aliases for the institution/funder/organization
 */
const getInstitutionNameVariants = (
  name?: string,
  acronyms?: string[],
  aliases?: string[]
): string[] => {
  const variants = new Set<string>();

  if (name) variants.add(name.toLowerCase().trim());
  acronyms?.forEach((a) => variants.add(a.toLowerCase().trim()));
  aliases?.forEach((a) => variants.add(a.toLowerCase().trim()));
  variants.delete("");

  return Array.from(variants);
};

/**
 * Generate all the possible name variations we want in our search index
 *
 * @param givenName the user's given/first name
 * @param familyName the user's family/last name
 * @returns an array of name variations
 */
const getContributorNameVariants = (givenName?: string, familyName?: string): string[] => {
  const given = cleanString(givenName).toLowerCase();
  const family = cleanString(familyName).toLowerCase();
  const firstInit = given.charAt(0);

  const variants = new Set<string>();

  if (given && family) {
    variants.add(`${given} ${family}`);
    variants.add(`${family} ${given}`);
    variants.add(`${family}, ${given}`);
  }

  if (firstInit && family) {
    variants.add(`${firstInit} ${family}`);
    variants.add(`${firstInit}. ${family}`);
    variants.add(`${family} ${firstInit}`);
    variants.add(`${family}, ${firstInit}`);
    variants.add(`${family} ${firstInit}.`);
    variants.add(`${family}, ${firstInit}.`);
  }

  if (family) variants.add(family);
  if (given) variants.add(given);
  variants.delete("");

  return Array.from(variants);
};

/**
 * Generates clean, unique search terms from title and description inputs.
 *
 * @param title the title
 * @param description an optional description
 * @returns the search terms optimized for search
 */
export function generateSearchTerms(
  title?: string,
  description?: string,
): string[] {
  const titleTokens: string[] = tokenizeText(title, 2);
  const descTokens: string[] = tokenizeText(description, 2);

  // Combine unique terms
  const terms = new Set<string>([...titleTokens, ...descTokens]);

  // Generate adjacent word pairs from the title (skipping this for description for now)
  if (titleTokens.length > 1) {
    for (let i = 0; i < titleTokens.length - 1; i++) {
      terms.add(`${titleTokens[i]} ${titleTokens[i + 1]}`);
    }
  }

  return Array.from(terms);
}

/**
 * Helper to fetch all the objects associated with the Plan so we can build the index entry
 *
 * @param reference a string for logging purposes
 * @param context the Apollo server context
 * @param plan the Plan
 * @returns all of the associated objects for the plan
 */
const fetchAssociatedObjects = async (
  reference: string,
  context: MyContext,
  plan: Plan,
): Promise<AssociatedObjectInterface> => {
  // Fetch alternate identifiers
  const alternateIdentifiers: AlternateIdentifier[] = await AlternateIdentifier.findByPlanId(reference, context, plan.id) || [];
  const alternateIds: string[] = alternateIdentifiers?.map((i: AlternateIdentifier) => {
    return i.alternateIdentifier;
  }).filter(Boolean) ?? [];

  // Fetch the related work DOIs
  const relatedWorks: AcceptedWork[] = await AcceptedWork.findByPlanId(reference, context, plan.id) || [];
  const relatedWorkIds: string[] = relatedWorks.map((work: AcceptedWork): string => work.doi) ?? []

  // Fetch answers
  const answers: Answer[] = await Answer.findByPlanId(reference, context, plan.id) || [];

  // Fetch members and funding
  const projectMembers: ProjectMember[] = await ProjectMember.findByProjectId(reference, context, plan.projectId) || [];
  const projectFunding: ProjectFunding[] = await ProjectFunding.findByProjectId(reference, context, plan.projectId) || [];
  const planMembers: PlanMember[] = await PlanMember.findByPlanId(reference, context, plan.id) || [];
  const planFunding: PlanFunding[] = await PlanFunding.findByPlanId(reference, context, plan.id) || [];

  // Build Affiliation Lookup Map from member and funder information
  const affiliations = new Map<string, Affiliation>();
  for (const m of projectMembers) {
    if (m.affiliationId && !affiliations.has(m.affiliationId)) {
      const affiliation: Affiliation = await Affiliation.findByURI(reference, context, m.affiliationId);
      affiliations.set(m.affiliationId, affiliation);
    }
  }
  for (const f of projectFunding) {
    if (f.affiliationId && !affiliations.has(f.affiliationId)) {
      const affiliation: Affiliation = await Affiliation.findByURI(reference, context, f.affiliationId);
      affiliations.set(f.affiliationId, affiliation);
    }
  }

  return {
    alternateIdentifiers: alternateIds,
    relatedWorks: relatedWorkIds,
    answers,
    affiliations,
    projectMembers,
    projectFunding,
    planMembers,
    planFunding
  }
}

/**
 * Extract all the ids, faceting, search and display info we want from a member object
 *
 * @param member The project member
 * @returns the ids, faceting value, search terms and a display object
 */
const convertMember = (member: ProjectMember): ConversionOutput<ContributorDocumentFragment> | undefined => {
  if (!member?.id) return undefined;

  const orcid = stripIdentifierBaseURL(member.orcid)?.trim();
  const given = cleanString(member.givenName);
  const sur = cleanString(member.surName);

  return {
    ids: orcid ? [orcid] : [],
    search_terms: getContributorNameVariants(member.givenName, member.surName),
    displayObject: {
      id: orcid,
      affiliation_id: member.affiliationId,
      given_name: member.givenName,
      surname: member.surName,
      full_name: `${given} ${sur}`.trim() || undefined,
    },
  };
};

/**
 * Extract all the ids, faceting, search and display info we want from a affiliation object
 *
 * @param affiliation The affiliation
 * @returns the ids, faceting value, search terms and a display object
 */
const convertAffiliation = (affiliation: Affiliation): ConversionOutput<InstitutionDocumentFragment> | undefined => {
  if (!affiliation?.id) return undefined;

  const ror = stripIdentifierBaseURL(affiliation.uri)?.trim();
  return {
    ids: ror ? [ror] : [],
    facet_value: affiliation.displayName,
    search_terms: getInstitutionNameVariants(affiliation.name, affiliation.acronyms, affiliation.aliases),
    displayObject: {
      id: ror,
      name: cleanString(affiliation.displayName),
      acronym: cleanString(affiliation.acronyms?.[0]),
    },
  };
};

/**
 * Extract all the ids, faceting, search and display info we want from a funding object
 *
 * @param funder The funder affiliation
 * @param funding The project funding
 * @returns the ids, faceting value, search terms and a display object
 */
const convertFunding = (
  funder: Affiliation,
  funding: ProjectFunding
): ConversionOutput<FundingDocumentFragment> | undefined => {
  if (!funding?.id || funder.uri !== funding.affiliationId) return undefined;

  const ror = stripIdentifierBaseURL(funder.uri)?.trim();
  return {
    ids: ror ? [ror] : [],
    facet_value: funder.displayName,
    search_terms: getInstitutionNameVariants(funder.name, funder.acronyms, funder.aliases),
    displayObject: {
      id: ror,
      name: cleanString(funder.displayName),
      acronym: cleanString(funder.acronyms?.[0]),
      funding_status: funding.status || ProjectFundingStatus.PLANNED,
      funding_project_id: funding.funderProjectNumber,
      opportunity_id: funding.funderOpportunityNumber,
    },
  };
};

/**
 * Extract all the ids, faceting, search and display info we want from a research output answer row
 *
 * @param researchOutputAnswerRow the research output
 * @returns the ids, faceting values, search terms and a display object
 */
const convertDataset = (
  researchOutputAnswerRow: ResearchOutputTableRowAnswerType
): ConversionOutput<DatasetDocumentFragment> | undefined => {
  if (!researchOutputAnswerRow || !researchOutputAnswerRow.columns) return undefined;

  const displayObject: DatasetDocumentFragment = { title: '', type: 'other' };
  for (const column of researchOutputAnswerRow.columns) {
    switch (column.commonStandardId) {
      case 'license_ref':
        displayObject.license = cleanString((column as ResearchOutputLicenseColumnAnswerType).answer[0].licenseId) || undefined;
        break;
      case 'issued':
        displayObject.issued = validateDate(column.answer) ? new Date(column.answer).toISOString() : undefined;
        break;
      case 'data_flags':
        displayObject.data_flags = column.answer
          ? (column as ResearchOutputDataFlagsColumnAnswerType).answer.map((entry: string): string => {
            return cleanString(entry);
          })
          : undefined;
        break;
      case 'byte_size':
        displayObject.byte_size = Number(column.answer) || undefined;
        break;
      case 'metadata':
        displayObject.metadata_standard_ids = Array.isArray(column.answer)
          ? (column as ResearchOutputMetadataStandardColumnAnswerType).answer
            .map((entry: MetadataStandardSearchAnswerType['answer'][0]): string => {
              return cleanString(entry.metadataStandardId) || undefined;
            })
          : [];
        break;
      case 'host':
        displayObject.repository_ids = Array.isArray(column.answer)
          ? (column as ResearchOutputRepositoryColumnAnswerType).answer
            .map((entry: ResearchOutputRepositoryColumnAnswerType['answer'][0]): string => {
              return cleanString(entry.repositoryId) || undefined;
            })
          : [];
        displayObject.repositories_display = Array.isArray(column.answer)
          ? (column as ResearchOutputRepositoryColumnAnswerType).answer
            .map((entry: ResearchOutputRepositoryColumnAnswerType['answer'][0]): RepositoryDocumentFragment => {
              return {
                id: cleanString(entry.repositoryId) || undefined,
                name: cleanString(entry.repositoryName) || undefined,
              };
            })
          : [];
        break;
      default:
        displayObject[column.commonStandardId] = cleanString(column.answer.toString()) || undefined;
        break;
    }
  }

  const type: string = cleanString(displayObject.type) || 'other';
  const searchTerms: string[] = generateSearchTerms(
    cleanString(displayObject.title),
    cleanString(displayObject.description)
  );

  return {
    ids: [],
    facet_value: type,
    search_terms: searchTerms,
    displayObject,
  };
}

/**
 * Aggregate all Member and Funding information into the format needed for the index
 *
 * @param affiliations the affiliations and funders as a Map
 * @param projectMembers the members associated with the Project
 * @param projectFunding the funding associated with the Project
 * @param planAnswers the Plan's answers
 * @param planMembers the subset of Project members associated with the Plan
 * @param planFunding the subset of Project funding associated with the Plan
 * @returns the member, institution and funding info
 */
const reconcileAssociatedObjects = (
  affiliations: Map<string, Affiliation>,
  projectMembers: ProjectMember[],
  projectFunding: ProjectFunding[],
  planAnswers: Answer[],
  planMembers: PlanMember[],
  planFunding: PlanFunding[],
): ReconciledFragments => {
  const planMemberIds = new Set(planMembers.map((m: PlanMember) => m.projectMemberId));
  const planFundingIds = new Set(planFunding.map((f: PlanFunding) => f.projectFundingId));

  // Single-pass reduction helpers
  const membersResult: ReconciledFragment<ContributorDocumentFragment> = { ids: [], facets: [], search_terms: [], displayObjects: [] };
  const instResult: ReconciledFragment<InstitutionDocumentFragment> = { ids: [], facets: [], search_terms: [], displayObjects: [] };
  const datasetResult: ReconciledFragment<DatasetDocumentFragment> = { ids: [], facets: [], search_terms: [], displayObjects: [] };
  const fundingResult: ReconciledFundingFragment = {
    ids: [],
    facets: [],
    search_terms: [],
    displayObjects: [],
    grantIds: [],
    opportunityIds: [],
    funderProjectIds: [],
  };

  // Process Members
  for (const member of projectMembers) {
    if (!planMemberIds.has(member.id)) continue;

    const converted: ConversionOutput<ContributorDocumentFragment> = convertMember(member as ProjectMember);
    if (!converted) continue;

    membersResult.ids.push(...converted.ids);
    membersResult.search_terms.push(...converted.search_terms);
    membersResult.displayObjects.push(converted.displayObject);
  }

  // Process Affiliations
  for (const affiliation of affiliations.values()) {
    const converted: ConversionOutput<InstitutionDocumentFragment> = convertAffiliation(affiliation);
    if (!converted) continue;

    instResult.ids.push(...converted.ids);
    if (converted.facet_value) instResult.facets.push(converted.facet_value);
    instResult.search_terms.push(...converted.search_terms);
    instResult.displayObjects.push(converted.displayObject);
  }

  // Process Funding
  for (const funding of projectFunding) {
    if (!('status' in funding)) continue;

    const fund: ProjectFunding = funding as ProjectFunding;
    if (!planFundingIds.has(funding.id) || !fund.affiliationId) continue;
    const affiliation = affiliations.get(fund.affiliationId);
    if (!affiliation) continue;

    const converted = convertFunding(affiliation, fund);
    if (!converted) continue;

    fundingResult.ids.push(...converted.ids);
    if (converted.facet_value) fundingResult.facets.push(converted.facet_value);
    fundingResult.search_terms.push(...converted.search_terms);
    fundingResult.displayObjects.push(converted.displayObject);

    if (converted.displayObject.grant_id) fundingResult.grantIds.push(converted.displayObject.grant_id);
    if (converted.displayObject.opportunity_id) fundingResult.opportunityIds.push(converted.displayObject.opportunity_id);
    if (converted.displayObject.funding_project_id) fundingResult.funderProjectIds.push(converted.displayObject.funding_project_id);
  }

  // Process Datasets
  const roAnswer: Answer = planAnswers.find((answer: Answer): boolean => {
    return answer.json.includes('"researchOutputTable"');
  });
  if (roAnswer && roAnswer.json) {
    const json: ResearchOutputTableAnswerType = JSON.parse(roAnswer.json);
    for (const row of json.answer) {
      if (!('commonStandardId' in row)) continue;

      const dataset: ConversionOutput<DatasetDocumentFragment> = convertDataset(row);
      if (!dataset) continue;

      datasetResult.ids.push(...dataset.ids);
      if (dataset.facet_value) datasetResult.facets.push(dataset.facet_value);
      datasetResult.search_terms.push(...dataset.search_terms);
      datasetResult.displayObjects.push(dataset.displayObject);
    }
  }

  return {
    members: membersResult,
    institutions: instResult,
    funding: fundingResult,
    datasets: datasetResult
  };
};

/**
 * Fetch a specific DMP from the Plans index
 *
 * @param reference the string reference for logging
 * @param context the Apollo context
 * @param dmpId the DMP id of the Plan
 * @returns the index record or undefined if not found
 */
export const getIndexItem = async (
  reference: string,
  context: MyContext,
  dmpId: string,
): Promise<PlanIndexDocumentInterface | undefined> => {
  const openSearch: OpenSearch = context.dataSources.openSearchServerlessDataSource;

  context.logger.debug({ reference, index: INDEX_NAME, dmpId }, "Fetching Plan from index");
  const response = await openSearch.getIndexItem<PlanIndexDocumentInterface>(
    INDEX_NAME,
    stripIdentifierBaseURL(dmpId)
  );

  if (!response) {
    throw new Error(`Failed to fetch index item for DMP ID: ${dmpId}`);
  }

  return response;
};

/**
 * Search for Plans within the index
 *
 * @param reference the string reference for logging
 * @param context the Apollo context
 * @param query the OpenSearch query
 * @param sort the OpenSearch sort (defaults to an empty array)
 * @param maxResults the total number of results to return (defaults to 100)
 * @returns the index record or undefined if not found
 */
export const searchIndex = async (
  reference: string,
  context: MyContext,
  query: Record<string, unknown>,
  sort: Record<string, unknown>[] = [],
  maxResults: number = DEFAULT_MAX_RESULTS,
): Promise<PlanIndexDocumentInterface[]> => {
  const openSearch: OpenSearch = context.dataSources.openSearchServerlessDataSource;

  context.logger.debug(
    { reference, INDEX_NAME, query, sort, maxResults },
    'Serching Plan index'
  );
  const response = await openSearch.search<PlanIndexDocumentInterface>(
    INDEX_NAME,
    {
      size: maxResults,
      query,
      sort
    }
  );

  if (!response) {
    throw new Error(`Failed to search index for query: ${JSON.stringify(query)}`);
  }

  return response.total > 0 ? response.items : [];
};

/**
 * Update the OpenSearch index with the latest information from the project and plan
 *
 * @param reference the string reference for logging
 * @param context the Apollo server context
 * @param plan the plan
 * @param project the research project (will be fetched if not provided)
 */
export const updateIndexItem = async (
  reference: string,
  context: MyContext,
  plan: Plan,
  project?: Project,
): Promise<void> => {
  const dmpId: string = stripIdentifierBaseURL(plan.dmpId).trim();
  const openSearch: OpenSearch = context.dataSources.openSearchServerlessDataSource;
  // If no project was passed in, look it up
  if (!project) project = await Project.findById(reference, context, plan.projectId);

  const associatedObjects: AssociatedObjectInterface = await fetchAssociatedObjects(reference, context, plan);

  const { members, institutions, funding, datasets } = reconcileAssociatedObjects(
    associatedObjects.affiliations,
    associatedObjects.projectMembers,
    associatedObjects.projectFunding,
    associatedObjects.answers,
    associatedObjects.planMembers,
    associatedObjects.planFunding
  );

  // Extract all the repository info
  const repositoryIds: string[] = [];
  const repositoryFacets: string[] = [];
  const repositorySearchTerms: string[] = [];
  for (const obj of datasets.displayObjects) {
    // Get the repository ids
    if (Array.isArray(obj.repository_ids)) {
      for (const id of obj.repository_ids) {
        if (id) repositoryIds.push(id);
      }
    }

    // Get the facet and search terms
    if (Array.isArray(obj.repositories_display)) {
      for (const repo of obj.repositories_display) {
        if (repo?.name) {
          const facetName = repo.name;
          repositoryFacets.push(facetName);

          const terms = generateSearchTerms(facetName.slice(0, 128));
          if (Array.isArray(terms)) {
            repositorySearchTerms.push(...terms);
          }
        }
      }
    }
  }

  const item: PlanIndexDocumentInterface = {
    dmp_id: dmpId,
    project_id: project.id,
    plan_id: plan.id,
    created: new Date(plan.created).toISOString(),
    modified: new Date(plan.modified).toISOString(),
    title: plan.title?.trim().slice(0, 256),

    project_title: project.title?.trim().slice(0, 256) || undefined,
    abstract: project.abstractText?.trim().slice(0, 512) || undefined,
    project_start: validateDate(project.startDate) ? new Date(project.startDate).toISOString() : undefined,
    project_end: validateDate(project.endDate) ? new Date(project.endDate).toISOString() : undefined,
    registered: validateDate(plan.registered) ? new Date(plan.registered).toISOString() : undefined,

    visibility: plan.visibility || PlanVisibility.PRIVATE.toLowerCase(),
    is_test: !!project.isTestProject,
    featured: !!plan.featured,

    alternate_identifier_ids: associatedObjects.alternateIdentifiers,
    contributor_ids: members.ids,
    institution_ids: institutions.ids,
    funder_ids: funding.ids,
    grant_ids: funding.grantIds,
    opportunity_ids: funding.opportunityIds,
    funder_project_ids: funding.funderProjectIds,
    repository_ids: repositoryIds,
    related_identifier_ids: associatedObjects.relatedWorks,

    funding_facets: funding.facets,
    institutions_facets: institutions.facets,
    repositories_facets: repositoryFacets,

    funding_search: funding.search_terms,
    contributors_search: members.search_terms,
    institutions_search: institutions.search_terms,
    repositories_search: repositorySearchTerms,

    contributors_display: members.displayObjects,
    funding_display: funding.displayObjects,
    institutions_display: institutions.displayObjects,
  };

  // Fire off the OpenSearch update
  context.logger.debug({ reference, index: INDEX_NAME, item }, "Indexing Plan");
  await openSearch.updateIndexItem(INDEX_NAME, PropertyDefinition, dmpId, item);
};

/**
 * Remove the OpenSearch index for the plan
 *
 * @param reference the reference for logging
 * @param context the Apollo server context
 * @param plan the plan
 */
export const removeIndexItem = async (
  reference: string,
  context: MyContext,
  plan: Plan
): Promise<void> => {
  const dmpId: string = stripIdentifierBaseURL(plan.dmpId).trim();
  const openSearch: OpenSearch = context.dataSources.openSearchServerlessDataSource;

  context.logger.debug({ reference, INDEX_NAME, dmpId }, 'Removing Plan from index');
  await openSearch.removeIndexItem(INDEX_NAME, dmpId);
}
