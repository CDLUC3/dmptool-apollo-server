import { validateDmspId } from './resolvers/scalars/dmspId';
import { validateOrcid } from './resolvers/scalars/orcid';
import { validateRor } from './resolvers/scalars/ror';
import { generalConfig } from './config/generalConfig';
import {
  getCurrentDate,
  randomFloatInRange,
  randomHex,
  randomIntInRange
} from "./utils/helpers";

// Mock resolvers for our custom Scalars
function mockOrcid() {
  const segment = (): string => randomIntInRange(1, 9999).toString().padStart(4, '0');
  // Create an array of 4 segments and join them with hyphens
  const id: string = Array.from({ length: 4 }, segment).join('-');
  return validateOrcid(id);
}
function mockRor() {
  return validateRor(`${generalConfig.rorBaseURL}${randomHex(4)}`);
}
function mockDmspId() {
  const dmpBase = `${generalConfig.dmpIdBaseURL}${generalConfig.dmpIdShoulder}`;
  return validateDmspId(`${dmpBase}${randomHex(6).toUpperCase()}`);
}

const scalarMocks = {
  // Mocks for generic scalars
  Int: () => randomIntInRange(1, 1000),
  Float: () => randomFloatInRange(1.0, 999.99),
  String: () => randomHex(6),

  // Mocks for graphql-tools custom scalars
  URL: () => `http://example.com/${randomHex(6)}`,
  DateTimeISO: () => getCurrentDate(),
  EmailAddress: () => `${randomHex(6)}@example.com`,

  // Mocks for custom scalars
  Orcid: () => mockOrcid(),
  Ror: () => mockRor(),
  DmspId: () => mockDmspId(),
};

export const mocks = {
  ...scalarMocks,
};
