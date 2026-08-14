import casual from "casual";
import { MyContext } from "../../context";
import {
  generateSearchTerms,
  INDEX_NAME,
  PropertyDefinition,
  removeIndex,
  updateIndex,
} from "../indexDMPService";
import { Plan, PlanVisibility } from "../../models/Plan";
import { Project } from "../../models/Project";
import { Answer } from "../../models/Answer";
import { ProjectMember, PlanMember } from "../../models/Member";
import { PlanFunding, ProjectFunding, ProjectFundingStatus } from "../../models/Funding";
import { Affiliation } from "../../models/Affiliation";
import { AlternateIdentifier } from "../../models/AlternateIdentifier";
import { AcceptedWork } from "../../models/RelatedWork";

// ── Module mocks ──────────────────────────────────────────────────────────────

// Mock MySQL so model base-class imports don't attempt a real connection
jest.mock('../../datasources/mysql', () => ({
  __esModule: true,
  MySQLConnection: jest.fn().mockImplementation(() => ({
    pool: null,
    query: jest.fn(),
    withTransaction: jest.fn(),
  })),
}));

// Mock AWS / localstack config modules that openSearch imports
jest.mock('../../config/awsConfig', () => ({
  awsConfig: {
    opensearchServerless: { endpoint: 'http://localhost:9200' },
  },
}));

// Mock the OpenSearch *class* while keeping the real tokenizeText export.
// tokenizeText is used by generateSearchTerms internally.
jest.mock('../../datasources/openSearch', () => {
  const actual = jest.requireActual('../../datasources/openSearch');
  return {
    __esModule: true,
    tokenizeText: actual.tokenizeText,
    OpenSearch: jest.fn(),
  };
});

// ── Helpers ──────────────────────────────────────────────────────────────────

// Base URLs match the mocked generalConfig in src/__tests__/setup.ts
const TEST_DMP_ID_BASE = 'http://dmsp.com/';
const TEST_ROR_BASE = 'http://ror.example.com/';
const TEST_ORCID_BASE = 'http://sandbox.orcid.org/';

const buildPlan = (overrides: Partial<Record<string, unknown>> = {}): Plan =>
  new Plan({
    id: casual.integer(1, 9999),
    projectId: casual.integer(1, 9999),
    dmpId: `${TEST_DMP_ID_BASE}11.22222/${casual.word}`,
    title: casual.title,
    visibility: PlanVisibility.PUBLIC,
    featured: false,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    registered: null,
    ...overrides,
  });

const buildProject = (overrides: Partial<Record<string, unknown>> = {}): Project =>
  new Project({
    id: casual.integer(1, 9999),
    title: casual.title,
    abstractText: casual.sentences(2),
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    isTestProject: false,
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    ...overrides,
  });

const buildProjectMember = (
  id = casual.integer(1, 9999),
  overrides: Partial<Record<string, unknown>> = {}
): ProjectMember =>
  new ProjectMember({
    id,
    projectId: casual.integer(1, 9999),
    givenName: casual.first_name,
    surName: casual.last_name,
    orcid: `${TEST_ORCID_BASE}0000-000${casual.integer(1, 9)}-${casual.integer(1000, 9999)}-${casual.integer(1000, 9999)}`,
    affiliationId: `${TEST_ROR_BASE}${casual.word}`,
    isPrimaryContact: false,
    ...overrides,
  });

const buildPlanMember = (projectMemberId: number): PlanMember =>
  new PlanMember({
    id: casual.integer(1, 9999),
    planId: casual.integer(1, 9999),
    projectMemberId,
    isPrimaryContact: false,
    memberRoleIds: [],
  });

const buildProjectFunding = (
  id = casual.integer(1, 9999),
  affiliationId: string,
  overrides: Partial<Record<string, unknown>> = {}
): ProjectFunding =>
  new ProjectFunding({
    id,
    projectId: casual.integer(1, 9999),
    affiliationId,
    status: ProjectFundingStatus.PLANNED,
    grantId: `award-${casual.word}`,
    ...overrides,
  });

