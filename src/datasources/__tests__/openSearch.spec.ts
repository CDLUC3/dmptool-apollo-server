/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

import type { OpenSearchConfig, OpenSearchServerlessConfig } from '../openSearch.js';

// ---------------------------------------------------------------------------
// Client / AwsSigv4Signer / fromNodeProviderChain need to be actual jest.fn()
// mocks, not just the real SDK spread through unchanged — this file tests
// openSearch.js itself (the module that DEFINES createOpenSearchClient /
// createOpenSearchServerlessClient), so it's these lower-level SDK
// primitives that need controlling, not the higher-level functions built on
// top of them.
// ---------------------------------------------------------------------------
const mockClientCtor = jest.fn<(...args: any[]) => any>();
const actualOpenSearch = await import('@opensearch-project/opensearch');
jest.unstable_mockModule('@opensearch-project/opensearch', () => ({
  ...actualOpenSearch,
  Client: mockClientCtor,
}));

const mockAwsSigv4Signer = jest.fn<(...args: any[]) => any>();
const actualOpenSearchAWS = await import('@opensearch-project/opensearch/aws');
jest.unstable_mockModule('@opensearch-project/opensearch/aws', () => ({
  ...actualOpenSearchAWS,
  AwsSigv4Signer: mockAwsSigv4Signer,
}));

const mockFromNodeProviderChain = jest.fn<(...args: any[]) => any>();
const actualAWSCredentialProviders = await import('@aws-sdk/credential-providers');
jest.unstable_mockModule('@aws-sdk/credential-providers', () => ({
  ...actualAWSCredentialProviders,
  fromNodeProviderChain: mockFromNodeProviderChain,
}));

const {
  createOpenSearchClient,
  createOpenSearchServerlessClient,
  OpenSearch,
  OpenSearchError,
  tokenizeText,
} = await import('../openSearch.js');


interface MockClientInstance {
  indices: {
    get: jest.Mock<(...args: any[]) => Promise<any>>;
    create: jest.Mock<(...args: any[]) => Promise<any>>;
  };
  index: jest.Mock<(...args: any[]) => Promise<any>>;
  get: jest.Mock<(...args: any[]) => Promise<any>>;
  delete: jest.Mock<(...args: any[]) => Promise<any>>;
  search: jest.Mock<(...args: any[]) => Promise<any>>;
}

let mockClientInstance: MockClientInstance;
const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

beforeEach(() => {
  jest.clearAllMocks();
  process.env.NODE_ENV = 'test';

  mockClientInstance = {
    indices: {
      get: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ body: { 'demo-index': {} }, statusCode: 200 }),
      create: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ statusCode: 200 }),
    },
    index: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ statusCode: 200 }),
    get: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ body: { _source: { title: 'Example' } }, statusCode: 200 }),
    delete: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ statusCode: 200 }),
    search: jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue({ body: null }),
  };

  mockClientCtor.mockImplementation(() => mockClientInstance);
  mockAwsSigv4Signer.mockReturnValue({ signerResult: 'mocked' });
  mockFromNodeProviderChain.mockReturnValue(jest.fn());
});

afterAll(() => {
  if (ORIGINAL_NODE_ENV === undefined) {
    delete process.env.NODE_ENV;
  } else {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  }
});

describe('createOpenSearchServerlessClient', () => {
  it('uses the test/dev host override without AWS signer when NODE_ENV is set', () => {
    const config: OpenSearchServerlessConfig = {
      node: 'https://test.aoss.example.com:9200',
    };

    createOpenSearchServerlessClient(config);

    expect(mockAwsSigv4Signer).not.toHaveBeenCalled();
    expect(mockClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        node: config.node,
      }),
    );
  });

  it('uses AwsSigv4Signer in production mode', () => {
    process.env.NODE_ENV = 'production';

    createOpenSearchServerlessClient({ node: 'https://example.com:9200' });

    expect(mockAwsSigv4Signer).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-west-2',
        service: 'aoss',
        getCredentials: expect.any(Function),
      }),
    );
    expect(mockClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        node: 'https://example.com:9200',
        signerResult: 'mocked',
      }),
    );
  });
});

