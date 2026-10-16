/* eslint-disable @typescript-eslint/no-explicit-any */
import { jest } from '@jest/globals';

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

const mockSSMClient = jest.fn<(...args: any[]) => any>();
const mockGetParameterCommand = jest.fn<(...args: any[]) => any>();

const actualAWSSDK = await import('@aws-sdk/client-ssm');
jest.unstable_mockModule('@aws-sdk/client-ssm', () => ({
  ...actualAWSSDK,
  SSMClient: mockSSMClient,
  GetParameterCommand: mockGetParameterCommand,
}));

// ---------------------------------------------------------------------------
// Everything below is dynamic, registered after the mock above — a static
// import here would be hoisted above jest.unstable_mockModule regardless of
// where it's textually written, meaning parameterStore.js (which imports the
// real @aws-sdk/client-ssm internally) would evaluate against the real SDK
// instead of these mocks.
// ---------------------------------------------------------------------------
import type { MyContext } from '../../context.js';
import type { GetParameterCommandOutput } from '@aws-sdk/client-ssm';

const { logger } = await import('../../logger.js');
const { buildContext } = await import('../../__mocks__/context.js');

describe("ParameterStore.getParameter", () => {
  let mockSend: ReturnType<typeof jest.fn>;
  let context: MyContext;
  // getParameter is re-imported fresh in every test (see beforeEach) rather
  // than imported once at module scope. parameterStore.ts caches its
  // SSMClient in a module-level singleton (`let client`) — since ES modules
  // are evaluated once and cached for the file's lifetime, that singleton
  // would otherwise only ever get constructed on the first test that calls
  // getParameter, permanently wiring every later test's real send() calls
  // to the FIRST test's mockSend rather than each test's own fresh one.
  // jest.resetModules() + a fresh dynamic import forces parameterStore.js's
  // module state (including that singleton) to reset before each test.
  let getParameter: typeof import('../parameterStore.js')['getParameter'];

  beforeEach(async () => {
    mockSend = jest.fn<(...args: any[]) => Promise<any>>();
    mockSSMClient.mockImplementation(() => ({
      send: mockSend
    }));

    context = buildContext(logger);

    jest.clearAllMocks();

    jest.resetModules();
    ({ getParameter } = await import('../parameterStore.js'));
  });

  it("returns parameter value when SSM returns successfully", async () => {
    const mockOutput: GetParameterCommandOutput = {
      Parameter: { Value: "my-secret-value" },
      "$metadata": { httpStatusCode: 200, requestId: "123", attempts: 1, totalRetryDelay: 0 }
    };
    mockSend.mockResolvedValueOnce(mockOutput);

    const result = await getParameter(context, "my-key");

    expect(mockGetParameterCommand).toHaveBeenCalledWith({
      Name: "my-key",
      WithDecryption: true
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result).toBe("my-secret-value");
  });

  it("returns empty string if Parameter.Value is missing", async () => {
    const mockOutput: GetParameterCommandOutput = {
      Parameter: {},
      "$metadata": { httpStatusCode: 404, requestId: "123", attempts: 1, totalRetryDelay: 0 }
    };
    mockSend.mockResolvedValueOnce(mockOutput);

    const result = await getParameter(context, "missing-value");

    expect(result).toBe("");
  });

  it("logs error and returns empty string when SSM throws", async () => {
    const error = new Error("SSM failure");
    mockSend.mockRejectedValueOnce(error);

    const result = await getParameter(context, "bad-key");

    expect(result).toBe("");
    expect(context.logger?.error).toHaveBeenCalledWith(
      { err: error, key: "bad-key" },
      "Error fetching parameter from SSM"
    );

  });
});