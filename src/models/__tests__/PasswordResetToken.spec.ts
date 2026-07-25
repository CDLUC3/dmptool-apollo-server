import casual from 'casual';
import { PasswordResetToken } from '../PasswordResetToken';
import { buildMockContextWithToken } from '../../__mocks__/context';
import { logger } from '../../logger';

jest.mock('../../context.ts');

let context;

describe('PasswordResetToken', () => {
  let token;

  const tokenData = {
    id: casual.integer(1, 999),
    userId: casual.integer(1, 999),
    resetPasswordToken: casual.uuid,
    resetPasswordExpiresAt: '2030-01-01 00:00:00',
    usedAt: null,
  };

  beforeEach(() => {
    token = new PasswordResetToken(tokenData);
  });

  it('should initialize options as expected', () => {
    expect(token.id).toEqual(tokenData.id);
    expect(token.userId).toEqual(tokenData.userId);
    expect(token.resetPasswordToken).toEqual(tokenData.resetPasswordToken);
    expect(token.resetPasswordExpiresAt).toEqual(tokenData.resetPasswordExpiresAt);
    expect(token.usedAt).toEqual(tokenData.usedAt);
  });
});

describe('create', () => {
  const originalInsert = PasswordResetToken.insert;
  const originalFindById = PasswordResetToken.findById;

  let insertMock;
  let token;

  beforeEach(async () => {
    jest.resetAllMocks();

    context = await buildMockContextWithToken(logger);

    token = new PasswordResetToken({
      userId: 123,
      resetPasswordToken: casual.uuid,
      resetPasswordExpiresAt: '2030-01-01 00:00:00'
    });

    insertMock = jest.fn().mockResolvedValue(99);
    (PasswordResetToken.insert as jest.Mock) = insertMock;
  });

  afterEach(() => {
    PasswordResetToken.insert = originalInsert;
    PasswordResetToken.findById = originalFindById;
  });

  it('should insert and return the saved token', async () => {
    const findMock = jest.fn().mockResolvedValue(
      new PasswordResetToken({
        id: 99,
        userId: 123,
        resetPasswordToken: token.resetPasswordToken,
        resetPasswordExpiresAt: token.resetPasswordExpiresAt
      })
    );

    (PasswordResetToken.findById as jest.Mock) = findMock;

    jest.spyOn(token, 'isValid').mockResolvedValue(true);

    const result = await token.create(context);

    expect(insertMock).toHaveBeenCalledTimes(1);
    expect(findMock).toHaveBeenCalledWith(
      'PasswordResetToken.create',
      context,
      99
    );
    expect(result.id).toEqual(99);
  });

  it('should return itself when invalid', async () => {
    jest.spyOn(token, 'isValid').mockResolvedValue(false);

    const result = await token.create(context);

    expect(insertMock).not.toHaveBeenCalled();
    expect(result).toBe(token);
  });
});

describe('markUsed', () => {
  const originalUpdate = PasswordResetToken.update;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    PasswordResetToken.update = originalUpdate;
  });

  it('should return false when id is missing', async () => {
    const token = new PasswordResetToken({
      userId: 1
    });

    expect(await token.markUsed(context)).toBe(false);
  });

  it('should update the record', async () => {
    const token = new PasswordResetToken({
      id: 1,
      userId: 1
    });

    const updateMock = jest.fn().mockResolvedValue(true);
    (PasswordResetToken.update as jest.Mock) = updateMock;

    const result = await token.markUsed(context);

    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(result).toBe(true);
    expect(token.usedAt).toBeTruthy();
  });
});

describe('findById', () => {
  const originalQuery = PasswordResetToken.query;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    PasswordResetToken.query = originalQuery;
  });

  it('should return the token', async () => {
    const queryMock = jest.fn().mockResolvedValue([
      {
        id: 1,
        userId: 5
      }
    ]);

    (PasswordResetToken.query as jest.Mock) = queryMock;

    const result = await PasswordResetToken.findById('Test', context, 1);

    expect(queryMock).toHaveBeenCalledWith(
      context,
      'SELECT * FROM passwordResetTokens WHERE id = ?',
      ['1'],
      'Test'
    );

    expect(result.id).toEqual(1);
  });

  it('should return null when not found', async () => {
    (PasswordResetToken.query as jest.Mock) = jest.fn().mockResolvedValue([]);

    const result = await PasswordResetToken.findById('Test', context, 1);

    expect(result).toBeNull();
  });
});

describe('findValidByToken', () => {
  const originalQuery = PasswordResetToken.query;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    PasswordResetToken.query = originalQuery;
  });

  it('should return a valid token', async () => {
    const queryMock = jest.fn().mockResolvedValue([
      {
        id: 1,
        userId: 2,
        resetPasswordToken: 'abc'
      }
    ]);

    (PasswordResetToken.query as jest.Mock) = queryMock;

    const result = await PasswordResetToken.findValidByToken(context, 'abc');

    expect(queryMock).toHaveBeenCalledTimes(1);
    expect(result.resetPasswordToken).toEqual('abc');
  });

  it('should return null when none found', async () => {
    (PasswordResetToken.query as jest.Mock) = jest.fn().mockResolvedValue([]);

    const result = await PasswordResetToken.findValidByToken(context, 'abc');

    expect(result).toBeNull();
  });
});

describe('createForUser', () => {
  const originalQuery = PasswordResetToken.query;
  const originalCreate = PasswordResetToken.prototype.create;

  beforeEach(async () => {
    jest.resetAllMocks();
    context = await buildMockContextWithToken(logger);
  });

  afterEach(() => {
    PasswordResetToken.query = originalQuery;
    PasswordResetToken.prototype.create = originalCreate;
  });

  it('should return null if required arguments are missing', async () => {
    const result = await PasswordResetToken.createForUser(
      context,
      /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
      null as any,
      '',
      ''
    );

    expect(result).toBeNull();
  });

  it('should invalidate previous tokens and create a new one', async () => {
    const queryMock = jest.fn().mockResolvedValue(true);
    (PasswordResetToken.query as jest.Mock) = queryMock;

    const savedToken = new PasswordResetToken({
      id: 123,
      userId: 1,
      resetPasswordToken: 'hashed-token',
      resetPasswordExpiresAt: '2030-01-01 00:00:00'
    });

    const createMock = jest
      .spyOn(PasswordResetToken.prototype, 'create')
      .mockResolvedValue(savedToken);

    const result = await PasswordResetToken.createForUser(
      context,
      1,
      'hashed-token',
      '2030-01-01 00:00:00'
    );

    expect(queryMock).toHaveBeenCalledWith(
      context,
      'UPDATE passwordResetTokens SET usedAt = ? WHERE userId = ? AND usedAt IS NULL',
      [expect.any(String), '1'],
      'PasswordResetToken.createForUser - invalidatePrevious'
    );

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result).toEqual(savedToken);
  });

  it('should return null if create fails', async () => {
    (PasswordResetToken.query as jest.Mock) = jest.fn().mockResolvedValue(true);

    jest
      .spyOn(PasswordResetToken.prototype, 'create')
      .mockResolvedValue(new PasswordResetToken({ userId: 1 }));

    const result = await PasswordResetToken.createForUser(
      context,
      1,
      'hashed-token',
      '2030-01-01 00:00:00'
    );

    expect(result).toBeNull();
  });
});