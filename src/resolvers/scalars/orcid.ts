import { GraphQLScalarType, Kind } from 'graphql';
import { formatORCID } from "../../utils/helpers.js";

// Function to ensure the ORCID is properly formatted
export function validateOrcid(val) {
  const orcid = formatORCID(val);
  if (orcid !== null) {
    return orcid
  }
  throw new Error(`Invalid ORCID format. Expected: "https://orcid.org/0000-0000-0000-0000" or "0000-0000-0000-0000"`);
}

// GraphQL Scalar definition for a researcher ORCID
export const orcidScalar = new GraphQLScalarType({
  name: 'Orcid',
  description: 'A researcher ORCID',

  serialize(orcid) {
    return validateOrcid(orcid.toString())
  },

  parseValue(value) {
    return validateOrcid(value.toString());
  },

  parseLiteral(ast) {
    if (ast.kind === Kind.STRING) {
      // Convert hard-coded AST string to string and then to Orcid
      return validateOrcid(ast.value);
    }
    // Invalid hard-coded value (not a string)
    return null;
  },
});
