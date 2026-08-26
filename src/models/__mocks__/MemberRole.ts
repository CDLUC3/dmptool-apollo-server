
import casual from "casual";
import { getCurrentDate } from "../../utils/helpers.js";
import { addEntryToMockTable, addMockTableStore, clearMockTableStore, deleteEntryFromMockTable, findEntriesInMockTableByFilter, findEntryInMockTableByFilter, findEntryInMockTableById, getMockTableStore, updateEntryInMockTable } from "./MockStore";
import { MemberRole } from "../MemberRole";

export const getMemberRoleStore = () => {
  return getMockTableStore('memberRoles');
}

export const getRandomMemberRole = () => {
  const store = getMockTableStore('memberRoles');
  if (!store || store.length === 0) {
    return null;
  }
  return store[Math.floor(Math.random() * store.length)];
}

// Initialize the table
export const initMemberRoles = (count = 10) => {
  addMockTableStore('memberRoles', []);

  // Add related join tables
  addMockTableStore('projectMemberRoles', []);
  addMockTableStore('planMemberRoles', []);

  for (let i = 0; i < count; i++) {
    const tstamp = getCurrentDate();

    addEntryToMockTable('memberRoles', {
      id: casual.integer(1, 9999),
      createdById: casual.integer(1, 999),
      created: tstamp,
      modifiedById: casual.integer(1, 999),
      modified: tstamp,
      displayOrder: i,
      uri: casual.url,
      label: casual.words(2),
      description: casual.sentence,
    });
  }

  return getMemberRoleStore();
}

export const clearMemberRoles = () => {
  clearMockTableStore('memberRoles');

  // clear related join tables
  clearMockTableStore('projectMemberRoles');
  clearMockTableStore('planMemberRoles');
}

// Mock the queries
export const mockFindMemberRoleById = async (_, __, id) => {
  return findEntryInMockTableById('memberRoles', id);
};

export const mockFindMemberRoleByURL = async (_, __, uri) => {
  return findEntryInMockTableByFilter(
    'memberRoles',
    (entry) => { return entry.uri.toLowerCase().trim() === uri.toLowerCase().trim() }
  );
};

export const mockFindByProjectMemberId = async (_, __, projectMemberId) => {
  const results = findEntriesInMockTableByFilter(
    'projectMemberRoles',
    (entry) => { return entry.projectMemberId === projectMemberId }
  );

  if (Array.isArray(results)) {
    const roles = await Promise.all(results.map(async (result) =>
      await mockFindMemberRoleById(null, null, result.memberRoleId)
    ));
    return Array.isArray(roles) ? roles.map((role) => new MemberRole(role)) : [];
  }
  return [];
};

export const mockFindByPlanMemberId = async (_, __, planMemberId) => {
  const results = findEntriesInMockTableByFilter(
    'planMemberRoles',
    (entry) => { return entry.planMemberId === planMemberId }
  );
  if (Array.isArray(results)) {
    const roles = await Promise.all(results.map(async (result) =>
      await mockFindMemberRoleById(null, null, result.memberRoleId)
    ));
    return Array.isArray(roles) ? roles.map((role) => new MemberRole(role)) : [];
  }
  return [];
};

export const mockDefaultMemberRole = async (): Promise<MemberRole | null> => {
  const store = getMemberRoleStore();
  return Array.isArray(store) ? store[0] : null;
};

// Mock the mutations
export const mockInsertMemberRole = async (context, _, obj) => {
  return addEntryToMockTable('memberRoles', {
    createdById: context.token.id,
    created: getCurrentDate(),
    modifiedById: context.token.id,
    modified: getCurrentDate(),
    ...obj
  });
};

export const mockUpdateMemberRole = async (context, _, obj) => {
  return updateEntryInMockTable('memberRoles', {
    modifiedById: context.token.id,
    modified: getCurrentDate(),
    ...obj
  });
};

export const mockDeleteMemberRole = async (_, __, id) => {
  return deleteEntryFromMockTable('memberRoles', id);
};

export const mockAddMemberRoleToProjectMember = async (context, memberRoleId, projectMemberId) => {
  const memberRole = findEntryInMockTableById('memberRoles', memberRoleId);
  if (!memberRole) {
    return false; // Member role not found
  }

  const projectMemberRolesStore = getMockTableStore('projectMemberRoles');
  if (!projectMemberRolesStore) {
    return false; // Project member roles store not found
  }

  const newEntry = {
    memberRoleId,
    projectMemberId,
    createdById: context.token.id,
    modifiedById: context.token.id,
    created: getCurrentDate(),
    modified: getCurrentDate(),
  };

  projectMemberRolesStore.push(newEntry);
  return true; // Successfully added
};

export const mockRemoveMemberRoleFromProjectMember = async (_, memberRoleId, projectMemberId) => {
  const projectMemberRolesStore = getMockTableStore('projectMemberRoles');
  if (!projectMemberRolesStore) {
    return false; // Project member roles store not found
  }

  const indexToRemove = projectMemberRolesStore.findIndex(entry =>
    entry.memberRoleId === memberRoleId && entry.projectMemberId === projectMemberId
  );

  if (indexToRemove === -1) {
    return false; // Entry not found
  }

  projectMemberRolesStore.splice(indexToRemove, 1);
  return true; // Successfully removed
};

export const mockAddMemberRoleToPlanMember = async (context, memberRoleId, planMemberId) => {
  const memberRole = findEntryInMockTableById('memberRoles', memberRoleId);
  if (!memberRole) {
    return false; // member role not found
  }

  const planMemberRolesStore = getMockTableStore('planMemberRoles');
  if (!planMemberRolesStore) {
    return false; // Plan member roles store not found
  }

  const newEntry = {
    memberRoleId,
    planMemberId,
    createdById: context.token.id,
    modifiedById: context.token.id,
    created: getCurrentDate(),
    modified: getCurrentDate(),
  };

  planMemberRolesStore.push(newEntry);
  return true; // Successfully added
};

export const mockRemoveMemberRoleFromPlanMember = async (_, memberRoleId, planMemberId) => {
  const planMemberRolesStore = getMockTableStore('planMemberRoles');
  if (!planMemberRolesStore) {
    return false; // Plan member roles store not found
  }

  const indexToRemove = planMemberRolesStore.findIndex(entry =>
    entry.memberRoleId === memberRoleId && entry.planMemberId === planMemberId
  );

  if (indexToRemove === -1) {
    return false; // Entry not found
  }

  planMemberRolesStore.splice(indexToRemove, 1);
  return true; // Successfully removed
};