describe('createOpenSearchClient', () => {
  test('Local with No Auth (HTTP)', () => {
    const localNoAuthConfig: OpenSearchConfig = {
      host: 'host.docker.internal',
      port: 9200,
      useSSL: false,
      verifyCerts: false,
      authType: null,
      username: null,
      password: null,
      awsRegion: null,
      awsService: null,
    };

    createOpenSearchClient(localNoAuthConfig);

    expect(mockClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        node: 'http://host.docker.internal:9200/',
        ssl: { rejectUnauthorized: false },
        compression: 'gzip',
      }),
    );
    expect(mockAwsSigv4Signer).not.toHaveBeenCalled();
    const clientOptions = mockClientCtor.mock.calls[0][0];
    expect(clientOptions.auth).toBeUndefined();
  });

  test('Local with Basic Auth (Username/Password)', () => {
    const basicAuthConfig: OpenSearchConfig = {
      host: 'localhost',
      port: 9200,
      useSSL: false,
      verifyCerts: false,
      authType: 'basic',
      username: 'admin',
      password: 'my-secret-password',
      awsRegion: null,
      awsService: null,
    };

    createOpenSearchClient(basicAuthConfig);

    expect(mockClientCtor).toHaveBeenCalledWith(
      expect.objectContaining({
        node: 'http://localhost:9200/',
        auth: { username: 'admin', password: 'my-secret-password' },
        compression: 'gzip',
      }),
    );
    expect(mockAwsSigv4Signer).not.toHaveBeenCalled();
  });

  test('AWS (AwsSigv4Signer, HTTPS)', () => {
    const awsConfig: OpenSearchConfig = {
      host: 'my-domain.us-west-2.es.amazonaws.com',
      port: 443,
      useSSL: true,
      verifyCerts: true,
      authType: 'aws',
      awsRegion: 'us-east-1',
      awsService: 'es',
      username: 'should-be-ignored',
      password: 'should-be-ignored',
    };

    createOpenSearchClient(awsConfig);

    expect(mockAwsSigv4Signer).toHaveBeenCalledWith({
      region: 'us-east-1',
      service: 'es',
      getCredentials: expect.any(Function),
    });

    const clientCallArgs = mockClientCtor.mock.calls[0][0];
    expect(clientCallArgs).toEqual(
      expect.objectContaining({
        node: 'https://my-domain.us-west-2.es.amazonaws.com/',
        ssl: { rejectUnauthorized: true },
        compression: 'gzip',
        signerResult: 'mocked',
      }),
    );
    expect(clientCallArgs.auth).toBeUndefined();
  });
});

describe('createOpenSearchClient – validation errors', () => {
  test('throws if authType is basic but username is missing', () => {
    expect(() =>
      createOpenSearchClient({
        host: 'localhost',
        port: 9200,
        useSSL: false,
        verifyCerts: false,
        authType: 'basic',
        username: null,
        password: 'password',
        awsRegion: null,
        awsService: null,
      }),
    ).toThrow("Basic authentication requires 'username' and 'password' to be defined.");
    expect(mockClientCtor).not.toHaveBeenCalled();
  });

  test('throws if authType is basic but password is missing', () => {
    expect(() =>
      createOpenSearchClient({
        host: 'localhost',
        port: 9200,
        useSSL: false,
        verifyCerts: false,
        authType: 'basic',
        username: 'admin',
        password: null,
        awsRegion: null,
        awsService: null,
      }),
    ).toThrow("Basic authentication requires 'username' and 'password' to be defined.");
    expect(mockClientCtor).not.toHaveBeenCalled();
  });

  test('throws if authType is aws but region is missing', () => {
    expect(() =>
      createOpenSearchClient({
        host: 'localhost',
        port: 9200,
        useSSL: false,
        verifyCerts: false,
        authType: 'aws',
        awsRegion: null,
        awsService: 'es',
        username: null,
        password: null,
      }),
    ).toThrow("AWS authentication requires 'awsRegion' and 'awsService' to be defined.");
    expect(mockClientCtor).not.toHaveBeenCalled();
  });

  test('throws if authType is aws but service is missing', () => {
    expect(() =>
      createOpenSearchClient({
        host: 'localhost',
        port: 9200,
        useSSL: false,
        verifyCerts: false,
        authType: 'aws',
        awsRegion: 'us-east-1',
        awsService: null,
        username: null,
        password: null,
      }),
    ).toThrow("AWS authentication requires 'awsRegion' and 'awsService' to be defined.");
    expect(mockClientCtor).not.toHaveBeenCalled();
  });
});

