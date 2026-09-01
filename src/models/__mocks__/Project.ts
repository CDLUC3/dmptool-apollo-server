
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
import { Project } from "../Project.js";
import { MyContext } from "../../context.js";

export const getProjectStore = () => {
  return getMockTableStore('projects');
}

export const getRandomProject = (): Project => {
  const store = getMockTableStore('projects');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

export const clearProjectStore = () => {
  clearMockTableStore('projects');
}

export const generateNewProject = (options) => {
  return {
    title: options.title ?? casual.sentence,
    abstractText: options.abstractText ?? casual.sentences(4),
    startDate: options.startDate ?? '2024-12-13',
    endDate: options.endDate ?? '2026-01-21',
    researchDomainId: options.researchDomainId ?? casual.integer(1, 99),
    isTestProject: options.isTestProject ?? casual.boolean,
  }
}

// Initialize the table
export const initProjectStore = (count = 10): Project[] => {
  addMockTableStore('projects', []);

  for (let i = 0; i < count; i++) {
    addEntryToMockTable('projects', generateNewProject({}));
  }

  return getProjectStore();
}

// Mock the queries
export const mockFindProjectById = async (_, __, id: number): Promise<Project> => {
  const result = findEntryInMockTableById('projects', id);
  return result ? new Project(result) : null;
};

export const mockFindProjectByDMPId = async (_, __, dmpId: string): Promise<Project> => {
  const result = findEntryInMockTableByFilter(
    'projects',
    (entry) => { return entry.dmpId.toLowerCase().trim() === dmpId.toLowerCase().trim() }
  );
  return result ? new Project(result) : null;
};

export const mockFindProjectsByProjectId = async (_, { projectId }: { projectId: number }): Promise<Project[]> => {
  // Filter the projects based on the search term
  const results = findEntriesInMockTableByFilter(
    'projects',
    (entry) => { return entry.projectId === projectId }
  );
  return results ? results.map((entry) => { return new Project(entry) }) : [];
};

// Mock the mutations
export const mockInsertProject = async (context: MyContext, _, obj: Project): Promise<number> => {
  const { insertId } = addEntryToMockTable('projects', {
    ...obj,
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return insertId;
};

export const mockUpdateProject = async (context: MyContext, _, obj: Project): Promise<Project> => {
  const result = updateEntryInMockTable('projects', {
    ...obj,
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return result ? new Project(result) : null;
};

export const mockDeleteProject = async (_, __, id: number): Promise<boolean> => {
  const result = deleteEntryFromMockTable('projects', id);
  return result ? true : false;
};
