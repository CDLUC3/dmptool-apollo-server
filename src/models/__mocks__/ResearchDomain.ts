import casual from "casual";
import {
  addEntryToMockTable,
  addMockTableStore,
  clearMockTableStore,
  deleteEntryFromMockTable,
  findEntriesInMockTableByFilter,
  findEntryInMockTableByFilter,
  findEntryInMockTableById,
  getMockTableStore,
  updateEntryInMockTable
} from "./MockStore.js";
import { getCurrentDate } from "../../utils/helpers.js";
import { ResearchDomain } from "../ResearchDomain.js";
import { MyContext } from "../../context.js";

export const getResearchDomainStore = () => {
  return getMockTableStore('researchDomains');
}

export const getRandomResearchDomain = (): ResearchDomain => {
  const store = getMockTableStore('researchDomains');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

export const clearResearchDomainStore = () => {
  clearMockTableStore('researchDomains');
}

export const generateNewResearchDomain = (options) => {
  return {
    name: options.name ?? casual.sentence,
    uri: options.uri ?? casual.url,
    description: options.description ?? casual.sentences(2),
  }
}

// Initialize the table
export const initResearchDomainStore = (count = 10): ResearchDomain[] => {
  addMockTableStore('researchDomains', []);

  for (let i = 0; i < count; i++) {
    addEntryToMockTable('researchDomains', generateNewResearchDomain({}));
  }

  return getResearchDomainStore();
}

// Mock the queries
export const mockFindResearchDomainById = async (_, __, id: number): Promise<ResearchDomain> => {
  const result = findEntryInMockTableById('researchDomains', id);
  return result ? new ResearchDomain(result) : null;
};

export const mockFindResearchDomainByURI = async (_, __, uri: string): Promise<ResearchDomain> => {
  const result = findEntryInMockTableByFilter(
    'researchDomains',
    (entry) => { return entry.uri.toLowerCase().trim() === uri.toLowerCase().trim() }
  );
  return result ? new ResearchDomain(result) : null;
};

export const mockFindResearchDomainsByName = async (_, __, name: string): Promise<ResearchDomain[]> => {
  // Filter the researchDomains based on the search term
  const results = findEntriesInMockTableByFilter(
    'researchDomains',
    (entry) => { return entry.name.toLowerCase().trim() === name.toLowerCase().trim() }
  );
  return results ? results.map((entry) => { return new ResearchDomain(entry) }) : [];
};

// Mock the mutations
export const mockInsertResearchDomain = async (context: MyContext, _, obj: ResearchDomain): Promise<number> => {
  const { insertId } = addEntryToMockTable('researchDomains', {
    ...obj,
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return insertId;
};

export const mockUpdateResearchDomain = async (context: MyContext, _, obj: ResearchDomain): Promise<ResearchDomain> => {
  const result = updateEntryInMockTable('researchDomains', {
    ...obj,
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return result ? new ResearchDomain(result) : null;
};

export const mockDeleteResearchDomain = async (_, __, id: number): Promise<boolean> => {
  const result = deleteEntryFromMockTable('researchDomains', id);
  return result ? true : false;
};