describe('tokenizeText', () => {
  it('returns an empty array for null input', () => {
    expect(tokenizeText(null)).toEqual([]);
  });

  it('returns an empty array for undefined input', () => {
    expect(tokenizeText(undefined)).toEqual([]);
  });

  it('returns an empty array for an empty string', () => {
    expect(tokenizeText('')).toEqual([]);
  });

  it('lowercases and splits words', () => {
    const result = tokenizeText('Climate Change');
    expect(result).toContain('climate');
    expect(result).toContain('change');
  });

  it('strips punctuation from words', () => {
    const result = tokenizeText('data-management, planning!');
    expect(result).toContain('datamanagement');
    expect(result).toContain('planning');
  });

  it('removes stop words', () => {
    const result = tokenizeText('the impact of the ocean');
    expect(result).not.toContain('the');
    expect(result).not.toContain('of');
    expect(result).toContain('impact');
    expect(result).toContain('ocean');
  });

  it('filters words shorter than the default minimum length of 2', () => {
    const result = tokenizeText('a big study');
    expect(result).not.toContain('a');
    expect(result).toContain('big');
    expect(result).toContain('study');
  });

  it('respects a custom minWordLength argument', () => {
    const result = tokenizeText('a big study', 5);
    expect(result).not.toContain('big');
    expect(result).toContain('study');
  });

  it('handles unicode letters correctly', () => {
    const result = tokenizeText('données écologie');
    expect(result).toContain('données');
    expect(result).toContain('écologie');
  });

  it('returns one token per occurrence rather than deduplicating', () => {
    const result = tokenizeText('ocean ocean data');
    expect(result.filter((t) => t === 'ocean').length).toBe(2);
  });

  it('returns only meaningful tokens for a realistic title', () => {
    const result = tokenizeText('Data Management and Sharing Plan for Genomics Research');
    expect(result).toContain('data');
    expect(result).toContain('management');
    expect(result).toContain('sharing');
    expect(result).toContain('plan');
    expect(result).toContain('genomics');
    expect(result).toContain('research');
    expect(result).not.toContain('and');
    expect(result).not.toContain('for');
  });
});

describe('OpenSearchError', () => {
  it('is an instance of Error', () => {
    const err = new OpenSearchError('something went wrong');
    expect(err).toBeInstanceOf(Error);
  });

  it('has the name "OpenSearchError"', () => {
    const err = new OpenSearchError('test');
    expect(err.name).toBe('OpenSearchError');
  });

  it('carries the provided message', () => {
    const err = new OpenSearchError('index not found');
    expect(err.message).toBe('index not found');
  });
});

