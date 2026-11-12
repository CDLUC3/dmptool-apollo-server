import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

jest.unstable_mockModule('../../context.js', () => ({
  buildContext: jest.fn(),
}));

import type { MyContext } from '../../context.js';

const { MySqlModel } = await import('../MySqlModel.js');
const { AlternateIdentifier } = await import('../AlternateIdentifier.js');
const { Answer } = await import('../Answer.js');
const { PlanFunding, ProjectFunding } = await import('../Funding.js');
const { PlanMember, ProjectMember } = await import('../Member.js');
const { AcceptedWork } = await import('../RelatedWork.js');
const {
  DataSyncJob,
  DataSyncJobStatus,
  OpenSearchDMPSync,
} = await import('../DataSyncJob.js');

const item = {
  dmp_id: '10.1234/example',
  project_id: 1,
  plan_id: 42,
  affiliation_id: 'https://ror.org/example',
  visibility: 'PUBLIC',
  output_formats: [],
  is_test: false,
  featured: false,
  created: '2026-01-01T00:00:00.000Z',
  modified: '2026-01-02T00:00:00.000Z',
  contributor_ids: [],
  institution_ids: [],
  funder_ids: [],
  grant_ids: [],
  opportunity_ids: [],
  funder_project_ids: [],
  alternate_identifier_ids: [],
  repository_ids: [],
  related_identifier_ids: [],
  contact_ids: [],
  dataset_ids: [],
  metadata_standard_ids: [],
  license_refs: [],
  host_ids: [],
  host_names: [],
  personal_data: [],
  sensitive_data: [],
  ethical_issues_exist: 'unknown',
  funding_facets: [],
  institutions_facets: [],
  funding_search: [],
  contributors_search: [],
  institutions_search: [],
};

class TestSyncJob extends DataSyncJob {
  public batches: typeof item[][] = [];
  public syncResult = true;
  public syncError?: Error;
  public syncedItems: typeof item[] = [];

  constructor() {
    super({ jobName: 'TestSyncJob' });
  }

  async fetchDataToSync(): Promise<typeof item[]> {
    return this.batches.shift() ?? [];
  }

  async performSync(
    _reference: string,
    _context: MyContext,
    data: typeof item,
  ): Promise<boolean> {
    this.syncedItems.push(data);
    if (this.syncError) throw this.syncError;
    return this.syncResult;
  }
}

