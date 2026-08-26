import {
  GraphQLError,
  // GraphQLResolveInfo
} from 'graphql';
import {
  GraphQLRequestContextDidEncounterSubsequentErrors,
  // GraphQLRequestContextWillSendSubsequentPayload,
} from '@apollo/server/dist/esm/externalTypes/requestPipeline';
import {
  BaseContext,
  GraphQLRequestContext,
  GraphQLRequestContextDidEncounterErrors,
  // GraphQLRequestContextDidResolveOperation,
  // GraphQLRequestContextDidResolveSource,
  // GraphQLRequestContextExecutionDidStart,
  // GraphQLRequestContextResponseForOperation,
  // GraphQLRequestContextValidationDidStart,
  // GraphQLRequestContextWillSendResponse,
  // GraphQLRequestExecutionListener,
  // GraphQLRequestListenerDidResolveField,
  // GraphQLExperimentalFormattedSubsequentIncrementalExecutionResult,
  GraphQLRequestListener,
} from '@apollo/server';
import { logger } from "../../logger.js";
import { loggerPlugin } from '../logger.js';

const mockIntrospectionRequestContext = {
  request: { operationName: 'IntrospectionQuery' }
} as undefined as GraphQLRequestContext<BaseContext>;

const mockHealthCheckRequestContext = {
  request: { query: '{ __typename }' },
} as undefined as GraphQLRequestContext<BaseContext>;

const mockRequestContext = {
  request: {
    operationName: 'Me',
    query: '{ User(id: 123) { id } }',
    variables: [],
    http: { method: 'PUT' },
  },
  response: { http: { status: 200 } },
} as undefined as GraphQLRequestContext<BaseContext>;

/*
const mockResolverInfo = {
  fieldName: 'fieldName',
  parentType: { name: 'parentTypeName' }
} as undefined as GraphQLResolveInfo;
*/

const mockRequestError = {
  error: new Error(),
}

// Define spies
let debugSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
let infoSpy: jest.SpyInstance;

const mockLogger = loggerPlugin(logger);

describe('loggerPlugin', () => {
  beforeEach(() => {
    debugSpy = jest.spyOn(logger, 'debug');
    errorSpy = jest.spyOn(logger, 'error');
    infoSpy = jest.spyOn(logger, 'info');
    jest.clearAllMocks();
  });

  afterEach(() => {
    debugSpy.mockRestore();
    errorSpy.mockRestore();
    infoSpy.mockRestore();
  });

  test('invalidRequestWasReceived logs the expected error message', async () => {
    await mockLogger.invalidRequestWasReceived(mockRequestError);
    expect(errorSpy).toHaveBeenCalledWith('Invalid request error!');
  });

  test('unexpectedErrorProcessingRequest logs the expected error message', async () => {
    await mockLogger.unexpectedErrorProcessingRequest({
      requestContext: mockRequestContext,
      error: mockRequestError.error
    });
    expect(errorSpy).toHaveBeenCalledWith('Server error!');
  });

  describe('requestDidStart', () => {
    test('skips introspection queries', async () => {
      expect(await mockLogger.requestDidStart(mockIntrospectionRequestContext)).toEqual({});
    });

    test('skips healthcheck queries', async () => {
      expect(await mockLogger.requestDidStart(mockHealthCheckRequestContext)).toEqual({});
    });

    test('logs the expected message', async () => {
      await mockLogger.requestDidStart(mockRequestContext);
      expect(infoSpy).toHaveBeenCalledWith('Request started');
    });

    test('returns a GraphQLRequestListener', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext);
      expect(typeof listener).toEqual('object');
      expect(listener).toHaveProperty('didResolveSource');
    });
  });

  describe('GraphQLRequestListener', () => {
    /*
    test('didResolveSource logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.didResolveSource(mockRequestContext as GraphQLRequestContextDidResolveSource<BaseContext>);
      expect(debugSpy).toHaveBeenCalledWith('Resolved source');
    });

    test('parsingDidStart logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.parsingDidStart(mockRequestContext as GraphQLRequestContextDidResolveSource<BaseContext>);
      expect(debugSpy).toHaveBeenCalledWith('Parsing started');
    });

    test('validationDidStart logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.validationDidStart(mockRequestContext as GraphQLRequestContextValidationDidStart<BaseContext>);
      expect(debugSpy).toHaveBeenCalledWith('Validation started');
    });

    test('didResolveOperation logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.didResolveOperation(mockRequestContext as GraphQLRequestContextDidResolveOperation<BaseContext>);
      expect(debugSpy).toHaveBeenCalledWith('Resolved operation');
    });

    test('responseForOperation logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.responseForOperation(mockRequestContext as GraphQLRequestContextResponseForOperation<BaseContext>);
      expect(debugSpy).toHaveBeenCalledWith('Ready to start operation');
    });
    */

    test('didEncounterErrors logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.didEncounterErrors(mockRequestContext as GraphQLRequestContextDidEncounterErrors<BaseContext>);
      expect(errorSpy).toHaveBeenCalledWith('Encountered errors!');
    });

    test('didEncounterSubsequentErrors logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.didEncounterSubsequentErrors(
        mockRequestContext as GraphQLRequestContextDidEncounterSubsequentErrors<BaseContext>,
        [] as GraphQLError[]
      );
      expect(errorSpy).toHaveBeenCalledWith('Encountered subsequent errors!');
    });

    /*
    test('willSendResponse logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.willSendResponse(mockRequestContext as GraphQLRequestContextWillSendResponse<BaseContext>);
      expect(infoSpy).toHaveBeenCalledWith('Ready to send response');
    });

    test('willSendSubsequentPayload logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.willSendSubsequentPayload(
        mockRequestContext as GraphQLRequestContextWillSendSubsequentPayload<BaseContext>,
        {} as GraphQLExperimentalFormattedSubsequentIncrementalExecutionResult
      );
      expect(infoSpy).toHaveBeenCalledWith('Ready to send subsequent responses');
    });

    test('executionDidStart logs expected message', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      listener.executionDidStart(mockRequestContext as GraphQLRequestContextExecutionDidStart<BaseContext>);
      expect(debugSpy).toHaveBeenCalledWith('Operation execution started');
    });

    test('willResolveField logs expected error', async () => {
      const listener = await mockLogger.requestDidStart(mockRequestContext) as GraphQLRequestListener<BaseContext>;
      const fieldListener = await listener.executionDidStart(
        mockRequestContext as GraphQLRequestContextExecutionDidStart<BaseContext>
      ) as GraphQLRequestExecutionListener<BaseContext>;

      const mockGraphQLResolverParams = {
        source: null,
        args: {},
        contextValue: {},
        info: mockResolverInfo
      }

      const resp = fieldListener.willResolveField(mockGraphQLResolverParams) as GraphQLRequestListenerDidResolveField
      resp(mockRequestError.error, {});
      expect(debugSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Field parentTypeName.fieldName took [\d]+ns/i)
      );
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Field parentTypeName.fieldName failed/i)
      );
    });
    */
  });
});
