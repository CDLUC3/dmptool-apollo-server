import { GraphQLScalarType, Kind } from 'graphql';
import { generalConfig } from '../../config/generalConfig.js';

const ROR_ID_REGEX = /^[0-9a-zA-Z]+$/;
const ROR_URL_REGEX = /^https?:\/\/ror.org\/[0-9a-zA-Z]+/

export function validateRor(val) {
  const match = val.startsWith('http') ? val.match(ROR_URL_REGEX) : val.match(ROR_ID_REGEX);
  if (match && match.length > 0) {
    // Prepend the ROR URL to the id if it doesn't have it
    return val.startsWith('http') ? val : `${generalConfig.rorBaseURL}${val}`;
  }
  throw new Error(`Invalid ROR format. Expected: "https://ror.org/abcd1234"`);
}

// GraphQL Scalar definition for a researcher ORCID
export const rorScalar = new GraphQLScalarType({
  name: 'Ror',
  description: 'An organization ROR ID',

  serialize(ror) {
    return validateRor(ror.toString())
  },

  parseValue(value) {
    return validateRor(value.toString());
  },

  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      // Convert hard-coded AST string to string and then to Ror
      return validateRor(ast.value);
    }
    // Invalid hard-coded value (not a string)
    return null;
  },
});