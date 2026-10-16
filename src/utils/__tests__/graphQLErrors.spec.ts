import { GraphQLError } from 'graphql';
import {
  AuthenticationError,
  AUTHENTICATION_ERROR_CODE,
  DEFAULT_UNAUTHORIZED_MESSAGE,
  DEFAULT_FORBIDDEN_MESSAGE,
  ForbiddenError,
  FORBIDDEN_ERROR_CODE,
  INTERNAL_SERVER_ERROR_CODE,
  DEFAULT_INTERNAL_SERVER_MESSAGE,
  BAD_REQUEST_ERROR_CODE,
  DEFAULT_BAD_REQUEST_MESSAGE,
  NOT_FOUND_ERROR_CODE,
  DEFAULT_NOT_FOUND_MESSAGE,
  NotFoundError,
  BadRequestError,
  InternalServerError,
} from '../graphQLErrors.js';
import casual from 'casual';

describe('Authentication error', () => {
  test('returns a GraphQLError with the default error message', () => {
    const err = AuthenticationError();
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(DEFAULT_UNAUTHORIZED_MESSAGE);
    expect(err.extensions?.code).toEqual(AUTHENTICATION_ERROR_CODE);
  });

  test('it uses the error message provided', () => {
    const errMsg = casual.sentence;
    const err = AuthenticationError(errMsg);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(errMsg);
    expect(err.extensions?.code).toEqual(AUTHENTICATION_ERROR_CODE);
  });
});

describe('Forbidden error', () => {
  test('returns a GraphQLError with the default error message', () => {
    const err = ForbiddenError();
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(DEFAULT_FORBIDDEN_MESSAGE);
    expect(err.extensions?.code).toEqual(FORBIDDEN_ERROR_CODE);
  });

  test('it uses the error message provided', () => {
    const errMsg = casual.sentence;
    const err = ForbiddenError(errMsg);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(errMsg);
    expect(err.extensions?.code).toEqual(FORBIDDEN_ERROR_CODE);
  });
});

describe('Not Found error', () => {
  test('returns a GraphQLError with the default error message', () => {
    const err = NotFoundError();
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(DEFAULT_NOT_FOUND_MESSAGE);
    expect(err.extensions?.code).toEqual(NOT_FOUND_ERROR_CODE);
  });

  test('it uses the error message provided', () => {
    const errMsg = casual.sentence;
    const err = NotFoundError(errMsg);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(errMsg);
    expect(err.extensions?.code).toEqual(NOT_FOUND_ERROR_CODE);
  });
});

describe('Not Acceptable error', () => {
  test('returns a GraphQLError with the default error message', () => {
    const err = NotFoundError();
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(DEFAULT_NOT_FOUND_MESSAGE);
    expect(err.extensions?.code).toEqual(NOT_FOUND_ERROR_CODE);
  });

  test('it uses the error message provided', () => {
    const errMsg = casual.sentence;
    const err = NotFoundError(errMsg);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(errMsg);
    expect(err.extensions?.code).toEqual(NOT_FOUND_ERROR_CODE);
  });
});

describe('Bad Request error', () => {
  test('returns a GraphQLError with the default error message', () => {
    const err = BadRequestError();
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(DEFAULT_BAD_REQUEST_MESSAGE);
    expect(err.extensions?.code).toEqual(BAD_REQUEST_ERROR_CODE);
  });

  test('it uses the error message provided', () => {
    const errMsg = casual.sentence;
    const err = BadRequestError(errMsg);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(errMsg);
    expect(err.extensions?.code).toEqual(BAD_REQUEST_ERROR_CODE);
  });
});

describe('Internal Server error', () => {
  test('returns a GraphQLError with the default error message', () => {
    const err = InternalServerError();
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(DEFAULT_INTERNAL_SERVER_MESSAGE);
    expect(err.extensions?.code).toEqual(INTERNAL_SERVER_ERROR_CODE);
  });

  test('it uses the error message provided', () => {
    const errMsg = casual.sentence;
    const err = InternalServerError(errMsg);
    expect(err).toBeInstanceOf(GraphQLError);
    expect(err.message).toEqual(errMsg);
    expect(err.extensions?.code).toEqual(INTERNAL_SERVER_ERROR_CODE);
  });
});
