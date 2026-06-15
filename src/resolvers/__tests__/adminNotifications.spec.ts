/* eslint-disable @typescript-eslint/no-explicit-any */
import casual from "casual";

jest.mock('../../services/authService', () => ({
  ...jest.requireActual('../../services/authService'),
  authenticatedResolver: jest.fn((ref, level, resolver) => resolver),
  isSuperAdmin: jest.fn().mockReturnValue(false),
  isAdmin: jest.fn().mockReturnValue(true),
}));

import { ApolloServer } from "@apollo/server";
import { typeDefs } from "../../schema";
import { resolvers } from '../../resolver';
import { logger } from "../../logger";
import { JWTAccessToken } from "../../services/tokenService";
import { UserRole } from "../../models/User";
import { buildContext, mockToken } from "../../__mocks__/context";
import { AdminNotificationResults, AdminNotification } from "../../models/AdminNotifications";
import { Plan } from "../../models/Plan";
import { Template } from "../../models/Template";
import { TemplateCustomization } from "../../models/TemplateCustomization";
import { PlanFeedback } from "../../models/PlanFeedback";
import { User } from "../../models/User";
import { isSuperAdmin, isAdmin } from '../../services/authService';

jest.mock('../../context.ts');
jest.mock('../../datasources/cache');

jest.mock('../../models/AdminNotifications', () => ({
  AdminNotificationResults: {
    findReadByUserId: jest.fn(),
    findUnreadByUserId: jest.fn(),
    findByUserId: jest.fn(),
  },
  AdminNotification: Object.assign(
    jest.fn().mockImplementation(() => ({
      create: jest.fn(),
      markAsRead: jest.fn(),
      markAsUnRead: jest.fn(),
      addError: jest.fn(),
      errors: {},
    })),
    {
      findById: jest.fn(),
    }
  ),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

let testServer: ApolloServer;
let adminToken: JWTAccessToken;
let superAdminToken: JWTAccessToken;
let researcherToken: JWTAccessToken;
let affiliationId: string;

async function executeQuery(
  query: string,
  variables: any,
  token: JWTAccessToken
): Promise<any> {
  const context = buildContext(logger, token, null);
  return await testServer.executeOperation(
    { query, variables },
    { contextValue: context }
  );
}

function buildMockNotification(overrides = {}) {
  return {
    id: casual.integer(1, 999),
    notificationType: 'FEEDBACK_REQUESTED',
    affiliationId: casual.url,
    metadata: { planId: casual.integer(1, 999) },
    isRead: false,
    createdById: casual.integer(1, 999),
    created: new Date().toISOString(),
    modified: new Date().toISOString(),
    errors: {},
    ...overrides,
  };
}

function buildPaginatedResult(items: any[], totalCount = items.length) {
  return {
    items,
    totalCount,
    hasNextPage: false,
    hasPreviousPage: false,
    nextCursor: null,
    currentOffset: 0,
  };
}

beforeEach(async () => {
  jest.resetAllMocks();

  testServer = new ApolloServer({ typeDefs, resolvers });

  affiliationId = casual.url;

  adminToken = await mockToken();
  adminToken.affiliationId = affiliationId;
  adminToken.role = UserRole.ADMIN;

  superAdminToken = await mockToken();
  superAdminToken.role = UserRole.SUPERADMIN;

  researcherToken = await mockToken();
  researcherToken.role = UserRole.RESEARCHER;

  // Spy on chained resolver model methods — use spyOn to keep real constructors intact
  jest.spyOn(Plan, 'findById').mockResolvedValue(null);
  jest.spyOn(Template, 'findById').mockResolvedValue(null);
  jest.spyOn(TemplateCustomization, 'findByIdWithTemplateName').mockResolvedValue(null);
  jest.spyOn(PlanFeedback, 'findByPlanId').mockResolvedValue([]);
  jest.spyOn(User, 'findById').mockResolvedValue(null);
});

afterEach(() => {
  jest.clearAllMocks();
  jest.restoreAllMocks();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('adminNotification resolver', () => {

  // ─── Queries ───────────────────────────────────────────────────────────────

  describe('Query.adminNotificationsUnread', () => {
    const query = `
      query adminNotificationsUnread($paginationOptions: PaginationOptions) {
        adminNotificationsUnread(paginationOptions: $paginationOptions) {
          totalCount
          hasNextPage
          items {
            id
            notificationType
            isRead
          }
        }
      }
    `;

    it('should return unread notifications for an admin', async () => {
      const mockNotification = buildMockNotification({ isRead: false });
      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.totalCount).toBe(1);
      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].isRead).toBe(false);
      expect(AdminNotificationResults.findUnreadByUserId).toHaveBeenCalledWith(
        'unreadAdminNotifications resolver',
        expect.any(Object),
        adminToken.id,
        undefined
      );
    });

    it('should return an InternalServerError when the query throws', async () => {
      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockRejectedValue(
        new Error('DB failure')
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('DB failure');
    });
  });

  describe('Query.adminNotificationsRead', () => {
    const query = `
      query adminNotificationsRead($paginationOptions: PaginationOptions) {
        adminNotificationsRead(paginationOptions: $paginationOptions) {
          totalCount
          hasNextPage
          items {
            id
            notificationType
            isRead
          }
        }
      }
    `;

    it('should return read notifications for an admin', async () => {
      const mockNotification = buildMockNotification({ isRead: true });
      (AdminNotificationResults.findReadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsRead.totalCount).toBe(1);
      expect(result.body.singleResult.data.adminNotificationsRead.items[0].isRead).toBe(true);
      expect(AdminNotificationResults.findReadByUserId).toHaveBeenCalledWith(
        'adminNotifications resolver',
        expect.any(Object),
        adminToken.id,
        undefined
      );
    });

    it('should return an InternalServerError when the query throws', async () => {
      (AdminNotificationResults.findReadByUserId as jest.Mock).mockRejectedValue(
        new Error('DB failure')
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('DB failure');
    });
  });

  describe('Query.adminNotifications', () => {
    const query = `
      query adminNotifications($paginationOptions: PaginationOptions) {
        adminNotifications(paginationOptions: $paginationOptions) {
          totalCount
          hasNextPage
          items {
            id
            notificationType
            isRead
          }
        }
      }
    `;

    it('should return all notifications for an admin', async () => {
      const items = [
        buildMockNotification({ isRead: false }),
        buildMockNotification({ isRead: true }),
      ];
      (AdminNotificationResults.findByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult(items, 2)
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotifications.totalCount).toBe(2);
    });

    it('should return an InternalServerError when the query throws', async () => {
      (AdminNotificationResults.findByUserId as jest.Mock).mockRejectedValue(
        new Error('DB failure')
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('DB failure');
    });
  });

  describe('Mutation.markNotificationAsRead', () => {
    const query = `
      mutation markNotificationAsRead($id: Int!) {
        markNotificationAsRead(id: $id)
      }
    `;

    it('should mark a notification as read and return true', async () => {
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      (isAdmin as jest.Mock).mockReturnValue(true);

      const mockNotification = buildMockNotification({ userId: adminToken.id });
      (AdminNotification.findById as jest.Mock).mockResolvedValue({
        ...mockNotification,
        markAsRead: jest.fn().mockResolvedValue(mockNotification),
      });

      const result = await executeQuery(query, { id: mockNotification.id }, adminToken);

      expect(result.body.singleResult.data.markNotificationAsRead).toBe(true);
    });

    it('should return NotFound when notification does not exist', async () => {
      (AdminNotification.findById as jest.Mock).mockResolvedValue(null);

      const result = await executeQuery(query, { id: 999 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('AdminNotification with ID 999 not found');
    });

    it('should return Forbidden when an admin tries to mark another affiliations notification', async () => {
      const mockNotification = buildMockNotification({ userId: 999 });
      (AdminNotification.findById as jest.Mock).mockResolvedValue({
        ...mockNotification,
        markAsRead: jest.fn(),
      });

      const result = await executeQuery(query, { id: mockNotification.id }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Forbidden');
    });

    it('should return false when markAsRead returns null', async () => {
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      (isAdmin as jest.Mock).mockReturnValue(true);
      const mockNotification = buildMockNotification({ userId: adminToken.id });
      (AdminNotification.findById as jest.Mock).mockResolvedValue({
        ...mockNotification,
        markAsRead: jest.fn().mockResolvedValue(null),
      });

      const result = await executeQuery(query, { id: mockNotification.id }, adminToken);

      expect(result.body.singleResult.data.markNotificationAsRead).toBe(false);
    });

    it('should return InternalServerError when findById throws', async () => {
      (AdminNotification.findById as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await executeQuery(query, { id: 1 }, adminToken);

      expect(result.body.singleResult.errors[0].message).toBe('Something went wrong');
    });
  });

  describe('Mutation.markNotificationAsUnRead', () => {
    const query = `
      mutation markNotificationAsUnRead($id: Int!) {
        markNotificationAsUnRead(id: $id)
      }
    `;

    it('should mark a notification as unread and return true', async () => {
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      (isAdmin as jest.Mock).mockReturnValue(true);
      const mockNotification = buildMockNotification({ userId: adminToken.id });
      (AdminNotification.findById as jest.Mock).mockResolvedValue({
        ...mockNotification,
        markAsUnRead: jest.fn().mockResolvedValue(mockNotification),
      });

      const result = await executeQuery(query, { id: mockNotification.id }, adminToken);

      expect(result.body.singleResult.data.markNotificationAsUnRead).toBe(true);
    });

    it('should return NotFound when notification does not exist', async () => {
      (AdminNotification.findById as jest.Mock).mockResolvedValue(null);

      const result = await executeQuery(query, { id: 999 }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('AdminNotification with ID 999 not found');
    });

    it('should return Forbidden when an admin tries to unread another affiliations notification', async () => {
      const mockNotification = buildMockNotification({ userId: 999 });
      (AdminNotification.findById as jest.Mock).mockResolvedValue({
        ...mockNotification,
        markAsUnRead: jest.fn(),
      });

      const result = await executeQuery(query, { id: mockNotification.id }, adminToken);

      expect(result.body.singleResult.errors).toBeDefined();
      expect(result.body.singleResult.errors[0].message).toBe('Forbidden');
    });

    it('should return false when markAsUnRead returns null', async () => {
      (isSuperAdmin as jest.Mock).mockReturnValue(false);
      (isAdmin as jest.Mock).mockReturnValue(true);
      const mockNotification = buildMockNotification({ userId: adminToken.id });
      (AdminNotification.findById as jest.Mock).mockResolvedValue({
        ...mockNotification,
        markAsUnRead: jest.fn().mockResolvedValue(null),
      });

      const result = await executeQuery(query, { id: mockNotification.id }, adminToken);

      expect(result.body.singleResult.data.markNotificationAsUnRead).toBe(false);
    });

    it('should return InternalServerError when findById throws', async () => {
      (AdminNotification.findById as jest.Mock).mockRejectedValue(new Error('DB error'));

      const result = await executeQuery(query, { id: 1 }, adminToken);

      expect(result.body.singleResult.errors[0].message).toBe('Something went wrong');
    });
  });

  // ─── Chained resolvers ─────────────────────────────────────────────────────

  describe('AdminNotificationResults chained resolvers', () => {
    const query = `
      query adminNotificationsUnread {
        adminNotificationsUnread {
          items {
            id
            plan { id title }
            template { id name }
            templateCustomization { id templateName }
            feedback { id messageToOrg }
            createdBy { id givenName surName }
          }
        }
      }
    `;

    it('should resolve plan when metadata contains planId', async () => {
      const planId = casual.integer(1, 999);
      const mockPlan = { id: planId, title: 'My Plan' };
      const mockNotification = buildMockNotification({ metadata: { planId } });

      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );
      jest.spyOn(Plan, 'findById').mockResolvedValue(mockPlan as any);

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].plan.id).toBe(planId);
      expect(Plan.findById).toHaveBeenCalledWith(
        'Chained AdminNotificationResults.plan',
        expect.any(Object),
        planId
      );
    });

    it('should return null for plan when metadata has no planId', async () => {
      const mockNotification = buildMockNotification({ metadata: {} });
      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].plan).toBeNull();
      expect(Plan.findById).not.toHaveBeenCalled();
    });

    it('should resolve template when metadata contains templateId', async () => {
      const templateId = casual.integer(1, 999);
      const mockTemplate = { id: templateId, name: 'My Template' };
      const mockNotification = buildMockNotification({ metadata: { templateId } });

      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );
      jest.spyOn(Template, 'findById').mockResolvedValue(mockTemplate as any);

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].template.id).toBe(templateId);
      expect(Template.findById).toHaveBeenCalledWith(
        'Chained AdminNotificationResults.template',
        expect.any(Object),
        templateId
      );
    });

    it('should return null for template when metadata has no templateId', async () => {
      const mockNotification = buildMockNotification({ metadata: {} });
      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].template).toBeNull();
      expect(Template.findById).not.toHaveBeenCalled();
    });

    it('should resolve templateCustomization when metadata contains templateCustomizationId', async () => {
      const templateCustomizationId = casual.integer(1, 999);
      const mockCustomization = { id: templateCustomizationId, templateName: 'My Template' };
      const mockNotification = buildMockNotification({ metadata: { templateCustomizationId } });

      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );
      jest.spyOn(TemplateCustomization, 'findByIdWithTemplateName').mockResolvedValue(mockCustomization as any);

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].templateCustomization.id).toBe(templateCustomizationId);
      expect(TemplateCustomization.findByIdWithTemplateName).toHaveBeenCalledWith(
        'Chained AdminNotificationResults.templateCustomization',
        expect.any(Object),
        templateCustomizationId
      );
    });

    it('should return null for templateCustomization when metadata has no templateCustomizationId', async () => {
      const mockNotification = buildMockNotification({ metadata: {} });
      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].templateCustomization).toBeNull();
      expect(TemplateCustomization.findByIdWithTemplateName).not.toHaveBeenCalled();
    });

    it('should resolve feedback when metadata contains planId', async () => {
      const planId = casual.integer(1, 999);
      const mockFeedback = { id: casual.integer(1, 999), messageToOrg: 'Please review', completed: null };
      const mockNotification = buildMockNotification({ metadata: { planId } });

      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );
      jest.spyOn(Plan, 'findById').mockResolvedValue({ id: planId, title: 'Plan' } as any);
      jest.spyOn(PlanFeedback, 'findByPlanId').mockResolvedValue([mockFeedback] as any);

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].feedback.messageToOrg).toBe('Please review');
      expect(PlanFeedback.findByPlanId).toHaveBeenCalledWith(
        'Chained AdminNotificationResults.feedback',
        expect.any(Object),
        planId
      );
    });

    it('should return null for feedback when all feedback rounds are completed', async () => {
      const planId = casual.integer(1, 999);
      const completedFeedback = { id: casual.integer(1, 999), messageToOrg: 'Done', completed: new Date().toISOString() };
      const mockNotification = buildMockNotification({ metadata: { planId } });

      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );
      jest.spyOn(Plan, 'findById').mockResolvedValue({ id: planId, title: 'Plan' } as any);
      jest.spyOn(PlanFeedback, 'findByPlanId').mockResolvedValue([completedFeedback] as any);

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].feedback).toBeNull();
    });

    it('should resolve createdBy when createdById is set', async () => {
      const createdById = casual.integer(1, 999);
      const mockUser = { id: createdById, givenName: 'Jane', surName: 'Doe' };
      const mockNotification = buildMockNotification({ createdById });

      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );
      jest.spyOn(User, 'findById').mockResolvedValue(mockUser as any);

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].createdBy.givenName).toBe('Jane');
      expect(User.findById).toHaveBeenCalledWith(
        'Chained AdminNotificationResults.createdBy',
        expect.any(Object),
        createdById
      );
    });

    it('should return null for createdBy when createdById is not set', async () => {
      const mockNotification = buildMockNotification({ createdById: null });
      (AdminNotificationResults.findUnreadByUserId as jest.Mock).mockResolvedValue(
        buildPaginatedResult([mockNotification])
      );

      const result = await executeQuery(query, {}, adminToken);

      expect(result.body.singleResult.data.adminNotificationsUnread.items[0].createdBy).toBeNull();
      expect(User.findById).not.toHaveBeenCalled();
    });
  });
});