import casual from "casual";
import { AdminNotification, AdminNotificationResults } from "../AdminNotifications";
import { buildMockContextWithToken } from "../../__mocks__/context";
import { logger } from "../../logger";
import { AdminNotificationType } from "../../types";

jest.mock('../../context.ts');

// ─── Shared test data ────────────────────────────────────────────────────────

const validNotificationData = {
  id: casual.integer(1, 999),
  notificationType: 'FEEDBACK_REQUESTED' as AdminNotificationType,
  affiliationId: 'https://ror.org/03yrm5c26',
  metadata: { planId: casual.integer(1, 999) },
  isRead: false,
  createdById: casual.integer(1, 999),
  modifiedById: casual.integer(1, 999),
  created: new Date().toISOString(),
  modified: new Date().toISOString(),
};

// ─── AdminNotification ───────────────────────────────────────────────────────

describe('AdminNotification', () => {
  let context;
  let notification: AdminNotification;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
    notification = new AdminNotification(validNotificationData);
  });

  describe('constructor', () => {
    it('should initialize options as expected', () => {
      expect(notification.notificationType).toEqual(validNotificationData.notificationType);
      expect(notification.affiliationId).toEqual(validNotificationData.affiliationId);
      expect(notification.metadata).toEqual(validNotificationData.metadata);
      expect(notification.isRead).toEqual(validNotificationData.isRead);
    });

    it('should default isRead to false if not provided', () => {
      const n = new AdminNotification({ ...validNotificationData, isRead: undefined });
      expect(n.isRead).toBe(false);
    });

    it('should default metadata to empty object if not provided', () => {
      const n = new AdminNotification({ ...validNotificationData, metadata: undefined });
      expect(n.metadata).toEqual({});
    });
  });

  describe('isValid', () => {
    it('should return true for a valid notification', async () => {
      const result = await notification.isValid();
      expect(result).toBe(true);
      expect(Object.keys(notification.errors).length).toBe(0);
    });

    it('should return false if notificationType is missing', async () => {
      notification.notificationType = undefined;
      const result = await notification.isValid();
      expect(result).toBe(false);
      expect(notification.errors['notificationType']).toBeTruthy();
    });

    it('should return false if notificationType is not a valid enum value', async () => {
      notification.notificationType = 'INVALID_TYPE' as AdminNotificationType;
      const result = await notification.isValid();
      expect(result).toBe(false);
      expect(notification.errors['notificationType']).toBeTruthy();
    });

    it('should be valid for TEMPLATE_CREATED type', async () => {
      notification.notificationType = 'TEMPLATE_CREATED' as AdminNotificationType;
      const result = await notification.isValid();
      expect(result).toBe(true);
    });

    it('should be valid for TEMPLATE_CUSTOMIZATION_CHANGED type', async () => {
      notification.notificationType = 'TEMPLATE_CUSTOMIZATION_CHANGED' as AdminNotificationType;
      const result = await notification.isValid();
      expect(result).toBe(true);
    });
  });

  describe('markAsRead', () => {
    it('should set isRead to true and call update', async () => {
      const mockUpdate = jest.fn().mockResolvedValue({ ...notification, isRead: true });
      notification.update = mockUpdate;

      await notification.markAsRead(context);

      expect(notification.isRead).toBe(true);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should add an error and return this if id is not set', async () => {
      notification.id = undefined;
      const result = await notification.markAsRead(context);
      expect(result.errors['general']).toBeTruthy();
    });
  });

  describe('markAsUnRead', () => {
    it('should set isRead to false and call update', async () => {
      notification.isRead = true;
      const mockUpdate = jest.fn().mockResolvedValue({ ...notification, isRead: false });
      notification.update = mockUpdate;

      await notification.markAsUnRead(context);

      expect(notification.isRead).toBe(false);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
    });

    it('should add an error and return this if id is not set', async () => {
      notification.id = undefined;
      const result = await notification.markAsUnRead(context);
      expect(result.errors['general']).toBeTruthy();
    });
  });

  describe('create', () => {
    const originalInsert = AdminNotification.insert;
    const originalFindById = AdminNotification.findById;
    let mockInsert: jest.Mock;
    let mockFindById: jest.Mock;

    beforeEach(() => {
      mockInsert = jest.fn().mockResolvedValue(validNotificationData.id);
      (AdminNotification.insert as jest.Mock) = mockInsert;

      mockFindById = jest.fn().mockResolvedValue(notification);
      (AdminNotification.findById as jest.Mock) = mockFindById;
    });

    afterEach(() => {
      AdminNotification.insert = originalInsert;
      AdminNotification.findById = originalFindById;
    });

    it('should insert and return the new notification when valid', async () => {
      const fresh = new AdminNotification({ ...validNotificationData, id: undefined });
      const result = await fresh.create(context);
      expect(mockInsert).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should add an error if insert returns no id', async () => {
      mockInsert.mockResolvedValueOnce(null);
      const fresh = new AdminNotification({ ...validNotificationData, id: undefined });
      const result = await fresh.create(context);
      expect(result.errors['general']).toBeTruthy();
    });

    it('should return notification with errors if isValid fails', async () => {
      const fresh = new AdminNotification({ ...validNotificationData, id: undefined, notificationType: undefined });
      const result = await fresh.create(context);
      expect(mockInsert).not.toHaveBeenCalled();
      expect(result.errors['notificationType']).toBeTruthy();
    });
  });

  describe('update', () => {
    const originalUpdate = AdminNotification.update;
    const originalFindById = AdminNotification.findById;
    let mockUpdate: jest.Mock;
    let mockFindById: jest.Mock;

    beforeEach(() => {
      mockUpdate = jest.fn().mockResolvedValue(new AdminNotification(validNotificationData));
      (AdminNotification.update as jest.Mock) = mockUpdate;

      mockFindById = jest.fn().mockResolvedValue(new AdminNotification(validNotificationData));
      (AdminNotification.findById as jest.Mock) = mockFindById;
    });

    afterEach(() => {
      AdminNotification.update = originalUpdate;
      AdminNotification.findById = originalFindById;
    });

    it('should call update and return the updated notification when valid', async () => {
      const result = await notification.update(context);
      expect(mockUpdate).toHaveBeenCalledTimes(1);
      expect(mockFindById).toHaveBeenCalledTimes(1);
      expect(Object.keys(result.errors).length).toBe(0);
    });

    it('should add an error if id is not set', async () => {
      const fresh = new AdminNotification({ ...validNotificationData, id: undefined });
      const result = await fresh.update(context);
      expect(result.errors['general']).toBeTruthy();
      expect(mockUpdate).not.toHaveBeenCalled();
    });

    it('should return this with errors if isValid fails', async () => {
      const fresh = new AdminNotification({ ...validNotificationData, notificationType: undefined });
      const result = await fresh.update(context);
      expect(mockUpdate).not.toHaveBeenCalled();
      expect(result.errors['notificationType']).toBeTruthy();
    });
  });

  describe('findById', () => {
    const originalQuery = AdminNotification.query;
    let mockQuery: jest.Mock;

    beforeEach(() => {
      mockQuery = jest.fn();
      (AdminNotification.query as jest.Mock) = mockQuery;
    });

    afterEach(() => {
      AdminNotification.query = originalQuery;
    });

    it('should return the notification when a result is found', async () => {
      mockQuery.mockResolvedValueOnce([validNotificationData]);
      const result = await AdminNotification.findById('Test', context, validNotificationData.id);
      const expectedSql = 'SELECT * FROM adminNotifications WHERE id = ?';
      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockQuery).toHaveBeenCalledWith(context, expectedSql, [validNotificationData.id.toString()], 'Test');
      expect(result).toBeInstanceOf(AdminNotification);
    });

    it('should return null when no result is found', async () => {
      mockQuery.mockResolvedValueOnce([]);
      const result = await AdminNotification.findById('Test', context, validNotificationData.id);
      expect(result).toBeNull();
    });
  });
});

