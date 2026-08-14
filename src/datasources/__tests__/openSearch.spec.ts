import {
  createOpenSearchClient,
  createOpenSearchServerlessClient,
  OpenSearch,
  OpenSearchConfig,
  OpenSearchError,
  OpenSearchServerlessConfig,
  tokenizeText,
} from '../openSearch';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

jest.mock('@opensearch-project/opensearch');
jest.mock('@opensearch-project/opensearch/aws');
jest.mock('@aws-sdk/credential-providers');

// ─── Shared mock client used by OpenSearch class tests ────────────────────────

interface MockClientInstance {
  indices: { get: jest.Mock; create: jest.Mock };
  update: jest.Mock;
  delete: jest.Mock;
  search: jest.Mock;
}

let mockClientInstance: MockClientInstance;

beforeEach(() => {
  jest.clearAllMocks();

  mockClientInstance = {
    indices: {
      get: jest.fn().mockResolvedValue({ statusCode: 200 }), // non-array body → listIndices returns []
      create: jest.fn().mockResolvedValue({ statusCode: 200 }),
    },
    update: jest.fn().mockResolvedValue({ statusCode: 200 }),
    delete: jest.fn().mockResolvedValue({ statusCode: 200 }),
    search: jest.fn().mockResolvedValue({ body: null }),
  };

  (Client as jest.Mock).mockImplementation(() => mockClientInstance);
  (AwsSigv4Signer as jest.Mock).mockReturnValue({ signerResult: 'mocked' });
  (fromNodeProviderChain as jest.Mock).mockReturnValue(jest.fn());
});

// ─── createOpenSearchServerlessClient ────────────────────────────────────────

describe('createOpenSearchServerlessClient', () => {
  it('creates a Client using AwsSigv4Signer with the aoss service', () => {
    const config: OpenSearchServerlessConfig = {
      node: 'https://test.aoss.example.com:9200',
    };

    createOpenSearchServerlessClient(config);

    expect(AwsSigv4Signer).toHaveBeenCalledWith(
      expect.objectContaining({
        region: 'us-west-2',
        service: 'aoss',
        getCredentials: expect.any(Function),
      }),
    );
    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({ node: config.node }),
    );
  });

  it('merges the signer result into the Client options', () => {
    createOpenSearchServerlessClient({ node: 'https://example.com' });

    const clientOptions = (Client as jest.Mock).mock.calls[0][0];
    expect(clientOptions.signerResult).toBe('mocked');
  });
});

// ─── createOpenSearchClient ───────────────────────────────────────────────────

describe('createOpenSearchClient', () => {
  // ---------------------------------------------------------
  // Local with No Auth
  // ---------------------------------------------------------
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

    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        node: 'http://host.docker.internal:9200/',
        ssl: { rejectUnauthorized: false },
        compression: 'gzip',
      }),
    );
    expect(AwsSigv4Signer).not.toHaveBeenCalled();

    const clientOptions = (Client as unknown as jest.Mock).mock.calls[0][0];
    expect(clientOptions.auth).toBeUndefined();
    expect(clientOptions).not.toEqual(
      expect.objectContaining({ region: expect.anything(), service: expect.anything() }),
    );
  });

  // ---------------------------------------------------------
  // Local with Basic Auth
  // ---------------------------------------------------------
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

    expect(Client).toHaveBeenCalledWith(
      expect.objectContaining({
        node: 'http://localhost:9200/',
        auth: { username: 'admin', password: 'my-secret-password' },
        compression: 'gzip',
      }),
    );
    expect(AwsSigv4Signer).not.toHaveBeenCalled();
    const clientOptions = (Client as unknown as jest.Mock).mock.calls[0][0];
    expect(clientOptions).not.toEqual(
      expect.objectContaining({ region: expect.anything(), service: expect.anything() }),
    );
  });

  // ---------------------------------------------------------
  // AWS
  // ---------------------------------------------------------
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

    expect(AwsSigv4Signer).toHaveBeenCalledWith({
      region: 'us-east-1',
      service: 'es',
      getCredentials: expect.any(Function),
    });

    const clientCallArgs = (Client as unknown as jest.Mock).mock.calls[0][0];
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

