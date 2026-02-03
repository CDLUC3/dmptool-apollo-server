import pino, { Logger } from 'pino';
import { ecsFormat } from '@elastic/ecs-pino-format';
import { isNullOrUndefined } from "./utils/helpers";

/*
 * Logger using Pino and the Elastic Common Schema format to facilitate
 * standardization across all log messaging. This format will allow us
 * to more easily debug and track requests in OpenSearch.
 *
 * The log messages will include a numeric `level` that corresponds to the log level.
 *    10 = trace, 20 = debug, 30 = info, 40 = debug, 50 = error, 60 = fatal
 */

// The fields that should be redacted from the logs
export const REDACTION_KEYS = [
  'givenName',
  'surName',
  'password',
  'pwd',
  'token',
  'secret',
  'jwtSecret',
];

export const REDACTION_MESSAGE = '[MASKED]';

const logLevel = process.env.LOG_LEVEL || 'info';

export const logger: Logger = pino({
  level: logLevel,
  redact: {
    paths: REDACTION_KEYS,
    censor: REDACTION_MESSAGE
  },
  ...ecsFormat()
});

export interface LoggerContext {
  app: string;
  env: string;
  requestId?: string;
  jti?: string;
  userId?: number;
}

function maskEmail(email: string): string {
  const parts = email.split('@');
  if (parts.length !== 2) {
    // Not a valid email format
    return email;
  }

  const localPart = parts[0];
  const domainPart = parts[1];

  if (localPart.length <= 2) {
    // If the local part is too short, we can't mask it properly, so we just return the redaction message
    return REDACTION_MESSAGE;
  }

  const firstChar = localPart.charAt(0);
  const lastChar = localPart.charAt(localPart.length - 1);
  const maskedSection = '*'.repeat(localPart.length - 2);

  return `${firstChar}${maskedSection}${lastChar}@${domainPart}`;
}

// Inspect the keys and values of the object and recursively mask any sensitive information
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function redactSensitiveInfo(obj: any, visited: WeakSet<any>): any {
  // If we have seen object before then stop
  if (obj !== null && typeof obj === 'object') {
    if (visited.has(obj)) {
      return '[Circular]';
    }
    visited.add(obj);
  }

  if (Array.isArray(obj)) {
    return obj.map(item => redactSensitiveInfo(item, visited));
  } else if (obj !== null && typeof obj === 'object') {
    // Don't log buffers
    if (Buffer.isBuffer(obj)) {
      return '[Buffer]';
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const redactedObj: any = {};
    for (const [key, value] of Object.entries(obj)) {
      if (REDACTION_KEYS.includes(key)) {
        redactedObj[key] = REDACTION_MESSAGE;
      } else {
        redactedObj[key] = redactSensitiveInfo(value, visited);
      }
    }
    return redactedObj;
  } else if (typeof obj === 'string') {
    // Replace any email addresses with the redaction message
    const emailRegex = /\s?[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\s?/g;
    if (emailRegex.test(obj)) {
      return obj.replace(emailRegex, maskEmail);
    }
    return obj;
  }
  return obj;
}

// Initialize the logger. Called by buildContext and in non-GraphQL controllers.
// Spawns an instance of the pino logger with the specified contextFields.
// The newly spawned instance is then used throughout the request's lifecycle
export function initLogger(baseLogger: Logger, contextFields: LoggerContext): Logger {
  try {
    return baseLogger.child(prepareObjectForLogs(contextFields));
  } catch (err) {
    console.error('Unable to initialize the logger', err);
    return baseLogger;
  }
}

// Filter out undefined fields for cleaner logs
export function prepareObjectForLogs(obj: object): object {
  if (isNullOrUndefined(obj)) return {};

  const cleansed = redactSensitiveInfo(obj, new WeakSet());
  return Object.fromEntries(
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    Object.entries(cleansed).filter(([_, v]) => !isNullOrUndefined(v))
  );
}

