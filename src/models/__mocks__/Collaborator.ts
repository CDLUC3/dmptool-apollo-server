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
} from "./MockStore";
import { ProjectCollaborator, TemplateCollaborator } from "../Collaborator.js";
import { MyContext } from "../../context.js";

// Template Collaborator
// ---------------------------------------------------
export const getTemplateCollaboratorStore = () => {
  return getMockTableStore('templateCollaborators');
}

export const getRandomTemplateCollaborator = (): TemplateCollaborator => {
  const store = getMockTableStore('templateCollaborators');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

export const clearTemplateCollaboratorsStore = () => {
  clearMockTableStore('templateCollaborators');
}

export const generateNewTemplateCollaborators = (options) => {
  return {
    templateId: options.templateId ?? casual.integer(1, 9999),
    email: options.email ?? casual.email,
    invitedById: options.invitedById ?? casual.integer(1, 9999),
    // Sometimes the userId is null for example if the user has not accepted the invitation yet
    userId: options.userId ?? Math.random() < 0.5 ? null : casual.integer(1, 9999),
  };
}

// Initialize the table
export const initTemplateCollaboratorsStore = (count = 10): TemplateCollaborator[] => {
  addMockTableStore('templateCollaborators', []);

  for (let i = 0; i < count; i++) {
    addEntryToMockTable('templateCollaborators', generateNewTemplateCollaborators({}));
  }

  return getTemplateCollaboratorStore();
}

// Mock the queries
export const mockFindTemplateCollaboratorById = async (_, __, id: number): Promise<TemplateCollaborator> => {
  const result = findEntryInMockTableById('templateCollaborators', id);
  return result ? new TemplateCollaborator(result) : null;
};

export const mockFindTemplateCollaboratorsByInviterId = async (_, __, invitedById: number): Promise<TemplateCollaborator[]> => {
  const results = findEntriesInMockTableByFilter(
    'templateCollaborators',
    (entry) => { return entry.invitedById === invitedById }
  );
  return results ? results.map((entry) => { return new TemplateCollaborator(entry) }) : [];
};

export const mockFindTemplateCollaboratorsByEmail = async (_, __, email: string): Promise<TemplateCollaborator[]> => {
  const results = findEntriesInMockTableByFilter(
    'templateCollaborators',
    (entry) => { return entry.email.toLowerCase().trim() === email.toLowerCase().trim() }
  );
  return results ? results.map((entry) => { return new TemplateCollaborator(entry) }) : [];
};

export const mockFindTemplateCollaboratorByTemplateIdAndEmail = async (_, __, templateId: number, email: string): Promise<TemplateCollaborator> => {
  const result = findEntryInMockTableByFilter(
    'templateCollaborators',
    (entry) => {
      return entry.templateId === templateId && entry.email.toLowerCase().trim() === email.toLowerCase().trim()
    }
  );
  return result ? new TemplateCollaborator(result) : null;
};

export const mockFindTemplateCollaboratorByTemplateId = async (_, __, templateId: number): Promise<TemplateCollaborator[]> => {
  const results = findEntriesInMockTableByFilter(
    'templateCollaborators',
    (entry) => { return entry.templateId === templateId }
  );
  return results ? results.map((entry) => { return new TemplateCollaborator(entry) }) : [];
};

// Mock the mutations
export const mockInsertTemplateCollaborators = async (context: MyContext, _, obj: TemplateCollaborator): Promise<number> => {
  const { insertId } = addEntryToMockTable('templateCollaborators', {
    ...obj,
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return insertId;
};

export const mockUpdateTemplateCollaborators = async (context: MyContext, _, obj: TemplateCollaborator): Promise<TemplateCollaborator> => {
  const result = updateEntryInMockTable('templateCollaborators', {
    ...obj,
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return result ? new TemplateCollaborator(result) : null;
};

export const mockDeleteTemplateCollaborators = async (_, __, id: number): Promise<boolean> => {
  const result = deleteEntryFromMockTable('templateCollaborators', id);
  return result ? true : false;
};


// Project Collaborator
// ---------------------------------------------------
export const getProjectCollaboratorStore = () => {
  return getMockTableStore('projectCollaborators');
}

export const getRandomProjectCollaborator = (): ProjectCollaborator => {
  const store = getMockTableStore('projectCollaborators');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

export const clearProjectCollaboratorsStore = () => {
  clearMockTableStore('projectCollaborators');
}

export const generateNewProjectCollaborators = (options) => {
  return {
    templateId: options.templateId ?? casual.integer(1, 9999),
    email: options.email ?? casual.email,
    invitedById: options.invitedById ?? casual.integer(1, 9999),
    // Sometimes the userId is null for example if the user has not accepted the invitation yet
    userId: options.userId ?? Math.random() < 0.5 ? null : casual.integer(1, 9999),
  };
}

// Initialize the table
export const initProjectCollaboratorsStore = (count = 10): ProjectCollaborator[] => {
  addMockTableStore('projectCollaborators', []);

  for (let i = 0; i < count; i++) {
    addEntryToMockTable('projectCollaborators', generateNewProjectCollaborators({}));
  }

  return getProjectCollaboratorStore();
}

// Mock the queries
export const mockFindProjectCollaboratorById = async (_, __, id: number): Promise<ProjectCollaborator> => {
  const result = findEntryInMockTableById('projectCollaborators', id);
  return result ? new ProjectCollaborator(result) : null;
};

export const mockFindProjectCollaboratorsByInviterId = async (_, __, invitedById: number): Promise<ProjectCollaborator[]> => {
  const results = findEntriesInMockTableByFilter(
    'projectCollaborators',
    (entry) => { return entry.invitedById === invitedById }
  );
  return results ? results.map((entry) => { return new ProjectCollaborator(entry) }) : [];
};

export const mockFindProjectCollaboratorsByEmail = async (_, __, email: string): Promise<ProjectCollaborator[]> => {
  const results = findEntriesInMockTableByFilter(
    'projectCollaborators',
    (entry) => { return entry.email.toLowerCase().trim() === email.toLowerCase().trim() }
  );
  return results ? results.map((entry) => { return new ProjectCollaborator(entry) }) : [];
};

export const mockFindProjectCollaboratorByProjectIdAndEmail = async (_, __, templateId: number, email: string): Promise<ProjectCollaborator> => {
  const result = findEntryInMockTableByFilter(
    'projectCollaborators',
    (entry) => {
      return entry.templateId === templateId && entry.email.toLowerCase().trim() === email.toLowerCase().trim()
    }
  );
  return result ? new ProjectCollaborator(result) : null;
};

export const mockFindProjectCollaboratorByProjectId = async (_, __, projectId: number): Promise<ProjectCollaborator[]> => {
  const results = findEntriesInMockTableByFilter(
    'projectCollaborators',
    (entry) => { return entry.projectId === projectId }
  );
  return results ? results.map((entry) => { return new ProjectCollaborator(entry) }) : [];
};

// Mock the mutations
export const mockInsertProjectCollaborators = async (context: MyContext, _, obj: ProjectCollaborator): Promise<number> => {
  const { insertId } = addEntryToMockTable('projectCollaborators', {
    ...obj,
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return insertId;
};

export const mockUpdateProjectCollaborators = async (context: MyContext, _, obj: ProjectCollaborator): Promise<ProjectCollaborator> => {
  const result = updateEntryInMockTable('projectCollaborators', {
    ...obj,
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return result ? new ProjectCollaborator(result) : null;
};

export const mockDeleteProjectCollaborators = async (_, __, id: number): Promise<boolean> => {
  const result = deleteEntryFromMockTable('projectCollaborators', id);
  return result ? true : false;
};