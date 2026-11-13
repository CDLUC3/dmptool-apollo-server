import { jest } from '@jest/globals';

const mockValidateConnection = jest.fn<() => Promise<void>>();
const mockClose = jest.fn<() => Promise<void>>();
const mockMySqlConnection = jest.fn(() => ({
  validateConnection: mockValidateConnection,
  close: mockClose,
}));
const mockOpenSearch = jest.fn();
const mockStart = jest.fn<() => Promise<void>>();
const mockOpenSearchDmpSync = jest.fn(() => ({ start: mockStart }));
const mockBuildContext = jest.fn();

jest.unstable_mockModule('keyv', () => ({
  default: jest.fn(),
}));
jest.unstable_mockModule('@apollo/utils.keyvadapter', () => ({
  KeyvAdapter: jest.fn(),
}));
jest.unstable_mockModule('../../config/awsConfig.js', () => ({
  awsConfig: { opensearchServerless: { node: 'http://localhost:9200' } },
}));
jest.unstable_mockModule('../../context.js', () => ({
  buildContext: mockBuildContext,
}));
jest.unstable_mockModule('../../datasources/mysql.js', () => ({
  MySQLConnection: mockMySqlConnection,
}));
jest.unstable_mockModule('../../datasources/openSearch.js', () => ({
  OpenSearch: mockOpenSearch,
}));
jest.unstable_mockModule('../../logger.js', () => ({
  logger: { error: jest.fn() },
}));
jest.unstable_mockModule('../../models/DataSyncJob.js', () => ({
  OpenSearchDMPSync: mockOpenSearchDmpSync,
}));

const { runOpenSearchDmpSync } = await import('../syncOpenSearchDmps.js');

describe('runOpenSearchDmpSync', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockValidateConnection.mockResolvedValue(undefined);
    mockClose.mockResolvedValue(undefined);
    mockStart.mockResolvedValue(undefined);
  });

  it('runs the OpenSearch DMP synchronization with a validated context', async () => {
    const context = { requestId: 'cli-request' };
    mockBuildContext.mockReturnValue(context);

    await runOpenSearchDmpSync();

    expect(mockValidateConnection).toHaveBeenCalledTimes(1);
    expect(mockBuildContext).toHaveBeenCalledWith(
      expect.any(Object),
      expect.any(Object),
      null,
      expect.objectContaining({
        validateConnection: mockValidateConnection,
      }),
      null,
      null,
      expect.any(Object),
    );
    expect(mockStart).toHaveBeenCalledWith('cli-open-search-dmp-sync', context);
    expect(mockClose).toHaveBeenCalledTimes(1);
  });

  it('closes the MySQL connection when synchronization fails', async () => {
    mockBuildContext.mockReturnValue({});
    mockStart.mockRejectedValueOnce(new Error('OpenSearch unavailable'));

    await expect(runOpenSearchDmpSync()).rejects.toThrow('OpenSearch unavailable');

    expect(mockClose).toHaveBeenCalledTimes(1);
  });
});
