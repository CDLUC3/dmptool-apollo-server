import { jest } from '@jest/globals';
import casual from 'casual';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

// --- datasources/mysql.js ---
jest.unstable_mockModule('../../datasources/mysql.js', () => ({
  __esModule: true,
  MySQLConnection: jest.fn().mockImplementation(() => ({
    pool: null,
    query: jest.fn(),
    withTransaction: jest.fn(),
  })),
}));

// --- config/awsConfig.js ---
jest.unstable_mockModule('../../config/awsConfig.js', () => ({
  awsConfig: {
    opensearchServerless: { endpoint: 'http://localhost:9200' },
  },
}));

// --- datasources/openSearch.js ---
// tokenizeText is real (generateSearchTerms in indexDMPService.js depends on
// its real tokenizing behavior — that's exercised directly by the
// generateSearchTerms describe block below), OpenSearch itself is fully
// mocked since indexDMPService.js only ever receives an OpenSearch instance
// via context.dataSources, never constructs one directly.
const actualOpenSearch = await import('../../datasources/openSearch.js');
jest.unstable_mockModule('../../datasources/openSearch.js', () => ({
  __esModule: true,
  tokenizeText: actualOpenSearch.tokenizeText,
  OpenSearch: jest.fn(),
}));

import type { MyContext } from '../../context.js';


type ProjectMemberInstance = InstanceType<typeof ProjectMember>;
function asProjectMemberList(value: any[]): ProjectMemberInstance[] {
  return value as ProjectMemberInstance[];
}

type PlanMemberInstance = InstanceType<typeof PlanMember>;
function asPlanMemberList(value: any[]): PlanMemberInstance[] {
  return value as PlanMemberInstance[];
}

type ProjectFundingInstance = InstanceType<typeof ProjectFunding>;
function asProjectFundingList(value: any[]): ProjectFundingInstance[] {
  return value as ProjectFundingInstance[];
}

type PlanFundingInstance = InstanceType<typeof PlanFunding>;
function asPlanFundingList(value: any[]): PlanFundingInstance[] {
  return value as PlanFundingInstance[];
}

type AffiliationInstance = InstanceType<typeof Affiliation>;
function asAffiliation(value: any): AffiliationInstance {
  return value as AffiliationInstance;
}

type AlternateIdentifierInstance = InstanceType<typeof AlternateIdentifier>;
function asAlternateIdentifierList(value: any[]): AlternateIdentifierInstance[] {
  return value as AlternateIdentifierInstance[];
}

type AcceptedWorkInstance = InstanceType<typeof AcceptedWork>;
function asAcceptedWorkList(value: any[]): AcceptedWorkInstance[] {
  return value as AcceptedWorkInstance[];
}

type AnswerInstance = InstanceType<typeof Answer>;
function asAnswerList(value: any[]): AnswerInstance[] {
  return value as AnswerInstance[];
}
// ---------------------------------------------------------------------------
// Everything below is dynamic, registered after every mock above.
// ---------------------------------------------------------------------------
const {
  generateSearchTerms,
  INDEX_NAME,
  getIndexItem,
  searchIndex,
  updateIndexItem,
  removeIndexItem,
} = await import('../indexDMPService.js');
const { Plan, PlanVisibility } = await import('../../models/Plan.js');
const { Project } = await import('../../models/Project.js');
const { Answer } = await import('../../models/Answer.js');
const { ProjectMember, PlanMember } = await import('../../models/Member.js');
const { PlanFunding, ProjectFunding, ProjectFundingStatus } = await import('../../models/Funding.js');
const { Affiliation } = await import('../../models/Affiliation.js');
const { AlternateIdentifier } = await import('../../models/AlternateIdentifier.js');
const { AcceptedWork } = await import('../../models/RelatedWork.js');

const TEST_DMP_ID_BASE = 'http://dmsp.com/';
const TEST_ROR_BASE = 'http://ror.example.com/';
const TEST_ORCID_BASE = 'http://sandbox.orcid.org/';

const buildPlan = (overrides: Partial<Record<string, unknown>> = {}) =>
  new Plan({
    id: casual.integer(1, 9999),
    projectId: casual.integer(1, 9999),
    dmpId: `${TEST_DMP_ID_BASE}11.22222/${casual.word}`,
    title: casual.title,
    visibility: PlanVisibility.PUBLIC,
    featured: false,
    created: '2025-01-01T00:00:00.000Z',
    modified: '2025-01-02T00:00:00.000Z',
    registered: null,
    ...overrides,
  });

