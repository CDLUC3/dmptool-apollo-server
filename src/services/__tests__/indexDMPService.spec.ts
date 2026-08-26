import casual from 'casual';
import { MyContext } from '../../context.js';
import {
  generateSearchTerms,
  INDEX_NAME,
  getIndexItem,
  searchIndex,
  updateIndexItem,
  removeIndexItem,
} from '../indexDMPService.js';
import { Plan, PlanVisibility } from '../../models/Plan.js';
import { Project } from '../../models/Project.js';
import { Answer } from '../../models/Answer.js';
import { ProjectMember, PlanMember } from '../../models/Member.js';
import { PlanFunding, ProjectFunding, ProjectFundingStatus } from '../../models/Funding.js';
import { Affiliation } from '../../models/Affiliation.js';
import { AlternateIdentifier } from '../../models/AlternateIdentifier.js';
import { AcceptedWork } from '../../models/RelatedWork.js';

jest.mock('../../datasources/mysql', () => ({
  __esModule: true,
  MySQLConnection: jest.fn().mockImplementation(() => ({
    pool: null,
    query: jest.fn(),
    withTransaction: jest.fn(),
  })),
}));

jest.mock('../../config/awsConfig', () => ({
  awsConfig: {
    opensearchServerless: { endpoint: 'http://localhost:9200' },
  },
}));

jest.mock('../../datasources/openSearch', () => {
  const actual = jest.requireActual('../../datasources/openSearch');
  return {
    __esModule: true,
    tokenizeText: actual.tokenizeText,
    OpenSearch: jest.fn(),
  };
});

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
    created: '2025-01-01T00:00:00.000Z',
    modified: '2025-01-02T00:00:00.000Z',
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
    created: '2025-01-01T00:00:00.000Z',
    modified: '2025-01-03T00:00:00.000Z',
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
    orcid: `${TEST_ORCID_BASE}${casual.integer(1000, 9999)}-${casual.integer(1000, 9999)}-${casual.integer(1000, 9999)}`,
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
    funderOpportunityNumber: `RFA-${casual.integer(10, 99)}`,
    funderProjectNumber: `R01${casual.word.toUpperCase()}`,
    ...overrides,
  });

const buildPlanFunding = (projectFundingId: number): PlanFunding =>
  new PlanFunding({
    id: casual.integer(1, 9999),
    planId: casual.integer(1, 9999),
    projectFundingId,
  });

const buildAffiliation = (uri: string, overrides: Partial<Record<string, unknown>> = {}): Affiliation =>
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
  getIndexItem: jest.Mock;
  search: jest.Mock;
  updateIndexItem: jest.Mock;
  removeIndexItem: jest.Mock;
};
let context: MyContext;

beforeEach(() => {
  jest.resetAllMocks();

  mockOpenSearch = {
    getIndexItem: jest.fn(),
    search: jest.fn(),
    updateIndexItem: jest.fn().mockResolvedValue(undefined),
    removeIndexItem: jest.fn().mockResolvedValue(undefined),
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

    (ProjectMember.findByProjectId as jest.Mock).mockResolvedValue([member]);
    (PlanMember.findByPlanId as jest.Mock).mockResolvedValue([{ ...planMember, id: planMemberId, projectMemberId: memberId }]);
    (ProjectFunding.findByProjectId as jest.Mock).mockResolvedValue([funding]);
    (PlanFunding.findByPlanId as jest.Mock).mockResolvedValue([{ ...planFunding, projectFundingId: fundingId }]);
    (Affiliation.findByURI as jest.Mock).mockImplementation(async (_ref: string, _context: MyContext, uri: string) => {
      if (uri === `${TEST_ROR_BASE}abcd1234`) return memberAffiliation;
      if (uri === funderUri) return funderAffiliation;
      return null;
    });
    (AlternateIdentifier.findByPlanId as jest.Mock).mockResolvedValue([{ alternateIdentifier: '10.1234/demo' }]);
    (AcceptedWork.findByPlanId as jest.Mock).mockResolvedValue([{ doi: '10.9999/related' }]);
    (Answer.findByPlanId as jest.Mock).mockResolvedValue([{ json: buildResearchOutputAnswerJson() }]);

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

    (Project.findById as jest.Mock).mockResolvedValue(project);
    (Answer.findByPlanId as jest.Mock).mockResolvedValue([]);

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