// ─── AdminNotificationResults ─────────────────────────────────────────────────

describe('AdminNotificationResults', () => {
  let context;

  beforeEach(async () => {
    context = await buildMockContextWithToken(logger);
  });

  describe('constructor', () => {
    it('should initialize options as expected', () => {
      const result = new AdminNotificationResults(validNotificationData);
      expect(result.notificationType).toEqual(validNotificationData.notificationType);
      expect(result.affiliationId).toEqual(validNotificationData.affiliationId);
      expect(result.metadata).toEqual(validNotificationData.metadata);
      expect(result.isRead).toEqual(validNotificationData.isRead);
    });

    it('should default isRead to false if not provided', () => {
      const result = new AdminNotificationResults({ ...validNotificationData, isRead: undefined });
      expect(result.isRead).toBe(false);
    });

    it('should default metadata to empty object if not provided', () => {
      const result = new AdminNotificationResults({ ...validNotificationData, metadata: undefined });
      expect(result.metadata).toEqual({});
    });
  });

  describe('findByUserId', () => {
    const originalQuery = AdminNotificationResults.queryWithPagination;
    let mockQuery: jest.Mock;

    beforeEach(() => {
      mockQuery = jest.fn().mockResolvedValue({ items: [], totalCount: 0 });
      (AdminNotificationResults.queryWithPagination as jest.Mock) = mockQuery;
    });

    afterEach(() => {
      AdminNotificationResults.queryWithPagination = originalQuery;
    });

    it('should filter by userId when provided', async () => {
      await AdminNotificationResults.findByUserId('Test', context, 123);
      const [, , whereFilters, , values] = mockQuery.mock.calls[0];
      expect(whereFilters).toContain('userId = ?');
      expect(values).toContain('123');
    });

    it('should not filter by userId when null (superAdmin)', async () => {
      await AdminNotificationResults.findByUserId('Test', context, null);
      const [, , whereFilters, , values] = mockQuery.mock.calls[0];
      expect(whereFilters).not.toContain('userId = ?');
      expect(values).toHaveLength(0);
    });

    it('should filter by isRead = true when provided', async () => {
      await AdminNotificationResults.findByUserId('Test', context, null, undefined, true);
      const [, , whereFilters] = mockQuery.mock.calls[0];
      expect(whereFilters).toContain('isRead = 1');
    });

    it('should filter by isRead = false when provided', async () => {
      await AdminNotificationResults.findByUserId('Test', context, null, undefined, false);
      const [, , whereFilters] = mockQuery.mock.calls[0];
      expect(whereFilters).toContain('isRead = 0');
    });

    it('should not filter by isRead when not provided', async () => {
      await AdminNotificationResults.findByUserId('Test', context, null);
      const [, , whereFilters] = mockQuery.mock.calls[0];
      expect(whereFilters.some((f: string) => f.includes('isRead'))).toBe(false);
    });

    it('should use cursor pagination by default', async () => {
      await AdminNotificationResults.findByUserId('Test', context, null);
      const [, , , , , opts] = mockQuery.mock.calls[0];
      expect(opts.cursorField).toBe('id');
    });

    it('should sort by created DESC by default', async () => {
      await AdminNotificationResults.findByUserId('Test', context, null);
      const [, , , , , opts] = mockQuery.mock.calls[0];
      expect(opts.sortField).toBe('created');
      expect(opts.sortDir).toBe('DESC');
    });
  });

  describe('findReadByUserId', () => {
    it('should call findByUserId with isRead = true', async () => {
      const mockFind = jest.fn().mockResolvedValue({ items: [], totalCount: 0 });
      const original = AdminNotificationResults.findByUserId;
      (AdminNotificationResults.findByUserId as jest.Mock) = mockFind;

      await AdminNotificationResults.findReadByUserId('Test', context, 123);

      expect(mockFind).toHaveBeenCalledWith('Test', context, 123, undefined, true);

      AdminNotificationResults.findByUserId = original;
    });
  });

  describe('findUnreadByUserId', () => {
    it('should call findByUserId with isRead = false', async () => {
      const mockFind = jest.fn().mockResolvedValue({ items: [], totalCount: 0 });
      const original = AdminNotificationResults.findByUserId;
      (AdminNotificationResults.findByUserId as jest.Mock) = mockFind;

      await AdminNotificationResults.findUnreadByUserId('Test', context, 123);

      expect(mockFind).toHaveBeenCalledWith('Test', context, 123, undefined, false);

      AdminNotificationResults.findByUserId = original;
    });
  });
});