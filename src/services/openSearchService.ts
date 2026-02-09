import { Client } from "@opensearch-project/opensearch";
import { MyContext } from '../context';
import { OpenSearchWork, WorkType } from '../types';
import { awsConfig } from '../config/awsConfig';
import { prepareObjectForLogs } from '../logger';
import { createOpenSearchClient, OpenSearchConfig } from "../datasources/openSearch";
import { GraphQLError } from "graphql";


interface OpenSearchWorkRecord {
  doi: string;
  title?: string;
  abstract_text?: string;
  hash: string;
  work_type: string;
  publication_date?: string;
  updated_date?: string;
  publication_venue?: string;
  institutions: { name?: string; ror?: string }[];
  authors: {
    orcid?: string;
    first_initial?: string;
    given_name?: string;
    middle_initials?: string;
    middle_names?: string;
    surname?: string;
    full?: string;
  }[];
  funders: { name?: string; ror?: string }[];
  awards: { award_id?: string }[];
  source: { name: string; url?: string };
}

interface OpenSearchHit {
  _source: OpenSearchWorkRecord;
}

export function convertWorkToCamelCase(work: OpenSearchWorkRecord): OpenSearchWork {
  return {
    doi: work.doi,
    title: work.title,
    abstractText: work.abstract_text,
    hash: work.hash,
    workType: work.work_type as WorkType,
    publicationDate: work.publication_date,
    updatedDate: work.updated_date,
    publicationVenue: work.publication_venue,
    institutions:
      work.institutions?.map((inst) => ({
        name: inst.name,
        ror: inst.ror,
      })) || [],
    authors:
      work.authors?.map((auth) => ({
        orcid: auth.orcid,
        firstInitial: auth.first_initial,
        givenName: auth.given_name,
        middleInitials: auth.middle_initials,
        middleNames: auth.middle_names,
        surname: auth.surname,
        full: auth.full,
      })) || [],
    funders:
      work.funders?.map((funder) => ({
        name: funder.name,
        ror: funder.ror,
      })) || [],
    awards:
      work.awards?.map((award) => ({
        awardId: award.award_id,
      })) || [],
    source: {
      name: work.source.name,
      url: work.source.url,
    },
  };
}

interface OpenSearchRe3DataRecord {
  id: string;
  name: string;
  description?: string;
  homepage?: string;
  contact?: string;
  uri?: string;
  types?: string[];
  subjects?: string[];
  provider_types?: string[];
  keywords?: string[];
  access?: string;
  pid_system?: string[];
  policies?: string[];
  upload_types?: string[];
  certificates?: string[];
  software?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface OpenSearchRe3Data {
  id: string;
  name: string;
  description?: string;
  homepage?: string;
  contact?: string;
  uri?: string;
  types?: string[];
  subjects?: string[];
  providerTypes?: string[];
  keywords?: string[];
  access?: string;
  pidSystem?: string[];
  policies?: string[];
  uploadTypes?: string[];
  certificates?: string[];
  software?: string[];
  createdAt?: string;
  updatedAt?: string;
}

interface OpenSearchRe3DataHit {
  _source: OpenSearchRe3DataRecord;
}

export function convertRe3DataToCamelCase(record: OpenSearchRe3DataRecord): OpenSearchRe3Data {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    homepage: record.homepage,
    contact: record.contact,
    uri: record.uri,
    types: record.types || [],
    subjects: record.subjects || [],
    providerTypes: record.provider_types || [],
    keywords: record.keywords || [],
    access: record.access,
    pidSystem: record.pid_system || [],
    policies: record.policies || [],
    uploadTypes: record.upload_types || [],
    certificates: record.certificates || [],
    software: record.software || [],
    createdAt: record.created_at,
    updatedAt: record.updated_at,
  };
}

export class OpenSearchService {
  private client: Client;

  constructor() {
    this.client = createOpenSearchClient(awsConfig.opensearch as OpenSearchConfig);
  }

