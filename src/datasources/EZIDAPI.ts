import { AugmentedRequest, RESTDataSource } from "@apollo/datasource-rest";
import { prepareObjectForLogs } from '../logger.js';
import { MyContext } from "../context.js";
import { EZIDConfig } from "../config/ezidConfig.js";

// Per the "Request & response bodies" EZID documentation (https://ezid.cdlib.org/doc/apidoc.html#request-response-bodies)
// Percent-encode ANVL structural characters per EZID spec.
// Names: encode %, newline, carriage-return, and colon.
// Values: encode %, newline, and carriage-return (colons are allowed in values).
function encodeANVLName(s: string): string {
  return s
    .replace(/%/g, '%25')
    .replace(/\n/g, '%0A')
    .replace(/\r/g, '%0D')
    .replace(/:/g, '%3A');
}

function encodeANVLValue(s: string): string {
  return s
    .replace(/%/g, '%25')
    .replace(/\n/g, '%0A')
    .replace(/\r/g, '%0D');
}

// Convert a metadata object to ANVL (A Name-Value Language) format.
// ANVL is EZID's required metadata format: key-value pairs separated by newlines.
// Structural characters are percent-encoded per the EZID API spec.
function toANVL(metadata: Record<string, string>): string {
  return Object.entries(metadata)
    .map(([key, value]) => `${encodeANVLName(key)}: ${encodeANVLValue(value)}`)
    .join('\n');
}

// Parse EZID's plain-text response.
// Success: "success: doi:10.9999/TEST | ark:/b9999/test" → returns the normalized identifier.
// Error:   "error: bad request - ..." → throws.
function parseEZIDResponse(response: string): string {
  const trimmed = (response ?? '').trim();
  if (trimmed.startsWith('success:')) {
    return trimmed.replace(/^success:\s*/, '').split('|')[0].trim();
  }
  throw new Error(trimmed || 'Unexpected empty response from EZID');
}

// DataSource that interacts with the EZID API using HTTP Basic Authentication.
// API reference: https://ezid.cdlib.org/doc/apidoc.html#request-response-bodies
export class EZIDAPI extends RESTDataSource {
  override baseURL = EZIDConfig.baseApiUrl;

  // Attach HTTP Basic Auth and content-type headers to every request.
  override willSendRequest(_path: string, request: AugmentedRequest) {
    const credentials = Buffer.from(
      `${EZIDConfig.username}:${EZIDConfig.password}`
    ).toString('base64');
    request.headers['authorization'] = `Basic ${credentials}`;
    request.headers['content-type'] = 'text/plain; charset=UTF-8';
  }

  // Create an identifier with EZID via PUT /id/{identifier}.
  // The identifier must be in EZID format, e.g. "doi:11.22222/A1B2C3d4".
  // Returns the normalized identifier from EZID's success response.
  async registerIdentifier(
    context: MyContext,
    identifier: string,
    metadata: Record<string, string>,
    reference = 'EZIDAPI.registerIdentifier'
  ): Promise<string> {
    try {
      const path = `id/${identifier}`;

      context.logger.debug(
        `${reference} calling EZID PUT ${this.baseURL}${path}`
      );

      const response = await this.put<string>(path, { body: toANVL(metadata) });
      return parseEZIDResponse(response);
    } catch (err) {
      context.logger.error(
        prepareObjectForLogs({ identifier, metadata, err }),
        'Error calling EZIDAPI registerIdentifier'
      );
      throw err;
    }
  }
}