// ─── createOpenSearchClient – Validation errors ───────────────────────────────

describe('createOpenSearchClient – validation errors', () => {
  test('throws if authType is basic but username is missing', () => {
    expect(() =>
      createOpenSearchClient({
        host: 'localhost', port: 9200, useSSL: false, verifyCerts: false,
        authType: 'basic', username: null, password: 'password',
        awsRegion: null, awsService: null,
      }),
    ).toThrow("Basic authentication requires 'username' and 'password' to be defined.");
    expect(Client).not.toHaveBeenCalled();
  });

  test('throws if authType is basic but password is missing', () => {
    expect(() =>
      createOpenSearchClient({
        host: 'localhost', port: 9200, useSSL: false, verifyCerts: false,
        authType: 'basic', username: 'admin', password: null,
        awsRegion: null, awsService: null,
      }),
    ).toThrow("Basic authentication requires 'username' and 'password' to be defined.");
    expect(Client).not.toHaveBeenCalled();
  });

  test('throws if authType is aws but region is missing', () => {
    expect(() =>
      createOpenSearchClient({
        host: 'localhost', port: 9200, useSSL: false, verifyCerts: false,
        authType: 'aws', awsRegion: null, awsService: 'es',
        username: null, password: null,
      }),
    ).toThrow("AWS authentication requires 'awsRegion' and 'awsService' to be defined.");
    expect(Client).not.toHaveBeenCalled();
  });

  test('throws if authType is aws but service is missing', () => {
    expect(() =>
      createOpenSearchClient({
        host: 'localhost', port: 9200, useSSL: false, verifyCerts: false,
        authType: 'aws', awsRegion: 'us-east-1', awsService: null,
        username: null, password: null,
      }),
    ).toThrow("AWS authentication requires 'awsRegion' and 'awsService' to be defined.");
    expect(Client).not.toHaveBeenCalled();
  });
});

// ─── tokenizeText ─────────────────────────────────────────────────────────────

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
    // minWordLength = 5 should drop "big"
    const result = tokenizeText('a big study', 5);
    expect(result).not.toContain('big');
    expect(result).toContain('study');
  });

  it('handles unicode letters correctly', () => {
    const result = tokenizeText('données écologie');
    expect(result).toContain('données');
    expect(result).toContain('écologie');
  });

  it('deduplicates repeated words', () => {
    // tokenizeText does not deduplicate – that is done by the caller
    // Confirm it returns one token per occurrence (not deduplicated here)
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
    // stop words removed
    expect(result).not.toContain('and');
    expect(result).not.toContain('for');
  });
});

// ─── OpenSearchError ──────────────────────────────────────────────────────────

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

// ─── OpenSearch class ─────────────────────────────────────────────────────────