const buildProject = (overrides: Partial<Record<string, unknown>> = {}) =>
  new Project({
    id: casual.integer(1, 9999),
    title: casual.title,
    abstractText: casual.sentences(2),
    startDate: '2025-01-01',
    endDate: '2026-12-31',
    isTestProject: false,
    created: '2025-01-01T00:00:00.000Z',
    modified: '2025-01-03T00:00:00.000Z',
    ...overrides,
  });

const buildProjectMember = (
  id = casual.integer(1, 9999),
  overrides: Partial<Record<string, unknown>> = {}
) =>
  new ProjectMember({
    id,
    projectId: casual.integer(1, 9999),
    givenName: casual.first_name,
    surName: casual.last_name,
    orcid: `${TEST_ORCID_BASE}${casual.integer(1000, 9999)}-${casual.integer(1000, 9999)}-${casual.integer(1000, 9999)}`,
    affiliationId: `${TEST_ROR_BASE}${casual.word}`,
    isPrimaryContact: false,
    ...overrides,
  });

const buildPlanMember = (projectMemberId: number) =>
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
) =>
  new ProjectFunding({
    id,
    projectId: casual.integer(1, 9999),
    affiliationId,
    status: ProjectFundingStatus.PLANNED,
    grantId: `award-${casual.word}`,
    funderOpportunityNumber: `RFA-${casual.integer(10, 99)}`,
    funderProjectNumber: `R01${casual.word.toUpperCase()}`,
    ...overrides,
  });

const buildPlanFunding = (projectFundingId: number) =>
  new PlanFunding({
    id: casual.integer(1, 9999),
    planId: casual.integer(1, 9999),
    projectFundingId,
  });

const buildAffiliation = (uri: string, overrides: Partial<Record<string, unknown>> = {}) =>
  new Affiliation({
    id: casual.integer(1, 9999),
    uri,
    name: casual.company_name,
    displayName: casual.company_name,
    displayAbbreviation: casual.word.toUpperCase().slice(0, 5),
    acronyms: ['ACR'],
    aliases: ['Alias One'],
    active: true,
    funder: false,
    types: ['OTHER'],
    ...overrides,
  });

const buildResearchOutputAnswerJson = (): string => JSON.stringify({
  commonStandardId: 'researchOutputTable',
  answer: [{
    commonStandardId: 'researchOutputTableRow',
    columns: [
      { commonStandardId: 'title', answer: 'My Dataset' },
      { commonStandardId: 'type', answer: 'dataset' },
      { commonStandardId: 'description', answer: 'A great dataset' },
      {
        commonStandardId: 'host',
        answer: [{ repositoryId: 're3data.r3d100000001', repositoryName: 'GenBank' }],
      },
    ],
  }],
});

let mockOpenSearch: {
  getIndexItem: ReturnType<typeof jest.fn>;
  search: ReturnType<typeof jest.fn>;
  updateIndexItem: ReturnType<typeof jest.fn>;
  removeIndexItem: ReturnType<typeof jest.fn>;
};
let context: MyContext;

beforeEach(() => {
  jest.resetAllMocks();

  mockOpenSearch = {
    getIndexItem: jest.fn<(...args: any[]) => any>(),
    search: jest.fn<(...args: any[]) => any>(),
    updateIndexItem: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined),
    removeIndexItem: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined),
  };

  context = {
    dataSources: {
      openSearchServerlessDataSource: mockOpenSearch,
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

  jest.spyOn(AlternateIdentifier, 'findByPlanId').mockResolvedValue([]);
  jest.spyOn(AcceptedWork, 'findByPlanId').mockResolvedValue([]);
  jest.spyOn(Answer, 'findByPlanId').mockResolvedValue([]);
  jest.spyOn(ProjectMember, 'findByProjectId').mockResolvedValue([]);
  jest.spyOn(ProjectFunding, 'findByProjectId').mockResolvedValue([]);
  jest.spyOn(PlanMember, 'findByPlanId').mockResolvedValue([]);
  jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue([]);
  jest.spyOn(Affiliation, 'findByURI').mockResolvedValue(null);
  jest.spyOn(Project, 'findById').mockResolvedValue(null);
});

describe('generateSearchTerms', () => {
  it('returns an empty array when title and description are undefined', () => {
    expect(generateSearchTerms(undefined, undefined)).toEqual([]);
  });

  it('returns tokens from both title and description and removes stop words', () => {
    const result = generateSearchTerms('the impact of climate on the ocean', 'ocean temperatures');
    expect(result).toContain('impact');
    expect(result).toContain('climate');
    expect(result).toContain('ocean');
    expect(result).toContain('temperatures');
    expect(result).not.toContain('the');
    expect(result).not.toContain('of');
  });

  it('generates adjacent bigrams from multi-word titles', () => {
    const result = generateSearchTerms('climate change research');
    expect(result).toContain('climate change');
    expect(result).toContain('change research');
  });

  it('deduplicates repeated search terms', () => {
    const result = generateSearchTerms('ocean research', 'ocean data');
    expect(result.filter((term) => term === 'ocean').length).toBe(1);
  });

  it('ignores short tokens', () => {
    const result = generateSearchTerms('a big study');
    expect(result).not.toContain('a');
    expect(result).toContain('big');
    expect(result).toContain('study');
  });
});