const buildPlanFunding = (projectFundingId: number): PlanFunding =>
  new PlanFunding({
    id: casual.integer(1, 9999),
    planId: casual.integer(1, 9999),
    projectFundingId,
  });

const buildAffiliation = (
  uri: string,
  overrides: Partial<Record<string, unknown>> = {}
): Affiliation =>
  new Affiliation({
    id: casual.integer(1, 9999),
    uri,
    name: casual.company_name,
    displayName: casual.company_name,
    displayAbbreviation: casual.word.toUpperCase().slice(0, 5),
    acronyms: [],
    aliases: [],
    active: true,
    funder: false,
    types: ['OTHER'],
    ...overrides,
  });

/** Minimal research output table answer JSON */
const buildResearchOutputAnswerJson = (): string =>
  JSON.stringify({
    commonStandardId: 'researchOutputTable',
    answer: [
      {
        commonStandardId: 'researchOutputTableRow',
        columns: [
          { commonStandardId: 'title', answer: 'My Dataset' },
          { commonStandardId: 'type', answer: 'dataset' },
          { commonStandardId: 'description', answer: 'A great dataset' },
          {
            commonStandardId: 'host',
            answer: [
              { repositoryId: 're3data.r3d100000001', repositoryName: 'GenBank' },
            ],
          },
        ],
      },
    ],
  });

// ── Global setup ──────────────────────────────────────────────────────────────

let mockUpdateIndexItem: jest.Mock;
let mockRemoveIndexItem: jest.Mock;
let context: MyContext;

