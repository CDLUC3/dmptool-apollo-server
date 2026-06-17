/**
 * Manual Jest mock for @dmptool/utils.
 *
 * Every callable export is replaced with a jest.fn() so individual tests can
 * configure return values without importing the real AWS-dependent package.
 *
 * Enum values and constants are pulled from the real module via
 * jest.requireActual() so that TypeScript can still reference them
 * in test files without triggering any AWS SDK side effects.
 */

// Pull real enum/constant values without triggering a circular mock loop.
const actual = jest.requireActual<typeof import('@dmptool/utils')>(
  '@dmptool/utils'
);

export const EnvironmentEnum = actual.EnvironmentEnum;
export const LogLevelEnum = actual.LogLevelEnum;
export const StandardIdentifierType = actual.StandardIdentifierType;
export const DMP_LATEST_VERSION = actual.DMP_LATEST_VERSION;
export const DMP_TOMBSTONE_VERSION = actual.DMP_TOMBSTONE_VERSION;

// ── cloudFormation ─────────────────────────────────────────────────────────
export const getExport = jest.fn();

// ── dynamo ─────────────────────────────────────────────────────────────────
export const DMPExists = jest.fn();
export const getAllUniqueDMPIds = jest.fn();
export const getDMPVersions = jest.fn();
export const getDMPs = jest.fn();
export const createDMP = jest.fn();
export const updateDMP = jest.fn();
export const tombstoneDMP = jest.fn();
export const deleteDMP = jest.fn();

// ── general ────────────────────────────────────────────────────────────────
export const toErrorMessage = jest.fn();
export const normaliseHttpProtocol = jest.fn();
export const isValidDate = jest.fn();
export const currentDateAsString = jest.fn();
export const convertMySQLDateTimeToRFC3339 = jest.fn();
export const randomHex = jest.fn();
export const isNullOrUndefined = jest.fn();
export const removeNullAndUndefinedFromObject = jest.fn();
export const isJSON = jest.fn();
export const areEqual = jest.fn();

// ── logger ─────────────────────────────────────────────────────────────────
export const initializeLogger = jest.fn();

// ── maDMP ──────────────────────────────────────────────────────────────────
export const validateRDACommonStandard = jest.fn();
export const validateDMPToolExtensions = jest.fn();
export const planToDMPCommonStandard = jest.fn();

// ── rds ────────────────────────────────────────────────────────────────────
export const queryTable = jest.fn();

// ── s3 ─────────────────────────────────────────────────────────────────
export const listObjects = jest.fn();
export const getObject = jest.fn();
export const putObject = jest.fn();
export const removeObject = jest.fn();
export const getPresignedURL = jest.fn();
export const getPresignedURLForImageUpload = jest.fn();

// ── sqs ────────────────────────────────────────────────────────────────────
export const sendMessage = jest.fn();

// ── ssm ────────────────────────────────────────────────────────────────────
export const getSSMParameter = jest.fn();
