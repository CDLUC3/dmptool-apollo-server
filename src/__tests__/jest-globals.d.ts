import type { jest as jestType } from '@jest/globals';

declare global {
  // eslint-disable-next-line no-var
  var jest: typeof jestType;
}

export { };