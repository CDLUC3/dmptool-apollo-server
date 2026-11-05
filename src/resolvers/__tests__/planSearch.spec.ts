/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-function-type, @typescript-eslint/no-extraneous-class */
import { jest } from '@jest/globals';

jest.unstable_mockModule('../../services/indexDMPService.js', () => ({
  searchIndex: jest.fn<(...args: any[]) => Promise<any>>(),
  removeIndexItem: jest.fn(),
  updateIndexItem: jest.fn(),
  getIndexItem: jest.fn(),
  INDEX_NAME: 'dmp',
}));
jest.unstable_mockModule('../../models/Collaborator.js', () => ({
  ProjectCollaborator: { query: jest.fn<(...args: any[]) => Promise<any>>() },
  ProjectCollaboratorAccessLevel: { PRIMARY: 'PRIMARY', OWN: 'OWN', EDIT: 'EDIT', COMMENT: 'COMMENT' },
  TemplateCollaborator: class {},
}));

const { resolvers } = await import('../plan.js');
const { searchIndex } = await import('../../services/indexDMPService.js');
const { ProjectCollaborator } = await import('../../models/Collaborator.js');

const search = resolvers.Query.search as Function;
const run = (options = {}, token = null) => search({}, { options }, {
  token,
  logger: { error: jest.fn() },
} as any);

beforeEach(() => {
  jest.clearAllMocks();
  (searchIndex as jest.Mock).mockImplementation(async () => ({ items: [{ dmp_id: 'dmp-1' }], total: 9 }));
  (ProjectCollaborator.query as jest.Mock).mockImplementation(async () => ['dmp-12']);
});

describe('searchDMPs resolver', () => {
  it('builds RDA filters, sorting, and offset pagination', async () => {
    await expect(run({
      offset: 10, count: 5,
      query: ['climate'], languages: ['eng'], funderIds: ['funder-1'],
      createdAfter: '2025-01-01T00:00:00Z', sort: ['title,asc', 'modified,desc'],
    })).resolves.toMatchObject({ totalCount: 9, offset: 10, count: 5, items: [{ dmp_id: 'dmp-1' }] });
    expect(searchIndex).toHaveBeenCalledWith('Plan search resolver', expect.anything(), {
      bool: { filter: expect.arrayContaining([
        { multi_match: { query: 'climate', fields: ['title^3', 'abstract', 'project_title'], type: 'best_fields' } },
        { terms: { funder_ids: ['funder-1'] } },
        { range: { created: { gt: '2025-01-01T00:00:00Z' } } },
        { term: { visibility: 'public' } },
      ]) },
    }, [{ 'title.keyword': { order: 'asc' } }, { modified: { order: 'desc' } }, { dmp_id: { order: 'asc' } }], 5, 10);
  });

  it('allows superadmins to search without visibility restrictions', async () => {
    await run({}, { role: 'SUPERADMIN' });
    const query = (searchIndex as jest.Mock).mock.calls[0][2] as any;
    expect(query.bool.filter).toEqual([]);
  });

  it('includes public and collaborator DMPs for researchers', async () => {
    await run({}, { role: 'RESEARCHER', id: 7 });
    expect(ProjectCollaborator.query).toHaveBeenCalledWith(expect.anything(),
      'SELECT DISTINCT p.dmpId ' +
      'FROM projectCollaborators pc ' +
      'JOIN projects prj ON pc.projectId = prj.id ' +
      'JOIN plans p ON prj.id = p.projectId ' +
      'WHERE pc.userId = ?',
      ['7'], 'Plan search resolver');
    const filter = ((searchIndex as jest.Mock).mock.calls[0][2] as any).bool.filter[0];
    expect(filter.bool.should).toEqual(expect.arrayContaining([
      { term: { visibility: 'public' } }, { terms: { dmp_id: ['dmp-12'] } },
    ]));
  });

  it('includes public plans and the admin affiliation scope', async () => {
    await run({}, { role: 'ADMIN', affiliationId: 'ror-1' });
    const filter = ((searchIndex as jest.Mock).mock.calls[0][2] as any).bool.filter[0];
    expect(filter.bool.should).toEqual(expect.arrayContaining([
      { term: { visibility: 'public' } }, { terms: { affiliation_id: ['ror-1'] } },
    ]));
  });

  it('rejects invalid pagination, sort values, and long search strings', async () => {
    await expect(run({ count: 101 })).rejects.toThrow();
    await expect(run({ sort: ['created,sideways'] })).rejects.toThrow();
    await expect(run({ query: ['x'.repeat(501)] })).rejects.toThrow();
  });
});