describe('getIndexItem', () => {
  it('returns the index record for a known dmp id', async () => {
    const plan = buildPlan({ dmpId: `${TEST_DMP_ID_BASE}11.22222/demo` });
    const response = { dmp_id: '11.22222/demo', title: 'Demo DMP' };
    mockOpenSearch.getIndexItem.mockResolvedValue(response);

    await expect(getIndexItem('ref', context, plan.dmpId)).resolves.toEqual(response);
    expect(mockOpenSearch.getIndexItem).toHaveBeenCalledWith(INDEX_NAME, '11.22222/demo');
  });

  it('throws when the index item cannot be found', async () => {
    mockOpenSearch.getIndexItem.mockResolvedValue(undefined);

    await expect(getIndexItem('ref', context, 'https://dmsp.com/11.22222/demo')).rejects.toThrow(
      'Failed to fetch index item for DMP ID: https://dmsp.com/11.22222/demo'
    );
  });
});

describe('searchIndex', () => {
  it('returns the items from the response when matches exist', async () => {
    const items = [{ dmp_id: '11.22222/demo' }, { dmp_id: '11.22222/other' }];
    mockOpenSearch.search.mockResolvedValue({ total: 2, items });

    await expect(searchIndex('ref', context, { match_all: {} }, [], 25)).resolves.toEqual(items);
    expect(mockOpenSearch.search).toHaveBeenCalledWith(INDEX_NAME, {
      size: 25,
      query: { match_all: {} },
      sort: [],
    });
  });

  it('returns an empty array when there are no hits', async () => {
    mockOpenSearch.search.mockResolvedValue({ total: 0, items: [] });

    await expect(searchIndex('ref', context, { match_all: {} })).resolves.toEqual([]);
  });

  it('throws when search returns no response', async () => {
    mockOpenSearch.search.mockResolvedValue(undefined);

    await expect(searchIndex('ref', context, { match_all: {} })).rejects.toThrow(
      'Failed to search index for query: {"match_all":{}}'
    );
  });
});

