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
import { getMemberRoleStore, getRandomMemberRole, initMemberRoles } from "./MemberRole.js";
import { getMockORCID } from "../../__tests__/helpers.js";
import { MyContext } from "../../context.js";
import { PlanMember, ProjectMember } from "../Member";

// Project members
// ---------------------------------------------------
export const getProjectMemberStore = () => {
  return getMockTableStore('projectMembers');
}

export const getRandomProjectMember = (): ProjectMember => {
  const store = getMockTableStore('projectMembers');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

export const clearProjectMemberStore = () => {
  clearMockTableStore('projectMembers');
}

export const generateNewProjectMember = (options) => {
  return {
    projectId: options.projectId ?? casual.integer(1, 9999),
    givenName: options.givenName ?? casual.first_name,
    surName: options.surName ?? casual.last_name,
    affiliationId: options.affiliationId ?? casual.url,
    orcid: options.orcid ?? getMockORCID(),
    email: options.email ?? casual.email,
    isPrimaryContact: options.isPrimaryContact ?? false,
    memberRoles: [getRandomMemberRole().id],
  }
}

// Initialize the table
export const initProjectMemberStore = (count = 10): ProjectMember[] => {
  addMockTableStore('projectMembers', []);

  // Since the member has an association with MemberRole, we need to make sure the MemberRole
  // table is initialized first
  const memberRoleStore = getMemberRoleStore();
  if (!memberRoleStore || memberRoleStore.length === 0) {
    initMemberRoles();
  }

  for (let i = 0; i < count; i++) {
    addEntryToMockTable('projectMembers', generateNewProjectMember({}));
  }

  return getProjectMemberStore();
}

// Mock the queries
export const mockFindProjectMemberById = async (_, __, id: number): Promise<ProjectMember> => {
  const result = findEntryInMockTableById('projectMembers', id);
  return result ? new ProjectMember(result) : null;
};

export const mockFindProjectMembersByProjectId = async (_, __, projectId: number): Promise<ProjectMember[]> => {
  const results = findEntriesInMockTableByFilter(
    'projectMembers',
    (entry) => { return entry.projectId === projectId }
  );
  return results ? results.map((entry) => { return new ProjectMember(entry) }) : [];
};

export const mockFindProjectMembersByAffiliation = async (_, __, affiliationId: string): Promise<ProjectMember[]> => {
  const results = findEntriesInMockTableByFilter(
    'projectMembers',
    (entry) => { return entry.affiliationId === affiliationId }
  );
  return results ? results.map((entry) => { return new ProjectMember(entry) }) : [];
};

export const mockFindProjectMembersByProjectAndEmail = async (
  _,
  __,
  projectId: number,
  email: string
): Promise<ProjectMember> => {
  const result = findEntryInMockTableByFilter(
    'projectMembers',
    (entry) => { return entry.projectId === projectId && entry.email.toLowerCase().trim() === email.toLowerCase().trim() }
  );
  return result ? new ProjectMember(result) : null;
};

export const mockFindProjectMembersByProjectAndORCID = async (
  _,
  __,
  projectId: number,
  orcid: string
): Promise<ProjectMember> => {
  const result = findEntryInMockTableByFilter(
    'projectMembers',
    (entry) => { return entry.projectId === projectId && entry.orcid.toLowerCase().trim() === orcid.toLowerCase().trim() }
  );
  return result ? new ProjectMember(result) : null;
};

export const mockFindProjectMembersByProjectAndName = async (
  _,
  __,
  projectId: number,
  givenName: string,
  surName: string
): Promise<ProjectMember> => {
  const result = findEntryInMockTableByFilter(
    'projectMembers',
    (entry) => {
      return entry.projectId === projectId &&
        entry.givenName.toLowerCase().trim() === givenName.toLowerCase().trim() &&
        entry.surName.toLowerCase().trim() === surName.toLowerCase().trim();
    }
  );
  return result ? new ProjectMember(result) : null;
};

export const mockFindProjectMembersByProjectAndNameOrORCIDOrEmail = async (
  _,
  __,
  projectId: number,
  givenName: string,
  surName: string,
  orcid: string,
  email: string
): Promise<ProjectMember> => {
  const result = findEntriesInMockTableByFilter(
    'projectMembers',
    (entry) => {
      return entry.projectId === projectId &&
        ((entry.givenName.toLowerCase().trim() === givenName.toLowerCase().trim() &&
          entry.surName.toLowerCase().trim() === surName.toLowerCase().trim()) ||
          entry.orcid.toLowerCase().trim() === orcid.toLowerCase().trim() ||
          entry.email.toLowerCase().trim() === email.toLowerCase().trim());
    }
  );
  return result ? new ProjectMember(result) : null;
};

// Mock the mutations
export const mockInsertProjectMember = async (context: MyContext, _, obj: ProjectMember): Promise<number> => {
  const { insertId } = addEntryToMockTable('projectMembers', {
    ...obj,
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return insertId;
};

export const mockUpdateProjectMember = async (context: MyContext, _, obj: ProjectMember): Promise<ProjectMember> => {
  const result = updateEntryInMockTable('projectMembers', {
    ...obj,
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return result ? new ProjectMember(result) : null;
};

export const mockDeleteProjectMember = async (_, __, id: number): Promise<boolean> => {
  const result = deleteEntryFromMockTable('projectMembers', id);
  return result ? true : false;
};


// Plan members
// ---------------------------------------------------
export const getPlanMemberStore = () => {
  return getMockTableStore('planMembers');
}

export const getRandomPlanMember = (): PlanMember => {
  const store = getMockTableStore('planMembers');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

export const clearPlanMemberStore = () => {
  clearMockTableStore('planMembers');
}

export const generateNewPlanMember = (options) => {
  return {
    planId: options.projectId ?? casual.integer(1, 9999),
    projectMemberId: options.projectMemberId ?? casual.integer(1, 9999),
    memberRoles: [getRandomMemberRole().id],
    isPrimaryContact: options.isPrimaryContact ?? false,
  }
}

// Initialize the table
export const initPlanMemberStore = (count = 10): PlanMember[] => {
  addMockTableStore('planMembers', []);

  // Since the member has an association with MemberRole, we need to make sure the MemberRole
  // table is initialized first
  const memberRoleStore = getMemberRoleStore();
  if (!memberRoleStore || memberRoleStore.length === 0) {
    initMemberRoles();
  }

  for (let i = 0; i < count; i++) {
    addEntryToMockTable('planMembers', generateNewPlanMember({}));
  }

  return getPlanMemberStore();
}

// Mock the queries
export const mockFindPlanMemberById = async (_, __, id: number): Promise<PlanMember> => {
  const result = findEntryInMockTableById('planMembers', id);
  return result ? new PlanMember(result) : null;
};

export const mockFindPlanMembersByProjectMemberId = async (_, __, projectMemberId: number): Promise<PlanMember[]> => {
  const results = findEntriesInMockTableByFilter(
    'planMembers',
    (entry) => { return entry.projectMemberId === projectMemberId }
  );
  return Array.isArray(results) ? results.map((result) => new PlanMember(result)) : [];
};

export const mockFindPlanMembersByPlanId = async (_, __, planId: number): Promise<PlanMember[]> => {
  const results = findEntriesInMockTableByFilter(
    'planMembers',
    (entry) => { return entry.planId === planId }
  );
  return Array.isArray(results) ? results.map((result) => new PlanMember(result)) : [];
};

// Mock the mutations
export const mockInsertPlanMember = async (context: MyContext, _, obj: PlanMember): Promise<number> => {
  const { insertId } = addEntryToMockTable('planMembers', {
    ...obj,
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return insertId;
};

export const mockUpdatePlanMember = async (context: MyContext, _, obj: PlanMember): Promise<PlanMember> => {
  const result = updateEntryInMockTable('planMembers', {
    ...obj,
    modifiedById: context.token.id,
    modified: getCurrentDate(),
  });
  return result ? new PlanMember(result) : null;
};

export const mockDeletePlanMember = async (_, __, id: number): Promise<boolean> => {
  const result = deleteEntryFromMockTable('planMembers', id);
  return result ? true : false;
};
