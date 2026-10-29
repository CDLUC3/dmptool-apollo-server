import type { jest as jestType } from '@jest/globals';

declare global {
  var jest: typeof jestType;
}

export { };