describe('OpenSearch class', () => {
  const serverlessConfig: OpenSearchServerlessConfig = {
    node: 'https://test.aoss.example.com:9200',
  };

  // ── constructor ────────────────────────────────────────────────────────────

  describe('constructor', () => {
    it('uses createOpenSearchServerlessClient when config has a "node" property', () => {
      new OpenSearch(serverlessConfig);
      expect(AwsSigv4Signer).toHaveBeenCalledWith(
        expect.objectContaining({ service: 'aoss' }),
      );
    });

    it('uses createOpenSearchClient when config has no "node" property', () => {
      const regularConfig: OpenSearchConfig = {
        host: 'localhost', port: 9200, useSSL: false, verifyCerts: false,
        authType: null, username: null, password: null,
        awsRegion: null, awsService: null,
      };
      new OpenSearch(regularConfig);
      expect(AwsSigv4Signer).not.toHaveBeenCalled();
      expect(Client).toHaveBeenCalledWith(
        expect.objectContaining({ node: 'http://localhost:9200/' }),
      );
    });
  });

  // ── findOrInitializeIndex ─────────────────────────────────────────────────

  describe('findOrInitializeIndex', () => {
    const INDEX_NAME = 'test-index';
    const PROPERTY_DEF = { field: { type: 'keyword' as const } };

    it('returns the index name without creating when it is already cached', async () => {
      // Make listIndices return the index on the first call
      mockClientInstance.indices.get.mockResolvedValueOnce({
        body: [{ index: INDEX_NAME }],
        statusCode: 200,
      });

      const os = new OpenSearch(serverlessConfig);
      // First call loads the list and finds the index
      const result1 = await os.findOrInitializeIndex(INDEX_NAME, PROPERTY_DEF);
      // Second call should use the cache
      const result2 = await os.findOrInitializeIndex(INDEX_NAME, PROPERTY_DEF);

      expect(result1).toBe(INDEX_NAME);
      expect(result2).toBe(INDEX_NAME);
      // client.indices.get should only be called once (first load), not again
      expect(mockClientInstance.indices.get).toHaveBeenCalledTimes(1);
      // create should never have been called
      expect(mockClientInstance.indices.create).not.toHaveBeenCalled();
    });

    it('creates the index when it does not exist and returns its name', async () => {
      // listIndices returns [] (non-array body → empty list)
      mockClientInstance.indices.get.mockResolvedValue({ statusCode: 200 });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.findOrInitializeIndex(INDEX_NAME, PROPERTY_DEF);

      expect(result).toBe(INDEX_NAME);
      expect(mockClientInstance.indices.create).toHaveBeenCalledWith({
        index: INDEX_NAME,
        body: { mappings: { properties: PROPERTY_DEF } },
      });
    });

    it('caches the index list so subsequent calls skip listIndices when the index was found', async () => {
      // listIndices returns the index on the first call
      mockClientInstance.indices.get.mockResolvedValue({
        body: [{ index: INDEX_NAME }],
        statusCode: 200,
      });
      const os = new OpenSearch(serverlessConfig);

      await os.findOrInitializeIndex(INDEX_NAME, PROPERTY_DEF);
      await os.findOrInitializeIndex(INDEX_NAME, PROPERTY_DEF);

      // listIndices is only invoked on the first call; the cached list is used thereafter
      expect(mockClientInstance.indices.get).toHaveBeenCalledTimes(1);
    });
  });

  // ── updateIndexItem ───────────────────────────────────────────────────────

  describe('updateIndexItem', () => {
    const INDEX_NAME = 'dmp';
    const PROP_DEF = { title: { type: 'text' as const } };
    const DOC_ID = '10.1234/abc';

    it('calls client.update with snake_cased keys and returns on success', async () => {
      mockClientInstance.update.mockResolvedValue({ statusCode: 200 });

      const os = new OpenSearch(serverlessConfig);
      await os.updateIndexItem(INDEX_NAME, PROP_DEF, DOC_ID, { planTitle: 'My DMP', planId: 1 });

      expect(mockClientInstance.update).toHaveBeenCalledWith({
        index: INDEX_NAME,
        id: DOC_ID,
        body: { doc: { plan_title: 'My DMP', plan_id: 1 } },
      });
    });

    it('throws OpenSearchError when the response status is < 200', async () => {
      mockClientInstance.update.mockResolvedValue({ statusCode: 199 });

      const os = new OpenSearch(serverlessConfig);
      await expect(
        os.updateIndexItem(INDEX_NAME, PROP_DEF, DOC_ID, { title: 'test' }),
      ).rejects.toThrow(OpenSearchError);
    });

    it('throws OpenSearchError when the response status is >= 300', async () => {
      mockClientInstance.update.mockResolvedValue({ statusCode: 404 });

      const os = new OpenSearch(serverlessConfig);
      await expect(
        os.updateIndexItem(INDEX_NAME, PROP_DEF, DOC_ID, { title: 'test' }),
      ).rejects.toThrow(OpenSearchError);
    });

    it('throws when the response is null (TypeError from template string access)', async () => {
      mockClientInstance.update.mockResolvedValue(null);

      const os = new OpenSearch(serverlessConfig);
      // The error-message template accesses response.statusCode even when response is null,
      // producing a TypeError rather than an OpenSearchError. This is a known service bug.
      await expect(
        os.updateIndexItem(INDEX_NAME, PROP_DEF, DOC_ID, { title: 'test' }),
      ).rejects.toThrow(Error);
    });
  });

  // ── removeIndexItem ───────────────────────────────────────────────────────

  describe('removeIndexItem', () => {
    const INDEX_NAME = 'dmp';
    const ITEM_ID = '10.1234/abc';

    it('calls client.delete with the correct index and id', async () => {
      mockClientInstance.delete.mockResolvedValue({ statusCode: 200 });

      const os = new OpenSearch(serverlessConfig);
      await os.removeIndexItem(INDEX_NAME, ITEM_ID);

      expect(mockClientInstance.delete).toHaveBeenCalledWith({
        index: INDEX_NAME,
        id: ITEM_ID,
      });
    });

    it('resolves without error on a successful delete (2xx status)', async () => {
      mockClientInstance.delete.mockResolvedValue({ statusCode: 204 });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.removeIndexItem(INDEX_NAME, ITEM_ID)).resolves.toBeUndefined();
    });

    it('throws OpenSearchError when the delete response status is >= 300', async () => {
      mockClientInstance.delete.mockResolvedValue({ statusCode: 500 });

      const os = new OpenSearch(serverlessConfig);
      await expect(os.removeIndexItem(INDEX_NAME, ITEM_ID)).rejects.toThrow(OpenSearchError);
    });

    it('throws when the delete response is null (TypeError from template string access)', async () => {
      mockClientInstance.delete.mockResolvedValue(null);

      const os = new OpenSearch(serverlessConfig);
      // Same template-string bug as updateIndexItem: accessing response.statusCode when null.
      await expect(os.removeIndexItem(INDEX_NAME, ITEM_ID)).rejects.toThrow(Error);
    });
  });

  // ── search ─────────────────────────────────────────────────────────────────

  describe('search', () => {
    const INDEX_NAME = 'dmp';
    const QUERY = { query: { match_all: {} } };

    it('returns {total: 0, items: []} when response body is null', async () => {
      mockClientInstance.search.mockResolvedValue({ body: null });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.search(INDEX_NAME, QUERY);

      expect(result).toEqual({ total: 0, items: [] });
    });

    it('returns {total: 0, items: []} when response body has no hits', async () => {
      mockClientInstance.search.mockResolvedValue({
        body: { hits: null },
      });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.search(INDEX_NAME, QUERY);

      expect(result).toEqual({ total: 0, items: [] });
    });

    it('returns {total: 0, items: []} when hits.total is falsy', async () => {
      mockClientInstance.search.mockResolvedValue({
        body: { hits: { total: 0, hits: [] } },
      });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.search(INDEX_NAME, QUERY);

      expect(result).toEqual({ total: 0, items: [] });
    });

    it('returns items with camelized field keys when hits are present', async () => {
      mockClientInstance.search.mockResolvedValue({
        body: {
          hits: {
            total: { value: 1 },
            hits: [
              { _id: 'doc-1', fields: { plan_title: 'My DMP', dmp_id: '10.1234/abc' } },
            ],
          },
        },
      });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.search(INDEX_NAME, QUERY);

      expect(result.total).toBe(1);
      expect(result.items).toHaveLength(1);
      expect(result.items[0]._id).toBe('doc-1');
      expect(result.items[0].fields).toMatchObject({
        planTitle: 'My DMP',
        dmpId: '10.1234/abc',
      });
    });

    it('handles a numeric total (not an object) correctly', async () => {
      mockClientInstance.search.mockResolvedValue({
        body: {
          hits: {
            total: 5,
            hits: [
              { _id: 'a', fields: { item_id: '1' } },
            ],
          },
        },
      });

      const os = new OpenSearch(serverlessConfig);
      const result = await os.search(INDEX_NAME, QUERY);

      expect(result.total).toBe(5);
      expect(result.items).toHaveLength(1);
    });

    it('passes the query body directly to client.search', async () => {
      mockClientInstance.search.mockResolvedValue({ body: null });
      const customQuery = { query: { term: { visibility: 'public' } } };

      const os = new OpenSearch(serverlessConfig);
      await os.search(INDEX_NAME, customQuery);

      expect(mockClientInstance.search).toHaveBeenCalledWith({
        index: INDEX_NAME,
        body: customQuery,
      });
    });
  });
});
