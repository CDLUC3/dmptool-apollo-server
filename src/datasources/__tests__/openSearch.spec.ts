import { createOpenSearchClient, OpenSearchConfig } from '../openSearch';
import { Client } from '@opensearch-project/opensearch';
import { AwsSigv4Signer } from '@opensearch-project/opensearch/aws';
import { fromNodeProviderChain } from '@aws-sdk/credential-providers';

jest.mock('@opensearch-project/opensearch');
jest.mock('@opensearch-project/opensearch/aws');
jest.mock('@aws-sdk/credential-providers');

describe('createOpenSearchClient', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

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
        ssl: {
          rejectUnauthorized: false,
        },
        compression: 'gzip',
      }),
    );

    // Ensure AWS Signer was NOT called
    expect(AwsSigv4Signer).not.toHaveBeenCalled();

    // Check that auth was not created
    const clientOptions = (Client as unknown as jest.Mock).mock.calls[0][0];
    expect(clientOptions.auth).toBeUndefined();
    expect(clientOptions).not.toEqual(
      expect.objectContaining({
        region: expect.anything(),
        service: expect.anything(),
      }),
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
        auth: {
          username: 'admin',
          password: 'my-secret-password',
        },
        compression: 'gzip',
      }),
    );

    // Ensure AWS Signer was NOT called
    expect(AwsSigv4Signer).not.toHaveBeenCalled();
    const clientOptions = (Client as unknown as jest.Mock).mock.calls[0][0];
    expect(clientOptions).not.toEqual(
      expect.objectContaining({
        region: expect.anything(),
        service: expect.anything(),
      }),
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
      // username/password should be ignored if accidentally in the config object
      username: 'should-be-ignored',
      password: 'should-be-ignored',
    };

    // Create mocks
    (fromNodeProviderChain as jest.Mock).mockReturnValue(jest.fn());
    (AwsSigv4Signer as jest.Mock).mockReturnValue({
      signer: 'aws-sigv4-signer-instance',
    });

    createOpenSearchClient(awsConfig);

    // Check AWS Signer configuration
    expect(AwsSigv4Signer).toHaveBeenCalledWith({
      region: 'us-east-1',
      service: 'es',
      getCredentials: expect.any(Function),
    });

    // Check Client initialization
    const clientCallArgs = (Client as unknown as jest.Mock).mock.calls[0][0];
    expect(clientCallArgs).toEqual(
      expect.objectContaining({
        node: 'https://my-domain.us-west-2.es.amazonaws.com/', // port 443 is removed for https
        ssl: { rejectUnauthorized: true },
        compression: 'gzip',
        // Confirm the signer result was merged
        signer: 'aws-sigv4-signer-instance',
      }),
    );

    // Check that Basic Auth was NOT set, ignoring any username/password in config
    expect(clientCallArgs.auth).toBeUndefined();
  });
});

// ---------------------------------------------------------
// Validation Errors
// ---------------------------------------------------------

describe('Validation Errors', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  // Basic Auth: Missing Username
  test('Throws if authType is basic but username is missing', () => {
    const invalidBasicConfig = {
      host: 'localhost',
      port: 9200,
      useSSL: false,
      verifyCerts: false,
      authType: 'basic',
      username: null,
      password: 'password',
    };

    expect(() => createOpenSearchClient(invalidBasicConfig as unknown as OpenSearchConfig)).toThrow(
      "Basic authentication requires 'username' and 'password' to be defined.",
    );
    expect(Client).not.toHaveBeenCalled();
  });

  // Basic Auth: Missing Password
  test('Throws if authType is basic but password is missing', () => {
    const invalidBasicConfig = {
      host: 'localhost',
      port: 9200,
      useSSL: false,
      verifyCerts: false,
      authType: 'basic',
      username: 'admin',
      password: null,
    };

    expect(() => createOpenSearchClient(invalidBasicConfig as unknown as OpenSearchConfig)).toThrow(
      "Basic authentication requires 'username' and 'password' to be defined.",
    );
    expect(Client).not.toHaveBeenCalled();
  });

  // AWS Auth: Missing region
  test('Throws if authType is AWS but region is missing', () => {
    const invalidAwsConfig = {
      host: 'localhost',
      port: 9200,
      useSSL: false,
      verifyCerts: false,
      authType: 'aws',
      awsRegion: null,
      awsService: 'es',
    };

    expect(() => createOpenSearchClient(invalidAwsConfig as unknown as OpenSearchConfig)).toThrow(
      "AWS authentication requires 'awsRegion' and 'awsService' to be defined.",
    );
    expect(Client).not.toHaveBeenCalled();
  });

  // AWS Auth: Missing Service
  test('Throws if AuthType is AWS but service is missing', () => {
    const invalidAwsConfig = {
      host: 'localhost',
      port: 9200,
      useSSL: false,
      verifyCerts: false,
      authType: 'aws',
      awsRegion: 'us-east-1',
      awsService: null,
    };

    expect(() => createOpenSearchClient(invalidAwsConfig as unknown as OpenSearchConfig)).toThrow(
      "AWS authentication requires 'awsRegion' and 'awsService' to be defined.",
    );
    expect(Client).not.toHaveBeenCalled();
  });
});
