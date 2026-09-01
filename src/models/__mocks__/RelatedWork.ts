import casual from 'casual';
import { createHash } from 'node:crypto';
import { getRandomEnumValue } from '../../__tests__/helpers.js';
import { RelatedWorkSourceType, RelatedWorkStatus, WorkType } from '../RelatedWork.js';
import { ContentMatch, DoiMatch, ItemMatch } from '../../types.js';

export function getMockHash() {
  return Buffer.from(createHash('md5').update(casual.string).digest('hex'));
}

export function getMockWork() {
  return {
    doi: casual.uuid,
  };
}

export function getMockWorkVersion() {
  return {
    workId: casual.integer(1, 9999),
    hash: getMockHash(),
    workType: getRandomEnumValue(WorkType),
    publicationDate: casual.date('YYYY-MM-DD'),
    title: casual.title,
    abstractText: casual.title,
    authors: getMockList(10, getMockAuthor),
    institutions: getMockList(10, getMockInstitutionOrFunder),
    funders: getMockList(10, getMockInstitutionOrFunder),
    awards: getMockList(3, getMockAward),
    publicationVenue: casual.name,
    sourceName: casual.name,
    sourceUrl: casual.url,
  };
}

export function getMockRelatedWork() {
  return {
    planId: casual.integer(1, 9999),
    workVersionId: casual.integer(1, 9999),
    sourceType: getRandomEnumValue(RelatedWorkSourceType),
    score: 1.0,
    scoreMax: 1.0,
    status: getRandomEnumValue(RelatedWorkStatus),
    doiMatch: getMockDoiMatch(),
    contentMatch: getMockContentMatch(),
    authorMatches: getMockList(5, getMockAuthorMatch),
    institutionMatches: getMockList(5, getMockInstitutionMatch),
    funderMatches: getMockList(5, getMockFunderMatch),
    awardMatches: getMockList(5, getMockAwardMatch),
  };
}

export function getMockRelatedWorkSearchResult() {
  const score = casual.double(0, 1);
  return {
    id: casual.integer(1, 9999),
    planId: casual.integer(1, 9999),
    workVersion: {
      id: casual.integer(1, 9999),
      work: {
        id: casual.integer(1, 9999),
        doi: `https://doi.org/${casual.string}`,
        created: randomISODate(),
        createdById: casual.integer(1, 9999),
        modified: randomISODate(),
        modifiedById: casual.integer(1, 9999),
      },
      hash: Buffer.from(createHash('md5').update(casual.string).digest('hex')),
      workType: getRandomEnumValue(WorkType),
      publicationDate: casual.date('YYYY-MM-DD'),
      title: casual.title,
      abstractText: casual.title,
      authors: getMockList(10, getMockAuthor),
      institutions: getMockList(10, getMockInstitutionOrFunder),
      funders: getMockList(10, getMockInstitutionOrFunder),
      awards: getMockList(3, getMockAward),
      publicationVenue: casual.name,
      sourceName: casual.name,
      sourceUrl: casual.url,
      created: randomISODate(),
      createdById: casual.integer(1, 9999),
      modified: randomISODate(),
      modifiedById: casual.integer(1, 9999),
    },
    sourceType: getRandomEnumValue(RelatedWorkSourceType),
    score: score,
    scoreMax: 1.0,
    scoreNorm: score,
    status: getRandomEnumValue(RelatedWorkStatus),
    doiMatch: getMockDoiMatch(),
    contentMatch: getMockContentMatch(),
    authorMatches: getMockList(5, getMockAuthorMatch),
    institutionMatches: getMockList(5, getMockInstitutionMatch),
    funderMatches: getMockList(5, getMockFunderMatch),
    awardMatches: getMockList(5, getMockAwardMatch),
    created: randomISODate(),
    createdById: casual.integer(1, 9999),
    modified: randomISODate(),
    modifiedById: casual.integer(1, 9999),
  };
}

export function getMockList(maxLength: number, generatorFn) {
  const length = casual.integer(0, maxLength);
  return Array.from({ length }, () => generatorFn());
}

export function getMockAuthor() {
  const givenName = casual.first_name;
  const surname = casual.last_name;
  const middleNames = casual.first_name;

  return {
    orcid: casual.uuid,
    firstInitial: givenName.slice(0, 1),
    givenName: givenName,
    middleInitials: middleNames.slice(0, 1),
    middleNames: middleNames,
    surname: surname,
    full: `${givenName} ${surname}`,
  };
}

export function getMockInstitutionOrFunder() {
  return {
    name: casual.name,
    ror: casual.uuid,
  };
}

export function getMockAward() {
  return {
    awardId: casual.uuid,
  };
}

export function randomISODate() {
  return new Date(casual.unix_time * 1000).toISOString();
}

export function getMockDoiMatch(): DoiMatch {
  return {
    found: casual.boolean,
    score: casual.double(0, 10),
    sources: [
      {
        awardId: casual.uuid,
        awardUrl: casual.url,
      },
    ],
  };
}

export function getMockContentMatch(): ContentMatch {
  return {
    score: casual.double(0, 20),
    titleHighlight: `${casual.title} <mark>${casual.word}</mark> ${casual.word}`,
    abstractHighlights: [`An <mark>${casual.word}</mark>`],
  };
}

export function getMockAuthorMatch(): ItemMatch {
  return {
    index: casual.integer(0, 10),
    score: casual.integer(0, 2),
    fields: ['full', 'ror'],
  };
}

export function getMockInstitutionMatch(): ItemMatch {
  return {
    index: casual.integer(0, 10),
    score: casual.integer(0, 2),
    fields: ['name', 'ror'],
  };
}

export function getMockFunderMatch(): ItemMatch {
  return {
    index: casual.integer(0, 10),
    score: casual.integer(0, 2),
    fields: ['name'],
  };
}

export function getMockAwardMatch(): ItemMatch {
  return {
    index: casual.integer(0, 10),
    score: casual.double(0, 10),
  };
}

export function getMockPaginatedSearchResults(options) {
  return {
    items: options.items,
    limit: 20,
    currentOffset: 0,
    totalCount: 2,
    hasNextPage: false,
    hasPreviousPage: false,
    workTypeCounts: [],
    confidenceCounts: []
  };
}
