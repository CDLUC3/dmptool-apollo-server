import { Logger } from 'pino';

import {
  ApolloServerPlugin,
  BaseContext,
  GraphQLRequestListener,
  GraphQLRequestContext,
  GraphQLResponse
} from "@apollo/server";
import { prepareObjectForLogs } from "../logger.js";

// Extract the inmportant information from the incoming request so that it is logged
function setupLogger(loggerInstance: Logger, context = null, errors = null) {
  const hdrs = context?.request?.http?.headers || new Map();
  const errs = errors instanceof Array ? errors : [errors];

  return loggerInstance.child({
    httpMethod: context?.request?.http?.method,
    httpReferer: hdrs?.get('referer'),
    httpSecFetchSite: hdrs?.get('sec-fetch-site'),
    httpUserAgent: hdrs?.get('user-agent'),
    // TODO: We will eventually want to update this to include the nextJS session id
    operationName: context?.request?.operationName,
    variables: prepareObjectForLogs(context?.request?.variables),
    query: context?.request?.query,
    status: context?.response?.http?.status,
    err: errs
  });
}

// Apollo has the ability to log every phase of the process of receiving a GraphQL query,
// validating it, etc. It is really noisy! So we have commented out most of them below.
//
// We currently only have the initial request and any errors received setup to log.
// You can uncomment the others as needed

// Initialize the Logging plugin that Apollo will use on each request/response
export function loggerPlugin(logger: Logger): ApolloServerPlugin<BaseContext> {
  return {
    // Fires any time Apollo server is going to respond with a 'Bad Request' error
    async invalidRequestWasReceived(requestError) {
      setupLogger(logger, {}, requestError.error).error('Invalid request error!');
    },

    // Fires when Apollo server is going to respond with a 'Server' error
    async unexpectedErrorProcessingRequest({
      requestContext,
      error,
    }: {
      requestContext: GraphQLRequestContext<BaseContext>;
      error: Error;
    }): Promise<void> {
      setupLogger(logger, requestContext?.request, error).error('Server error!');
    },

    // Fires whenever a GraphQL request is received from a client.
    async requestDidStart(initialContext: GraphQLRequestContext<BaseContext>): Promise<GraphQLRequestListener<BaseContext>> {
      // Skip schema introspection queries. They run incessantly in the Apollo server explorer!
      if (initialContext?.request?.operationName === 'IntrospectionQuery') {
        return {};
      }
      // Skip healthcheck requests
      if (initialContext?.request?.query === '{ __typename }') {
        return {};
      }

      setupLogger(logger, initialContext).info('Request started');

      return {
        // Fires when Apollo Server was able to understand the incoming request
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async didResolveSource(context) {
          // setupLogger(logger, context).debug('Resolved source');
        },

        // Fires whenever Apollo Server starts parsing the query/mutation
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async parsingDidStart(context) {
          // setupLogger(logger, context).debug('Parsing started');
        },

        // Fires whenever Apollo Server will validates the query/mutation
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async validationDidStart(context) {
          // setupLogger(logger, context).debug('Validation started');
        },

        // Fires whenever Apollo Server figures out what query/mutation to use
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async didResolveOperation(context) {
          // setupLogger(logger, context).debug('Resolved operation');
        },

        // Fires right before Apollo server starts to process the operation
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async responseForOperation(context): Promise<GraphQLResponse | null> {
          // setupLogger(logger, context).debug('Ready to start operation');

          // This is an opportunity to interrupt the operation!
          // If its return value resolves to a non-null GraphQLResponse, that result
          // is used instead of executing the query
          return null;
        },

        // Fires once Apollo server has figured out what it needs to do
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async executionDidStart(context) {
          // const localLogger = setupLogger(logger, context);
          // localLogger.debug('Operation execution started');

          // return {
          //   willResolveField({ info }) {
          //     const start = process.hrtime.bigint();
          //     const fld = `${info?.parentType?.name}.${info?.fieldName}`;

          //     return (error) => {
          //       const end = process.hrtime.bigint();
          //       localLogger.debug(`Field ${fld} took ${end - start}ns`);

          //      if (error) {
          //         localLogger.error(`Field ${fld} failed with ${error}`);
          //       }
          //     };
          //   },
          // };
        },

        // Fires if Apollo server encountered any errors when processing the operation
        async didEncounterErrors(context) {
          setupLogger(logger, context, context?.errors).error('Encountered errors!');
        },

        // Fires only when using incremental delivery methods like @defer
        async didEncounterSubsequentErrors(context, requestErrors) {
          setupLogger(logger, context, requestErrors).error('Encountered subsequent errors!');
        },

        // Fires right before Apollo server sends its response
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async willSendResponse(context) {
          // setupLogger(logger, context).info('Ready to send response');
        },

        // Fires only when using incremental delivery methods like @defer
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        async willSendSubsequentPayload(context) {
          // setupLogger(logger, context).info('Ready to send subsequent responses');
        },
      };
    },
  };
}
