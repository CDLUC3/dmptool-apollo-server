import casual from "casual";
import { getCurrentDate } from "../../utils/helpers.js";
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
import { MyContext } from "../../context.js";
import { PlanFunding, ProjectFunding, ProjectFundingStatus } from "../Funding.js";
import { getRandomEnumValue } from "../../__tests__/helpers.js";

// Project fundings
// ---------------------------------------------------
export const getProjectFundingStore = () => {
  return getMockTableStore('projectFundings');
}

export const getRandomProjectFunding = (): ProjectFunding => {
  const store = getMockTableStore('projectFundings');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

export const clearProjectFundingStore = () => {
  clearMockTableStore('projectFundings');
}

export const generateNewProjectFunding = (options) => {
  return {
    projectId: options.projectId ?? casual.integer(1, 9999),
    affiliationId: options.affiliationId ?? casual.url,
    status: options.status ?? getRandomEnumValue(ProjectFundingStatus),
    funderOpportunityNumber: options.funderOpportunityNumber ?? casual.uuid,
    funderProjectNumber: options.funderProjectNumber ?? casual.uuid,
    grantId: options.grantId ?? casual.url,
  }
}

// Initialize the table
export const initProjectFundingStore = (count = 10): ProjectFunding[] => {
  addMockTableStore('projectFundings', []);

  for (let i = 0; i < count; i++) {
    addEntryToMockTable('projectFundings', generateNewProjectFunding({}));
  }

  return getProjectFundingStore();
}

// Mock the queries
export const mockFindProjectFundingById = async (_, __, id: number): Promise<ProjectFunding> => {
  const result = findEntryInMockTableById('projectFundings', id);
  return result ? new ProjectFunding(result) : null;
};

export const mockFindProjectFundingsByProjectId = async (_, __, projectId: number): Promise<ProjectFunding[]> => {
  const results = findEntriesInMockTableByFilter(
    'projectFundings',
    (entry) => { return entry.projectId === projectId }
  );
  return results ? results.map((entry) => { return new ProjectFunding(entry) }) : [];
};

export const mockFindProjectFundingsByAffiliation = async (_, __, affiliationId: string): Promise<ProjectFunding[]> => {
  const results = findEntriesInMockTableByFilter(
    'projectFundings',
    (entry) => { return entry.affiliationId === affiliationId }
  );
  return results ? results.map((entry) => { return new ProjectFunding(entry) }) : [];
};

export const mockFindProjectFundingsByProjectAndAffiliation = async (
  _,
  __,
  projectId: number,
  affiliationId: string
): Promise<ProjectFunding> => {
  const result = findEntryInMockTableByFilter(
    'projectFundings',
    (entry) => { return entry.projectId === projectId && entry.affiliationId === affiliationId }
  );
  return result ? new ProjectFunding(result) : null;
};

// Mock the mutations
export const mockInsertProjectFunding = async (context: MyContext, _, obj: ProjectFunding): Promise<number> => {
  const { insertId } = addEntryToMockTable('projectFundings', {
    ...obj,
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return insertId;
};

export const mockUpdateProjectFunding = async (context: MyContext, _, obj: ProjectFunding): Promise<ProjectFunding> => {
  const result = updateEntryInMockTable('projectFundings', {
    ...obj,
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return result ? new ProjectFunding(result) : null;
};

export const mockDeleteProjectFunding = async (_, __, id: number): Promise<boolean> => {
  const result = deleteEntryFromMockTable('projectFundings', id);
  return result ? true : false;
};


// Plan fundings
// ---------------------------------------------------
export const getPlanFundingStore = () => {
  return getMockTableStore('planFundings');
}

export const getRandomPlanFunding = (): PlanFunding => {
  const store = getMockTableStore('planFundings');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

export const clearPlanFundingStore = () => {
  clearMockTableStore('planFundings');
}

export const generateNewPlanFunding = (options) => {
  return {
    planId: options.planId ?? casual.integer(1, 9999),
    projectFundingId: options.projectFundingId ?? casual.integer(1, 9999),
  }
}

// Initialize the table
export const initPlanFundingStore = (count = 10): PlanFunding[] => {
  addMockTableStore('planFundings', []);

  for (let i = 0; i < count; i++) {
    addEntryToMockTable('planFundings', generateNewPlanFunding({}));
  }

  return getPlanFundingStore();
}

// Mock the queries
export const mockFindPlanFundingById = async (_, __, id: number): Promise<PlanFunding> => {
  const result = findEntryInMockTableById('planFundings', id);
  return result ? new PlanFunding(result) : null;
};

export const mockFindPlanFundingsByProjectFundingId = async (_, __, projectFundingId: number): Promise<PlanFunding> => {
  const result = findEntriesInMockTableByFilter(
    'planFundings',
    (entry) => { return entry.projectFundingId === projectFundingId }
  );
  return result ? new PlanFunding(result) : null;
};

export const mockFindPlanFundingsByPlanId = async (_, __, planId: number): Promise<PlanFunding> => {
  const result = findEntriesInMockTableByFilter(
    'planFundings',
    (entry) => { return entry.planId === planId }
  );
  return result ? new PlanFunding(result) : null;
};

// Mock the mutations
export const mockInsertPlanFunding = async (context: MyContext, _, obj: PlanFunding): Promise<number> => {
  const { insertId } = addEntryToMockTable('planFundings', {
    ...obj,
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return insertId;
};

export const mockUpdatePlanFunding = async (context: MyContext, _, obj: PlanFunding): Promise<PlanFunding> => {
  const result = updateEntryInMockTable('planFundings', {
    ...obj,
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return result ? new PlanFunding(result) : null;
};

export const mockDeletePlanFunding = async (_, __, id: number): Promise<boolean> => {
  const result = deleteEntryFromMockTable('planFundings', id);
  return result ? true : false;
};