describe('DataSyncJob', () => {
  const context = {
    logger: {
      debug: jest.fn(),
      error: jest.fn(),
    },
  } as unknown as MyContext;

  beforeEach(() => {
    jest.restoreAllMocks();
  });

  it('uses supplied persisted values and assigns the OpenSearch job name', () => {
    const job = new OpenSearchDMPSync({
      jobName: 'Ignored',
      status: DataSyncJobStatus.FAILED,
      cursorTimestamp: '2026-03-01 10:00:00.000',
      cursorId: 99,
      failureCount: 2,
      errorMessage: 'Previous error',
    });

    expect(job.jobName).toBe('OpenSearchDMPSync');
    expect(job.status).toBe(DataSyncJobStatus.FAILED);
    expect(job.cursorTimestamp).toBe('2026-03-01 10:00:00.000');
    expect(job.cursorId).toBe(99);
    expect(job.failureCount).toBe(2);
    expect(job.errorMessage).toBe('Previous error');
  });

  it('initializes fields required by the sync-job table', () => {
    const job = new OpenSearchDMPSync();

    expect(job.status).toBe(DataSyncJobStatus.IDLE);
    expect(job.cursorTimestamp).toBe('1900-01-01 00:00:00.000');
  });

  it('rejects a blank job name after trimming it', async () => {
    const job = new TestSyncJob();
    job.jobName = '  ';
    const insert = jest.spyOn(MySqlModel, 'insert');

    await expect(job.create('test', context)).resolves.toBe(false);

    expect(job.errors.jobName).toBe("Job name can't be blank");
    expect(insert).not.toHaveBeenCalled();
  });

  it('creates valid jobs and delegates deletion to MySqlModel', async () => {
    const job = new TestSyncJob();
    job.id = 7;
    jest.spyOn(MySqlModel, 'insert').mockResolvedValue(7);
    jest.spyOn(MySqlModel, 'delete').mockResolvedValue(true);

    await expect(job.create('create', context)).resolves.toBe(true);
    await expect(job.delete(context)).resolves.toBe(true);

    expect(MySqlModel.insert).toHaveBeenCalledWith(
      context,
      'syncJobStatus',
      job,
      'create',
    );
    expect(MySqlModel.delete).toHaveBeenCalledWith(context, 'syncJobStatus', 7);
  });

  it('persists the plan ID cursor after a successful batch', async () => {
    const job = new TestSyncJob();
    job.batches = [[item], []];
    jest.spyOn(MySqlModel, 'query').mockResolvedValue([{ affectedRows: 1 }]);
    jest.spyOn(MySqlModel, 'update').mockResolvedValue(new MySqlModel());

    await job.start('test', context);

    expect(job.cursorId).toBe(item.plan_id);
    expect(job.cursorTimestamp).toBe(item.modified);
    expect(job.status).toBe(DataSyncJobStatus.COMPLETED);
  });

  it('processes every item across multiple batches before completing', async () => {
    const job = new TestSyncJob();
    const secondItem = { ...item, plan_id: 43, modified: '2026-01-03T00:00:00.000Z' };
    job.batches = [[item], [secondItem], []];
    jest.spyOn(MySqlModel, 'query').mockResolvedValue([{ affectedRows: 1 }]);
    jest.spyOn(MySqlModel, 'update').mockResolvedValue(new MySqlModel());

    await job.start('test', context, 1);

    expect(job.syncedItems).toEqual([item, secondItem]);
    expect(job.cursorId).toBe(secondItem.plan_id);
    expect(MySqlModel.update).toHaveBeenCalledTimes(3);
  });

  it('marks a job failed when progress cannot be persisted', async () => {
    const job = new TestSyncJob();
    job.batches = [[item]];
    const failedErrorSave = new MySqlModel();
    failedErrorSave.addError('general', 'Database unavailable');
    jest.spyOn(MySqlModel, 'query').mockResolvedValue([{ affectedRows: 1 }]);
    jest.spyOn(MySqlModel, 'update')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(failedErrorSave);

    await expect(job.start('test', context)).rejects.toThrow(
      'Unable to save progress for data sync job "TestSyncJob".',
    );

    expect(job.status).toBe(DataSyncJobStatus.FAILED);
    expect(job.errorMessage).toContain('Unable to save progress');
    expect(context.logger.error).toHaveBeenLastCalledWith(
      expect.any(Object),
      'Unable to save error message for synchronization',
    );
  });

  it('marks a job failed when completion cannot be persisted', async () => {
    const job = new TestSyncJob();
    job.batches = [[]];
    jest.spyOn(MySqlModel, 'query').mockResolvedValue([{ affectedRows: 1 }]);
    jest.spyOn(MySqlModel, 'update')
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(new MySqlModel());

    await expect(job.start('test', context)).rejects.toThrow(
      'Unable to complete data sync job "TestSyncJob".',
    );

    expect(job.status).toBe(DataSyncJobStatus.FAILED);
  });

  it('marks a job failed when synchronization throws', async () => {
    const job = new TestSyncJob();
    job.batches = [[item]];
    job.syncError = new Error('OpenSearch unavailable');
    jest.spyOn(MySqlModel, 'query').mockResolvedValue([{ affectedRows: 1 }]);
    jest.spyOn(MySqlModel, 'update').mockResolvedValue(new MySqlModel());

    await expect(job.start('test', context)).rejects.toThrow('OpenSearch unavailable');

    expect(job.status).toBe(DataSyncJobStatus.FAILED);
    expect(job.errorMessage).toBe('OpenSearch unavailable');
  });

  it('uses the database plan ID as the batch cursor and preserves its title', async () => {
    const job = new OpenSearchDMPSync();
    jest.spyOn(MySqlModel, 'query').mockResolvedValue([{
      ...item,
      title: 'Example plan',
      project_title: 'Example project',
      abstract_text: null,
      project_start: null,
      project_end: null,
      language_id: 'en',
      registered: null,
      is_test_project: false,
    }]);
    jest.spyOn(AlternateIdentifier, 'findByPlanIds').mockResolvedValue([]);
    jest.spyOn(AcceptedWork, 'findByPlanIds').mockResolvedValue([]);
    jest.spyOn(Answer, 'findByPlanIds').mockResolvedValue([]);
    jest.spyOn(ProjectMember, 'findByProjectIds').mockResolvedValue([]);
    jest.spyOn(ProjectFunding, 'findByProjectIds').mockResolvedValue([]);
    jest.spyOn(PlanMember, 'findByPlanIds').mockResolvedValue([]);
    jest.spyOn(PlanFunding, 'findByPlanIds').mockResolvedValue([]);

    const [result] = await job.fetchDataToSync('test', context, 1);

    expect(result.cursorId).toBe(item.plan_id);
    expect(result.title).toBe('Example plan');
  });

  it('uses the persisted timestamp and ID cursor in the batch query', async () => {
    const job = new OpenSearchDMPSync({
      cursorTimestamp: '2026-04-01 12:00:00.000',
      cursorId: 15,
    });
    jest.spyOn(MySqlModel, 'query').mockResolvedValue([]);
    jest.spyOn(AlternateIdentifier, 'findByPlanIds').mockResolvedValue([]);
    jest.spyOn(AcceptedWork, 'findByPlanIds').mockResolvedValue([]);
    jest.spyOn(Answer, 'findByPlanIds').mockResolvedValue([]);
    jest.spyOn(ProjectMember, 'findByProjectIds').mockResolvedValue([]);
    jest.spyOn(ProjectFunding, 'findByProjectIds').mockResolvedValue([]);
    jest.spyOn(PlanMember, 'findByPlanIds').mockResolvedValue([]);
    jest.spyOn(PlanFunding, 'findByPlanIds').mockResolvedValue([]);

    await expect(job.fetchDataToSync('fetch', context, 25)).resolves.toEqual([]);

    expect(MySqlModel.query).toHaveBeenCalledWith(
      context,
      expect.stringContaining('p.modified = ? AND p.id > ?'),
      ['2026-04-01 12:00:00.000', '2026-04-01 12:00:00.000',
        '2026-04-01 12:00:00.000', '15', '25'],
      'fetch',
    );
  });

  it('marks the job as failed and stops when an item cannot be synchronized', async () => {
    const job = new TestSyncJob();
    job.batches = [[item]];
    job.syncResult = false;
    jest.spyOn(MySqlModel, 'query').mockResolvedValue([{ affectedRows: 1 }]);
    jest.spyOn(MySqlModel, 'update').mockResolvedValue(new MySqlModel());

    await expect(job.start('test', context)).rejects.toThrow(
      `Failed to synchronize item: ${item.plan_id}`,
    );

    expect(job.status).toBe(DataSyncJobStatus.FAILED);
    expect(job.failureCount).toBe(1);
  });

  it('does not execute when another worker holds the lock', async () => {
    const job = new TestSyncJob();
    jest.spyOn(MySqlModel, 'query').mockResolvedValue([{ affectedRows: 0 }]);

    await expect(job.start('test', context)).rejects.toThrow(
      'Data sync job "TestSyncJob" is already locked for execution.',
    );
  });

  it('updates OpenSearch with the stripped DMP ID', async () => {
    const openSearch = {
      updateIndexItem: jest.fn<() => Promise<void>>().mockResolvedValue(undefined),
    };
    const openSearchContext = {
      ...context,
      dataSources: {
        openSearchServerlessDataSource: openSearch,
      },
    } as unknown as MyContext;
    const job = new OpenSearchDMPSync();

    await expect(job.performSync('test', openSearchContext, item)).resolves.toBe(true);

    expect(openSearch.updateIndexItem).toHaveBeenCalledWith(
      'dmp',
      expect.any(Object),
      '10.1234/example',
      item,
    );
  });

  it('returns false when OpenSearch rejects an item', async () => {
    const openSearch = {
      updateIndexItem: jest.fn<() => Promise<void>>()
        .mockRejectedValue(new Error('OpenSearch unavailable')),
    };
    const openSearchContext = {
      ...context,
      dataSources: {
        openSearchServerlessDataSource: openSearch,
      },
    } as unknown as MyContext;
    const job = new OpenSearchDMPSync();

    await expect(job.performSync('test', openSearchContext, item)).resolves.toBe(false);
  });
});
