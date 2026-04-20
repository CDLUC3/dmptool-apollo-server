
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
} from "./MockStore";
import { getCurrentDate } from "../../utils/helpers";
import { getMockDMPId, getRandomEnumValue } from "../../__tests__/helpers";
import { Plan, PlanSearchResult, PlanStatus, PlanVisibility } from "../Plan";
import { supportedLanguages } from "../Language";
import { MyContext } from "../../context";

export const getPlanStore = () => {
  return getMockTableStore('plans');
}

export const getRandomPlan = (): Plan => {
  const store = getMockTableStore('plans');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

export const clearPlanStore = () => {
  clearMockTableStore('plans');
}

export const generateNewPlan = (options) => {
  return {
    projectId: options.projectId ?? casual.integer(1, 9999),
    versionedTemplateId: options.versionedTemplateId ?? casual.integer(1, 9999),
    title: options.title ?? casual.sentence,
    status: options.status ?? getRandomEnumValue(PlanStatus),
    visibility: options.visibility ?? getRandomEnumValue(PlanVisibility),
    dmpId: options.dmpId ?? getMockDMPId(),
    registered: options.registered ?? casual.date('YYYY-MM-DD'),
    registeredById: options.registeredById ?? casual.integer(1, 9999),
    languageId: options.languageId ?? supportedLanguages[Math.floor(Math.random() * supportedLanguages.length)].id,
    featured: options.featured ?? casual.boolean,
  }
}

// Converts a Mock Store Plan into a PlanSearchResult. Note that some data is mocked
// because we do not have access to the other stores here
const planToPlanSearchResult = (plan: Plan): PlanSearchResult => {
  return {
    id: plan.id,
    createdBy: casual.full_name,
    created: plan.created,
    modifiedBy: casual.full_name,
    modified: plan.modified,
    title: plan.title,
    status: plan.status,
    visibility: plan.visibility,
    dmpId: plan.dmpId,
    registeredBy: casual.full_name,
    registered: plan.registered,
    featured: plan.featured,
    funding: casual.company_name,
    members: casual.full_name,
    templateTitle: casual.title,
    versionedTemplateId: plan.versionedTemplateId,
  }
}

// Initialize the table
export const initPlanStore = (count = 10): Plan[] => {
  addMockTableStore('plans', []);

  for (let i = 0; i < count; i++) {
    addEntryToMockTable('plans', generateNewPlan({}));
  }

  return getPlanStore();
}

// Mock the queries
export const mockFindPlanById = async (_, __, id: number): Promise<Plan> => {
  const result = findEntryInMockTableById('plans', id);
  return result ? new Plan(result) : null;
};

export const mockFindPlanByDMPId = async (_, __, dmpId: string): Promise<Plan> => {
  const result = findEntryInMockTableByFilter(
    'plans',
    (entry) => { return entry.dmpId.toLowerCase().trim() === dmpId.toLowerCase().trim() }
  );
  return result ? new Plan(result) : null;
};

// Mock the PlanSearchResult query
export const mockFindPlanSearchResultsByProjectId = async (_, __, projectId: number): Promise<PlanSearchResult[]> => {
  // Filter the plans based on the search term
  const results = findEntriesInMockTableByFilter(
    'plans',
    (entry) => { return entry.projectId === projectId }
  );
  return results ? results.map((entry) => { return planToPlanSearchResult(new Plan(entry)) }) : [];
};

export const mockFindPlansByProjectId = async (_, __, projectId: number): Promise<Plan[]> => {
  // Filter the plans based on the search term
  const results = findEntriesInMockTableByFilter(
    'plans',
    (entry) => { return entry.projectId === projectId }
  );
  return results ? results.map((entry) => { return new Plan(entry) }) : [];
};

// Mock the PlanSearchResult query
export const mockPlanSearchResultFindByProjectId = async (_, __, projectId: number): Promise<Plan[]> => {
  // Filter the plans based on the search term
  const results = findEntriesInMockTableByFilter(
    'plans',
    (entry) => { return entry.projectId === projectId }
  );
  return results ? results.map((entry) => { return new PlanSearchResult(entry) }) : [];
};

// Mock the mutations
export const mockInsertPlan = async (context: MyContext, _, obj: Plan): Promise<number> => {
  const { insertId } = addEntryToMockTable('plans', {
    ...obj,
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return insertId;
};

export const mockUpdatePlan = async (context: MyContext, _, obj: Plan): Promise<Plan> => {
  const result = updateEntryInMockTable('plans', {
    ...obj,
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return result ? new Plan(result) : null;
};

export const mockDeletePlan = async (_, __, id: number): Promise<boolean> => {
  const result = deleteEntryFromMockTable('plans', id);
  return result ? true : false;
};