beforeEach(() => {
  jest.resetAllMocks();

  mockUpdateIndexItem = jest.fn().mockResolvedValue(undefined);
  mockRemoveIndexItem = jest.fn().mockResolvedValue(undefined);

  // Minimal context: tests only need the OpenSearch datasource
  context = {
    dataSources: {
      openSearchServerlessDataSource: {
        updateIndexItem: mockUpdateIndexItem,
        removeIndexItem: mockRemoveIndexItem,
      },
    },
    logger: {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    },
    token: null,
    requestId: 'test-request-id',
  } as unknown as MyContext;

  // Default: all model static methods return empty results
  (AlternateIdentifier.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([]);
  (AcceptedWork.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([]);
  (Answer.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([]);
  (ProjectMember.findByProjectId as jest.Mock) = jest.fn().mockResolvedValue([]);
  (ProjectFunding.findByProjectId as jest.Mock) = jest.fn().mockResolvedValue([]);
  (PlanMember.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([]);
  (PlanFunding.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([]);
  (Affiliation.findByURI as jest.Mock) = jest.fn().mockResolvedValue(null);
  (Project.findById as jest.Mock) = jest.fn().mockResolvedValue(null);
});

afterEach(() => {
  jest.clearAllMocks();
});

// ── generateSearchTerms ───────────────────────────────────────────────────────

describe('generateSearchTerms', () => {
  it('returns an empty array when both title and description are undefined', () => {
    expect(generateSearchTerms(undefined, undefined)).toEqual([]);
  });

  it('returns an empty array when both title and description are empty strings', () => {
    expect(generateSearchTerms('', '')).toEqual([]);
  });

  it('tokenizes the title into individual words', () => {
    const result = generateSearchTerms('climate change research');
    expect(result).toContain('climate');
    expect(result).toContain('change');
    expect(result).toContain('research');
  });

  it('generates adjacent bigrams from the title', () => {
    const result = generateSearchTerms('climate change research');
    expect(result).toContain('climate change');
    expect(result).toContain('change research');
  });

  it('does not generate bigrams when the title has only one meaningful token', () => {
    const result = generateSearchTerms('biodiversity');
    expect(result).toEqual(['biodiversity']);
  });

  it('includes tokens from both title and description', () => {
    const result = generateSearchTerms('climate research', 'ocean temperatures');
    expect(result).toContain('climate');
    expect(result).toContain('research');
    expect(result).toContain('ocean');
    expect(result).toContain('temperatures');
  });

  it('deduplicates tokens that appear in both title and description', () => {
    const result = generateSearchTerms('ocean research', 'ocean data');
    const count = result.filter((t) => t === 'ocean').length;
    expect(count).toBe(1);
  });

  it('filters out common stop words', () => {
    const result = generateSearchTerms('the impact of climate on the ocean');
    expect(result).not.toContain('the');
    expect(result).not.toContain('of');
    expect(result).not.toContain('on');
  });

  it('ignores tokens shorter than 2 characters', () => {
    const result = generateSearchTerms('a big study');
    expect(result).not.toContain('a');
    expect(result).toContain('big');
    expect(result).toContain('study');
  });
});

// ── updateIndex ───────────────────────────────────────────────────────────────

describe('updateIndex', () => {
  const reference = 'test.updateIndex';

  it('calls openSearch.updateIndexItem with the correct INDEX_NAME and PropertyDefinition', async () => {
    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });

    await updateIndex(reference, context, plan, project);

    expect(mockUpdateIndexItem).toHaveBeenCalledTimes(1);
    const [idxName, propDef] = mockUpdateIndexItem.mock.calls[0];
    expect(idxName).toBe(INDEX_NAME);
    expect(propDef).toBe(PropertyDefinition);
  });

  it('passes the dmpId stripped of its doi.org base URL as the document id', async () => {
    const suffix = `11.22222/${casual.word}`;
    const plan = buildPlan({ dmpId: `${TEST_DMP_ID_BASE}${suffix}` });
    const project = buildProject({ id: plan.projectId });

    await updateIndex(reference, context, plan, project);

    const [, , id] = mockUpdateIndexItem.mock.calls[0];
    expect(id).toBe(suffix);
  });

  it('includes dmp_id, title, plan_id, and project_id in the document', async () => {
    const project = buildProject();
    const plan = buildPlan({ projectId: project.id });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.dmp_id).toBeTruthy();
    expect(doc.title).toBe(plan.title?.trim().slice(0, 256));
    expect(doc.plan_id).toBe(plan.id);
    expect(doc.project_id).toBe(project.id);
  });

  it('includes created and modified as ISO timestamps', async () => {
    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.created).toBe(new Date(plan.created).toISOString());
    expect(doc.modified).toBe(new Date(plan.modified).toISOString());
  });

  it('includes project_title and abstract from the project', async () => {
    const project = buildProject();
    const plan = buildPlan({ projectId: project.id });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.project_title).toBe(project.title?.trim().slice(0, 256));
    expect(doc.abstract).toBe(project.abstractText?.trim().slice(0, 512));
  });

  it('converts valid project start and end dates to ISO format', async () => {
    const project = buildProject({ startDate: '2025-01-15', endDate: '2026-06-30' });
    const plan = buildPlan({ projectId: project.id });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.project_start).toBe(new Date('2025-01-15').toISOString());
    expect(doc.project_end).toBe(new Date('2026-06-30').toISOString());
  });

  it('sets project_start and project_end to undefined for invalid date strings', async () => {
    const project = buildProject({ startDate: 'not-a-date', endDate: null });
    const plan = buildPlan({ projectId: project.id });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.project_start).toBeUndefined();
    expect(doc.project_end).toBeUndefined();
  });

  it('defaults visibility to lowercase PRIVATE when plan.visibility is falsy', async () => {
    const plan = buildPlan();
    // Bypass the constructor default to simulate a raw null visibility value
    (plan as unknown as Record<string, unknown>).visibility = null;
    const project = buildProject({ id: plan.projectId });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.visibility).toBe(PlanVisibility.PRIVATE.toLowerCase());
  });

  it('preserves the plan visibility when it is explicitly set', async () => {
    const plan = buildPlan({ visibility: PlanVisibility.ORGANIZATIONAL });
    const project = buildProject({ id: plan.projectId });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.visibility).toBe(PlanVisibility.ORGANIZATIONAL);
  });

  it('sets is_test from the project and featured from the plan', async () => {
    const plan = buildPlan({ featured: true });
    const project = buildProject({ id: plan.projectId, isTestProject: true });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.is_test).toBe(true);
    expect(doc.featured).toBe(true);
  });

  it('converts a valid registered date to ISO format', async () => {
    const registered = '2025-03-20T10:00:00.000Z';
    const plan = buildPlan({ registered });
    const project = buildProject({ id: plan.projectId });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.registered).toBe(new Date(registered).toISOString());
  });

  it('leaves registered undefined when it is null', async () => {
    const plan = buildPlan({ registered: null });
    const project = buildProject({ id: plan.projectId });

    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.registered).toBeUndefined();
  });

  it('includes alternate_identifier_ids returned by AlternateIdentifier.findByPlanId', async () => {
    const altId = 'zenodo.1234567';
    (AlternateIdentifier.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([
      { alternateIdentifier: altId },
    ]);

    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });
    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.alternate_identifier_ids).toContain(altId);
  });

  it('includes related_identifier_ids returned by AcceptedWork.findByPlanId', async () => {
    const doi = `10.1234/${casual.word}`;
    (AcceptedWork.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([{ doi }]);

    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });
    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.related_identifier_ids).toContain(doi);
  });

  it('populates contributor_ids and contributors_search for plan-linked members with an ORCID', async () => {
    const orcidSuffix = '0000-0001-2345-6789';
    const member = buildProjectMember(casual.integer(1, 999), {
      givenName: 'Jane',
      surName: 'Smith',
      orcid: `${TEST_ORCID_BASE}${orcidSuffix}`,
    });
    const planMember = buildPlanMember(member.id);

    (ProjectMember.findByProjectId as jest.Mock) = jest.fn().mockResolvedValue([member]);
    (PlanMember.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([planMember]);

    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });
    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.contributor_ids).toContain(orcidSuffix);
    expect(doc.contributors_search).toContain('jane smith');
    expect(doc.contributors_search).toContain('smith, jane');
  });

  it('excludes project members that are not linked to the plan', async () => {
    const member = buildProjectMember(casual.integer(1, 999));
    const planMember = buildPlanMember(casual.integer(10000, 19999)); // links to a different id

    (ProjectMember.findByProjectId as jest.Mock) = jest.fn().mockResolvedValue([member]);
    (PlanMember.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([planMember]);

    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });
    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.contributor_ids).toEqual([]);
  });

  it('populates institution_ids and institutions_facets from member affiliations', async () => {
    const rorSuffix = `0${casual.integer(10000000, 99999999)}`;
    const rorUri = `${TEST_ROR_BASE}${rorSuffix}`;
    const affiliation = buildAffiliation(rorUri, {
      name: 'State University',
      displayName: 'State University',
    });

    const member = buildProjectMember(casual.integer(1, 999), { affiliationId: rorUri });
    const planMember = buildPlanMember(member.id);

    (ProjectMember.findByProjectId as jest.Mock) = jest.fn().mockResolvedValue([member]);
    (PlanMember.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([planMember]);
    (Affiliation.findByURI as jest.Mock) = jest.fn().mockResolvedValue(affiliation);

    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });
    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.institution_ids).toContain(rorSuffix);
    expect(doc.institutions_facets).toContain('State University');
  });

  it('populates funder_ids and funding_facets for plan-linked funding', async () => {
    const rorSuffix = `0${casual.integer(10000000, 99999999)}`;
    const rorUri = `${TEST_ROR_BASE}${rorSuffix}`;
    const grantId = `award-${casual.word}`;
    const funderAffiliation = buildAffiliation(rorUri, {
      name: 'NIH',
      displayName: 'National Institutes of Health',
      funder: true,
    });
    const funding = buildProjectFunding(casual.integer(1, 999), rorUri, { grantId });
    const planFunding = buildPlanFunding(funding.id);

    (ProjectFunding.findByProjectId as jest.Mock) = jest.fn().mockResolvedValue([funding]);
    (PlanFunding.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([planFunding]);
    (Affiliation.findByURI as jest.Mock) = jest.fn().mockResolvedValue(funderAffiliation);

    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });
    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.funder_ids).toContain(rorSuffix);
    expect(doc.funding_facets).toContain('National Institutes of Health');
    // Note: convertFunding does not map grantId → grant_id on the display object,
    // so grant_ids remains empty in the current implementation.
    expect(doc.grant_ids).toEqual([]);
  });

  it('excludes project funding that is not linked to the plan', async () => {
    const rorUri = `${TEST_ROR_BASE}0${casual.integer(10000000, 99999999)}`;
    const funding = buildProjectFunding(casual.integer(1, 999), rorUri);
    const planFunding = buildPlanFunding(casual.integer(10000, 19999)); // links to a different id

    (ProjectFunding.findByProjectId as jest.Mock) = jest.fn().mockResolvedValue([funding]);
    (PlanFunding.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([planFunding]);

    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });
    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.funder_ids).toEqual([]);
  });

  it('includes funder_project_ids and opportunity_ids when set on funding', async () => {
    const rorUri = `${TEST_ROR_BASE}0${casual.integer(10000000, 99999999)}`;
    const funderOpportunityNumber = `RFA-AA-${casual.integer(10, 99)}-${casual.integer(100, 999)}`;
    const funderProjectNumber = `R01${casual.word.toUpperCase()}`;
    const funderAffiliation = buildAffiliation(rorUri, { funder: true });
    const funding = buildProjectFunding(casual.integer(1, 999), rorUri, {
      funderOpportunityNumber,
      funderProjectNumber,
    });
    const planFunding = buildPlanFunding(funding.id);

    (ProjectFunding.findByProjectId as jest.Mock) = jest.fn().mockResolvedValue([funding]);
    (PlanFunding.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([planFunding]);
    (Affiliation.findByURI as jest.Mock) = jest.fn().mockResolvedValue(funderAffiliation);

    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });
    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.opportunity_ids).toContain(funderOpportunityNumber);
    expect(doc.funder_project_ids).toContain(funderProjectNumber);
  });

  it('extracts repository_ids and repositories_facets from a research output answer', async () => {
    const answer = new Answer({
      id: casual.integer(1, 9999),
      planId: casual.integer(1, 9999),
      versionedSectionId: casual.integer(1, 9999),
      versionedQuestionId: casual.integer(1, 9999),
      json: buildResearchOutputAnswerJson(),
    });

    (Answer.findByPlanId as jest.Mock) = jest.fn().mockResolvedValue([answer]);

    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });
    await updateIndex(reference, context, plan, project);

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.repository_ids).toContain('re3data.r3d100000001');
    expect(doc.repositories_facets).toContain('GenBank');
  });

  it('resolves without throwing when there are no members, funding, or answers', async () => {
    const plan = buildPlan();
    const project = buildProject({ id: plan.projectId });

    await expect(updateIndex(reference, context, plan, project)).resolves.toBeUndefined();

    const doc = mockUpdateIndexItem.mock.calls[0][3];
    expect(doc.contributor_ids).toEqual([]);
    expect(doc.funder_ids).toEqual([]);
    expect(doc.repository_ids).toEqual([]);
    expect(doc.related_identifier_ids).toEqual([]);
    expect(doc.alternate_identifier_ids).toEqual([]);
  });

  it('fetches the project via Project.findById when no project argument is provided', async () => {
    const project = buildProject();
    const plan = buildPlan({ projectId: project.id });

    (Project.findById as jest.Mock) = jest.fn().mockResolvedValue(project);

    await updateIndex(reference, context, plan);

    expect(Project.findById).toHaveBeenCalledWith(reference, context, plan.projectId);
    expect(mockUpdateIndexItem).toHaveBeenCalledTimes(1);
  });
});

// ── removeIndex ───────────────────────────────────────────────────────────────

describe('removeIndex', () => {
  it('calls openSearch.removeIndexItem with INDEX_NAME and the stripped dmpId', async () => {
    const suffix = `11.22222/${casual.word}`;
    const plan = buildPlan({ dmpId: `${TEST_DMP_ID_BASE}${suffix}` });

    await removeIndex(context, plan);

    expect(mockRemoveIndexItem).toHaveBeenCalledTimes(1);
    const [idxName, id] = mockRemoveIndexItem.mock.calls[0];
    expect(idxName).toBe(INDEX_NAME);
    expect(id).toBe(suffix);
  });
});