describe('OpenSearch class', () => {
  const serverlessConfig: OpenSearchServerlessConfig = {
    node: 'https://test.aoss.example.com:9200',
  };

  describe('constructor', () => {
    it('uses createOpenSearchServerlessClient when config has a "node" property', () => {
      new OpenSearch(serverlessConfig);
      expect(mockClientCtor).toHaveBeenCalledWith(
        expect.objectContaining({
          node: serverlessConfig.node,
        }),
      );
    });

    it('uses createOpenSearchClient when config has no "node" property', () => {
      const regularConfig: OpenSearchConfig = {
        host: 'localhost',
        port: 9200,
        useSSL: false,
        verifyCerts: false,
        authType: null,
        username: null,
        password: null,
        awsRegion: null,
        awsService: null,
      };

      new OpenSearch(regularConfig);
      expect(mockClientCtor).toHaveBeenCalledWith(
        expect.objectContaining({ node: 'http://localhost:9200/' }),
      );
    });
  });

  describe('findOrInitializeIndex', () => {
    const INDEX_NAME = 'test-index';
    const PROPERTY_DEF = { field: { type: 'keyword' as const } };

    it('returns the cached index name without creating a new index', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({
        body: { [INDEX_NAME]: {} },
        statusCode: 200,
      });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.findOrInitializeIndex(INDEX_NAME, PROPERTY_DEF);

      expect(result).toBe(INDEX_NAME);
      expect(mockClientInstance.indices.create).not.toHaveBeenCalled();
    });

    it('creates the index when it does not exist', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: {}, statusCode: 200 });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.findOrInitializeIndex(INDEX_NAME, PROPERTY_DEF);

      expect(result).toBe(INDEX_NAME);
      expect(mockClientInstance.indices.create).toHaveBeenCalledWith({
        index: INDEX_NAME,
        body: { mappings: { properties: PROPERTY_DEF } },
      });
    });

    it('falls back to an empty list when the index metadata is malformed', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ statusCode: 200 });
      jest.spyOn(console, 'warn').mockImplementation(() => undefined);

      const os = new OpenSearch(serverlessConfig);
      await expect(os.findOrInitializeIndex(INDEX_NAME, PROPERTY_DEF)).resolves.toBe(INDEX_NAME);
      expect(mockClientInstance.indices.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('getIndexItem', () => {
    const INDEX_NAME = 'dmp';
    const DOC_ID = '10.1234/abc';

    it('returns the item source when the document exists', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.get.mockResolvedValueOnce({ body: { _source: { title: 'My DMP' } } });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.getIndexItem(INDEX_NAME, DOC_ID);

      expect(result).toEqual({ title: 'My DMP' });
    });

    it('returns undefined for a 404 response', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.get.mockRejectedValueOnce({ meta: { statusCode: 404 }, message: 'not found' });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.getIndexItem(INDEX_NAME, DOC_ID)).resolves.toBeUndefined();
    });

    it('throws OpenSearchError on non-404 failures', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.get.mockRejectedValueOnce({ meta: { statusCode: 500 }, message: 'boom' });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.getIndexItem(INDEX_NAME, DOC_ID)).rejects.toThrow(OpenSearchError);
    });
  });

  describe('updateIndexItem', () => {
    const INDEX_NAME = 'dmp';
    const PROP_DEF = { title: { type: 'text' as const } };
    const DOC_ID = '10.1234/abc';

    it('writes the item with snake_case keys', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });

      const os = new OpenSearch(serverlessConfig);
      await os.updateIndexItem(INDEX_NAME, PROP_DEF, DOC_ID, { planTitle: 'My DMP', planId: 1 });

      expect(mockClientInstance.index).toHaveBeenCalledWith({
        index: INDEX_NAME,
        id: DOC_ID,
        body: { plan_title: 'My DMP', plan_id: 1 },
      });
    });

    it('returns without throwing on a 404 during update', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.index.mockRejectedValueOnce({ meta: { statusCode: 404 }, message: 'missing' });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.updateIndexItem(INDEX_NAME, PROP_DEF, DOC_ID, { title: 'test' })).resolves.toBeUndefined();
    });

    it('throws OpenSearchError on generic update failures', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.index.mockRejectedValueOnce({ meta: { statusCode: 500 }, message: 'boom' });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.updateIndexItem(INDEX_NAME, PROP_DEF, DOC_ID, { title: 'test' })).rejects.toThrow(OpenSearchError);
    });
  });

  describe('removeIndexItem', () => {
    const INDEX_NAME = 'dmp';
    const ITEM_ID = '10.1234/abc';

    it('skips delete when listIndices resolves to a falsy value', async () => {
      const os = new OpenSearch(serverlessConfig);
      (os as any).listIndices = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue(undefined);

      await expect(os.removeIndexItem(INDEX_NAME, ITEM_ID)).resolves.toBeUndefined();
      expect(mockClientInstance.delete).not.toHaveBeenCalled();
    });

    it('returns without throwing on a 404 during delete', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.delete.mockRejectedValueOnce({ meta: { statusCode: 404 }, message: 'not found' });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.removeIndexItem(INDEX_NAME, ITEM_ID)).resolves.toBeUndefined();
    });

    it('throws OpenSearchError on generic delete failures', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.delete.mockRejectedValueOnce({ meta: { statusCode: 500 }, message: 'boom' });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.removeIndexItem(INDEX_NAME, ITEM_ID)).rejects.toThrow(OpenSearchError);
    });
  });

  describe('search', () => {
    const INDEX_NAME = 'dmp';
    const QUERY = { query: { match_all: {} } };

    it('throws when listIndices resolves to a falsy value', async () => {
      const os = new OpenSearch(serverlessConfig);
      (os as any).listIndices = jest.fn<(...args: any[]) => Promise<any>>().mockResolvedValue([]);

      await expect(os.search(INDEX_NAME, QUERY)).rejects.toThrow('Search: No index found!');
    });

    it('returns an empty result set when no hits are present', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.search.mockResolvedValueOnce({ body: { hits: { total: 0, hits: [] } } });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.search(INDEX_NAME, QUERY);

      expect(result).toEqual({ total: 0, items: [] });
    });

    it('camelizes hit fields and totals the results', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.search.mockResolvedValueOnce({
        body: {
          hits: {
            total: { value: 2 },
            hits: [
              { _id: 'doc-1', fields: { plan_title: 'My DMP' } },
              { _id: 'doc-2', fields: { plan_title: 'Another DMP' } },
            ],
          },
        },
      });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.search(INDEX_NAME, QUERY);

      expect(result.total).toBe(2);
      expect(result.items).toEqual([
        { _id: 'doc-1', fields: { planTitle: 'My DMP' } },
        { _id: 'doc-2', fields: { planTitle: 'Another DMP' } },
      ]);
    });

    it('returns an empty array for a 404 during search', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.search.mockRejectedValueOnce({ meta: { statusCode: 404 }, message: 'not found' });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.search(INDEX_NAME, QUERY)).resolves.toEqual({ total: 0, items: [] });
    });

    it('throws OpenSearchError on generic search failures', async () => {
      mockClientInstance.indices.get.mockResolvedValueOnce({ body: { [INDEX_NAME]: {} }, statusCode: 200 });
      mockClientInstance.search.mockRejectedValueOnce({ meta: { statusCode: 500 }, message: 'boom' });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.search(INDEX_NAME, QUERY)).rejects.toThrow(OpenSearchError);
    });
  });
});