describe('updateIndexItem', () => {
  const ref = 'test.updateIndexItem';

  it('builds and persists the plan document when all related objects exist', async () => {
    const project = buildProject({
      id: 100,
      title: 'My project',
      abstractText: 'A wonderful abstract',
      startDate: '2025-01-15',
      endDate: '2026-06-30',
      isTestProject: true,
    });
    const plan = buildPlan({
      id: 200,
      projectId: project.id,
      dmpId: `${TEST_DMP_ID_BASE}11.22222/demo-plan`,
      title: 'My DMP',
      visibility: PlanVisibility.PUBLIC,
      featured: true,
      registered: '2025-03-20T10:00:00.000Z',
    });

    const memberId = 300;
    const member = buildProjectMember(memberId, {
      projectId: project.id,
      givenName: 'Jane',
      surName: 'Smith',
      orcid: `${TEST_ORCID_BASE}0000-0001-2345-6789`,
      affiliationId: `${TEST_ROR_BASE}abcd1234`,
    });
    const planMember = buildPlanMember(memberId);
    const planMemberId = planMember.id;
    const memberAffiliation = buildAffiliation(`${TEST_ROR_BASE}abcd1234`, {
      name: 'State University',
      displayName: 'State University',
    });

    const fundingId = 400;
    const funderUri = `${TEST_ROR_BASE}funder5678`;
    const funding = buildProjectFunding(fundingId, funderUri, {
      projectId: project.id,
      funderOpportunityNumber: 'RFA-22-801',
      funderProjectNumber: 'R01ABC123',
      status: ProjectFundingStatus.PLANNED,
    });
    const planFunding = buildPlanFunding(fundingId);
    const funderAffiliation = buildAffiliation(funderUri, {
      name: 'National Science Foundation',
      displayName: 'National Science Foundation',
      funder: true,
    });

    jest.spyOn(ProjectMember, 'findByProjectId').mockResolvedValue([member]);
    jest.spyOn(PlanMember, 'findByPlanId').mockResolvedValue(asPlanMemberList([{ ...planMember, id: planMemberId, projectMemberId: memberId }]));
    jest.spyOn(ProjectFunding, 'findByProjectId').mockResolvedValue([funding]);
    jest.spyOn(PlanFunding, 'findByPlanId').mockResolvedValue(asPlanFundingList([{ ...planFunding, projectFundingId: fundingId }]));
    jest.spyOn(Affiliation, 'findByURI').mockImplementation(async (_ref: string, _context: MyContext, uri: string) => {
      if (uri === `${TEST_ROR_BASE}abcd1234`) return memberAffiliation;
      if (uri === funderUri) return funderAffiliation;
      return null;
    });
    jest.spyOn(AlternateIdentifier, 'findByPlanId').mockResolvedValue(asAlternateIdentifierList([{ alternateIdentifier: '10.1234/demo' }]));
    jest.spyOn(AcceptedWork, 'findByPlanId').mockResolvedValue(asAcceptedWorkList([{ doi: '10.9999/related' }]));
    jest.spyOn(Answer, 'findByPlanId').mockResolvedValue(asAnswerList([{ json: buildResearchOutputAnswerJson() }]));

    await updateIndexItem(ref, context, plan, project);

    const doc = mockOpenSearch.updateIndexItem.mock.calls[0][3];
    expect(doc.dmp_id).toBe('11.22222/demo-plan');
    expect(doc.title).toBe('My DMP');
    expect(doc.project_title).toBe('My project');
    expect(doc.abstract).toBe('A wonderful abstract');
    expect(doc.project_start).toBe(new Date('2025-01-15').toISOString());
    expect(doc.project_end).toBe(new Date('2026-06-30').toISOString());
    expect(doc.visibility).toBe(PlanVisibility.PUBLIC);
    expect(doc.is_test).toBe(true);
    expect(doc.featured).toBe(true);
    expect(doc.alternate_identifier_ids).toContain('10.1234/demo');
    expect(doc.related_identifier_ids).toContain('10.9999/related');
    expect(doc.contributor_ids).toContain('0000-0001-2345-6789');
    expect(doc.contributors_search).toEqual(expect.arrayContaining(['jane smith', 'smith, jane']));
    expect(doc.institution_ids).toContain('abcd1234');
    expect(doc.institutions_facets).toContain('State University');
    expect(doc.funder_ids).toContain('funder5678');
    expect(doc.funding_facets).toContain('National Science Foundation');
    expect(doc.repository_ids).toContain('re3data.r3d100000001');
    expect(doc.repositories_facets).toContain('GenBank');
  });

  it('fetches the project automatically when one is not provided', async () => {
    const project = buildProject({ id: 123, title: 'Auto Project' });
    const plan = buildPlan({ projectId: project.id, dmpId: `${TEST_DMP_ID_BASE}11.22222/auto` });

    jest.spyOn(Project, 'findById').mockResolvedValue(project);
    jest.spyOn(Answer, 'findByPlanId').mockResolvedValue([]);

    await updateIndexItem(ref, context, plan);

    expect(Project.findById).toHaveBeenCalledWith(ref, context, plan.projectId);
    expect(mockOpenSearch.updateIndexItem).toHaveBeenCalledTimes(1);
  });

  it('defaults visibility to private when the plan visibility is empty', async () => {
    const project = buildProject({ id: 99 });
    const plan = buildPlan({ projectId: project.id });
    (plan as unknown as Record<string, unknown>).visibility = undefined;

    await updateIndexItem(ref, context, plan, project);

    const doc = mockOpenSearch.updateIndexItem.mock.calls[0][3];
    expect(doc.visibility).toBe(PlanVisibility.PRIVATE.toLowerCase());
  });

  it('handles blank associations without error and keeps arrays empty', async () => {
    const project = buildProject({ id: 88 });
    const plan = buildPlan({ projectId: project.id });

    await updateIndexItem(ref, context, plan, project);

    const doc = mockOpenSearch.updateIndexItem.mock.calls[0][3];
    expect(doc.alternate_identifier_ids).toEqual([]);
    expect(doc.related_identifier_ids).toEqual([]);
    expect(doc.contributor_ids).toEqual([]);
    expect(doc.funder_ids).toEqual([]);
    expect(doc.repository_ids).toEqual([]);
  });
});

describe('removeIndexItem', () => {
  it('removes the indexed DMP using the stripped dmp id', async () => {
    const plan = buildPlan({ dmpId: `${TEST_DMP_ID_BASE}11.22222/demo-remove` });

    await removeIndexItem('ref', context, plan);

    expect(mockOpenSearch.removeIndexItem).toHaveBeenCalledWith(INDEX_NAME, '11.22222/demo-remove');
  });
});