  public async findWorkByIdentifier(reference: string, context: MyContext, doi: string | null | undefined, maxResults: number): Promise<OpenSearchWork[]> {
    // If doi is empty, whitespace, null or undefined return no results
    if (!doi?.trim()) {
      return [];
    }

    // Fetch data from OpenSearch
    let response: unknown;
    try {
      response = await this.client.search({
        index: 'works-index',
        body: {
          size: maxResults,
          query: {
            ids: {
              values: [doi],
            },
          },
        },
      });
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Error fetching works with DOI ${doi} from OpenSearch domain in ${reference}`);

      throw new GraphQLError("Service temporarily unavailable", {
        extensions: {
          code: "SERVICE_UNAVAILABLE",
          service: "opensearch",
          details: "We are having trouble connecting to the search service, if the error persists please report the error."
        }
      });
    }

    // Convert response from snake case to camel case
    try {
      // Could be cleaner to use the 'camelcase-keys' package, however, it is only
      // provided as an esm module
      //
      // import camelcaseKeys from 'camelcase-keys';
      // return camelcaseKeys(hit._source, {
      //  deep: true,
      // }) as OpenSearchWork;

      const body = (response as { body: { hits: { hits: OpenSearchHit[] } } }).body;
      return body.hits.hits.map((hit: OpenSearchHit) => {
        return convertWorkToCamelCase(hit._source);
      });
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Error converting OpenSearch response into OpenSearchWorkRecord in ${reference}`);

      throw new GraphQLError("Unexpected response format from search service.", {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          service: "opensearch",
          details: "Unexpected response format from search service."
        }
      });
    }
  }

  public async findRe3Data(term: string | null | undefined, context: MyContext, subject: string | null | undefined, type: string | null | undefined, maxResults: number): Promise<OpenSearchRe3Data[]> {
    const must: Record<string, unknown>[] = [];
    const filter: Record<string, unknown>[] = [];

    if (term?.trim()) {
      must.push({
        multi_match: {
          query: term,
          fields: ['name^2', 'description', 'keywords', 'subjects', 'types', 'search_all'],
        },
      });
    } else {
      must.push({ match_all: {} });
    }

    if (subject?.trim()) {
      filter.push({
        term: { subjects: subject },
      });
    }

    if (type?.trim()) {
      filter.push({
        term: { types: type },
      });
    }

    let response: unknown;
    try {
      response = await this.client.search({
        index: 're3data',
        body: {
          size: maxResults,
          query: {
            bool: {
              must,
              filter,
            },
          },
        },
      });
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Error fetching re3data from OpenSearch`);

      throw new GraphQLError("Service temporarily unavailable", {
        extensions: {
          code: "SERVICE_UNAVAILABLE",
          service: "opensearch",
          details: "We are having trouble connecting to the search service, if the error persists please report the error."
        }
      });
    }

    try {
      const body = (response as { body: { hits: { hits: OpenSearchRe3DataHit[] } } }).body;
      return body.hits.hits.map((hit: OpenSearchRe3DataHit) => {
        return convertRe3DataToCamelCase(hit._source);
      });
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Error converting OpenSearch response into OpenSearchRe3Data`);

      throw new GraphQLError("Unexpected response format from search service.", {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          service: "opensearch",
          details: "Unexpected response format from search service."
        }
      });
    }
  }
}

// Singleton instance
const openSearchService = new OpenSearchService();

// Export wrapper for backward compatibility
export const openSearchFindWorkByIdentifier = (reference: string, context: MyContext, doi: string | null | undefined, maxResults: number) =>
  openSearchService.findWorkByIdentifier(reference, context, doi, maxResults);

export const openSearchFindRe3Data = (term: string | null | undefined, context: MyContext, subject: string | null | undefined, type: string | null | undefined, maxResults: number) =>
  openSearchService.findRe3Data(term, context, subject, type, maxResults);
