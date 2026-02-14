import { Client } from "@opensearch-project/opensearch";
import { MyContext } from '../context';
import { OpenSearchWork, WorkType } from '../types';
import { awsConfig } from '../config/awsConfig';
import { prepareObjectForLogs } from '../logger';
import { createOpenSearchClient, OpenSearchConfig } from "../datasources/openSearch";
import {
  OpenSearchRe3DataRecord,
  Re3DataRepositoryRecord,
  convertRe3DataToCamelCase,
} from '../types/repository';
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

interface OpenSearchRe3DataHit {
  _source: OpenSearchRe3DataRecord;
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

  public async findRe3Data(term: string | null | undefined, context: MyContext, subjects: string[] | null | undefined, repositoryType: string | null | undefined, maxResults: number): Promise<Re3DataRepositoryRecord[]> {
    const must: Record<string, unknown>[] = [];
    const filter: Record<string, unknown>[] = [];

    if (term?.trim()) {
      must.push({
        multi_match: {
          query: term,
          fields: ['name^2', 'description', 'keywords', 'subjects', 'repositoryTypes', 'search_all'],
        },
      });
    } else {
      must.push({ match_all: {} });
    }

    // Handle multiple subjects: match repositories that have ANY of the provided subjects
    if (subjects && subjects.length > 0) {
      const validSubjects = subjects.filter(s => s?.trim());
      if (validSubjects.length > 0) {
        filter.push({
          terms: { subjects: validSubjects },
        });
      }
    }

    // Handle repository type: must match exactly
    if (repositoryType?.trim()) {
      filter.push({
        term: { repositoryTypes: repositoryType },
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

  public async findRe3DataByURIs(context: MyContext, uris: string[]): Promise<Re3DataRepositoryRecord[]> {
    // If no URIs provided, return empty array
    if (!uris || uris.length === 0) {
      return [];
    }

    let response: unknown;
    try {
      response = await this.client.search({
        index: 're3data',
        body: {
          size: uris.length,
          query: {
            terms: {
              uri: uris,
            },
          },
        },
      });
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Error fetching re3data repositories by URIs from OpenSearch`);

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
      context.logger.error(prepareObjectForLogs(err), `Error converting OpenSearch response for re3data by URIs`);

      throw new GraphQLError("Unexpected response format from search service.", {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          service: "opensearch",
          details: "Unexpected response format from search service."
        }
      });
    }
  }

  public async findRe3DataSubjects(context: MyContext, includeCount: boolean, maxResults: number): Promise<{ subject: string; count?: number }[]> {
    let response: unknown;
    try {
      const body = includeCount
        ? {
          size: 0,
          aggs: {
            unique_subjects: {
              terms: {
                field: 'subjects',
                size: maxResults,
              },
            },
          },
        }
        : {
          size: 0,
          aggs: {
            unique_subjects: {
              terms: {
                field: 'subjects',
                size: maxResults,
              },
            },
          },
        };

      response = await this.client.search({
        index: 're3data',
        body,
      });
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Error fetching re3data subjects from OpenSearch`);

      throw new GraphQLError("Service temporarily unavailable", {
        extensions: {
          code: "SERVICE_UNAVAILABLE",
          service: "opensearch",
          details: "We are having trouble connecting to the search service, if the error persists please report the error."
        }
      });
    }

    try {
      interface AggregationBucket {
        key: string;
        doc_count: number;
      }
      const aggs = (response as { body: { aggregations: { unique_subjects: { buckets: AggregationBucket[] } } } }).body.aggregations;
      return aggs.unique_subjects.buckets.map((bucket: AggregationBucket) => {
        if (includeCount) {
          return { subject: bucket.key, count: bucket.doc_count };
        }
        return { subject: bucket.key };
      });
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Error converting OpenSearch aggregation response for re3data subjects`);

      throw new GraphQLError("Unexpected response format from search service.", {
        extensions: {
          code: "INTERNAL_SERVER_ERROR",
          service: "opensearch",
          details: "Unexpected response format from search service."
        }
      });
    }
  }

  public async findRe3DataRepositoryTypes(context: MyContext, includeCount: boolean, maxResults: number): Promise<{ type: string; count?: number }[]> {
    let response: unknown;
    try {
      const body = {
        size: 0,
        aggs: {
          unique_types: {
            terms: {
              field: 'repositoryTypes',
              size: maxResults,
            },
          },
        },
      };

      response = await this.client.search({
        index: 're3data',
        body,
      });
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Error fetching re3data repository types from OpenSearch`);

      throw new GraphQLError("Service temporarily unavailable", {
        extensions: {
          code: "SERVICE_UNAVAILABLE",
          service: "opensearch",
          details: "We are having trouble connecting to the search service, if the error persists please report the error."
        }
      });
    }

    try {
      interface AggregationBucket {
        key: string;
        doc_count: number;
      }
      const aggs = (response as { body: { aggregations: { unique_types: { buckets: AggregationBucket[] } } } }).body.aggregations;
      return aggs.unique_types.buckets.map((bucket: AggregationBucket) => {
        if (includeCount) {
          return { type: bucket.key, count: bucket.doc_count };
        }
        return { type: bucket.key };
      });
    } catch (err) {
      context.logger.error(prepareObjectForLogs(err), `Error converting OpenSearch aggregation response for re3data repository types`);

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

export const openSearchFindRe3Data = (term: string | null | undefined, context: MyContext, subjects: string[] | null | undefined, repositoryType: string | null | undefined, maxResults: number) =>
  openSearchService.findRe3Data(term, context, subjects, repositoryType, maxResults);

export const openSearchFindRe3DataByURIs = (context: MyContext, uris: string[]) =>
  openSearchService.findRe3DataByURIs(context, uris);

export const openSearchFindRe3DataSubjects = (context: MyContext, includeCount: boolean, maxResults: number) =>
  openSearchService.findRe3DataSubjects(context, includeCount, maxResults);

export const openSearchFindRe3DataRepositoryTypes = (context: MyContext, includeCount: boolean, maxResults: number) =>
  openSearchService.findRe3DataRepositoryTypes(context, includeCount, maxResults);

