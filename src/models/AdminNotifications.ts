import { MyContext } from "../context";
import {
  PaginationOptionsForCursors,
  PaginationOptionsForOffsets,
  PaginatedQueryResults,
  PaginationType,
  PaginationOptions
} from "../types/general";
import { AdminNotificationType } from "../types";
import { MySqlModel } from "./MySqlModel";
import { isNullOrUndefined } from "../utils/helpers";

export interface AdminNotificationMetadata {
  planId?: number;
  templateId?: number;
  templateCustomizationId?: number;
}
export class AdminNotificationResults extends MySqlModel {
  public notificationType: AdminNotificationType;
  public metadata: AdminNotificationMetadata;
  public affiliationId: string;
  public isRead: boolean;
  public userId: number;

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.notificationType = options.notificationType;
    this.metadata = options.metadata ?? {};
    this.affiliationId = options.affiliationId;
    this.isRead = options.isRead ?? false;
    this.userId = options.userId;
  }

  static async findByUserId(
    reference: string,
    context: MyContext,
    userId: number | null,
    options: PaginationOptions = AdminNotificationResults.getDefaultPaginationOptions(),
    isRead?: boolean,
  ): Promise<PaginatedQueryResults<AdminNotificationResults>> {

    // SuperAdmins get all notifications (userId is null), Admins only get their own
    const whereFilters: string[] = [];
    const values: string[] = [];

    if (userId) {
      whereFilters.push('userId = ?');
      values.push(userId.toString());
    }

    if (isRead !== undefined) {
      whereFilters.push(`isRead = ${isRead ? 1 : 0}`);
    }

    if (isNullOrUndefined(options.sortField)) options.sortField = 'created';
    if (isNullOrUndefined(options.sortDir)) options.sortDir = 'DESC';

    options.countField = 'id';

    let opts;
    if (options.type === PaginationType.OFFSET) {
      opts = options as PaginationOptionsForOffsets;
    } else {
      opts = options as PaginationOptionsForCursors;
      opts.cursorField = 'id';
    }

    const sqlStatement = 'SELECT adminNotifications.* FROM adminNotifications';

    return AdminNotificationResults.queryWithPagination(
      context,
      sqlStatement,
      whereFilters,
      '',
      values,
      opts,
      reference,
    );
  }

  static async findReadByUserId(
    reference: string,
    context: MyContext,
    userId: number | null,
    options?: PaginationOptions,
  ) {
    return AdminNotificationResults.findByUserId(reference, context, userId, options, true);
  }

  static async findUnreadByUserId(
    reference: string,
    context: MyContext,
    userId: number | null,
    options?: PaginationOptions,
  ) {
    return AdminNotificationResults.findByUserId(reference, context, userId, options, false);
  }
}

export class AdminNotification extends MySqlModel {
  public notificationType: AdminNotificationType;
  public metadata: AdminNotificationMetadata;
  public affiliationId: string;
  public isRead: boolean;
  public userId: number;

  private tableName = 'adminNotifications';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.notificationType = options.notificationType;
    this.metadata = options.metadata ?? {};
    this.affiliationId = options.affiliationId;
    this.isRead = options.isRead ?? false;
    this.userId = options.userId;
  }

  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.notificationType) this.addError('notificationType', "Notification type can't be blank");

    const validTypes: AdminNotificationType[] = ['FEEDBACK_REQUESTED', 'TEMPLATE_CREATED', 'TEMPLATE_CUSTOMIZATION_CHANGED'];
    if (!validTypes.includes(this.notificationType)) {
      this.addError('notificationType', `Notification type must be one of: ${validTypes.join(', ')}`);
    }

    return Object.keys(this.errors).length === 0;
  }

  async markAsRead(context: MyContext): Promise<AdminNotification | null> {
    if (!this.id) {
      this.addError('general', 'AdminNotification has never been saved');
      return this;
    }
    this.isRead = true;
    return await this.update(context);
  }

  async markAsUnRead(context: MyContext): Promise<AdminNotification | null> {
    if (!this.id) {
      this.addError('general', 'AdminNotification has never been saved');
      return this;
    }
    this.isRead = false;
    return await this.update(context);
  }


  async create(context: MyContext): Promise<AdminNotification | null> {
    const reference = 'AdminNotification.create';

    if (await this.isValid()) {
      const newId = await AdminNotification.insert(context, this.tableName, this, reference);
      if (!newId) {
        context.logger.error(`${reference}, ERROR: Failed to create AdminNotification.`);
        this.addError('general', 'AdminNotification was not created successfully');
        return new AdminNotification(this);
      }
      return await AdminNotification.findById(reference, context, newId);
    }
    return new AdminNotification(this);
  }

  async update(context: MyContext, noTouch = false): Promise<AdminNotification | null> {
    const reference = 'AdminNotification.update';
    if (this.id) {
      if (await this.isValid()) {
        const updated = await AdminNotification.update(context, this.tableName, this, reference, [], noTouch);
        if (updated) {
          return await AdminNotification.findById(reference, context, this.id);
        }
      }
    } else {
      this.addError('general', 'AdminNotification has never been saved');
    }
    return this;
  }

  static async findById(reference: string, context: MyContext, id: number): Promise<AdminNotification | null> {
    const sql = `SELECT * FROM adminNotifications WHERE id = ?`;
    const results = await AdminNotification.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new AdminNotification(results[0]) : null;
  }

  static async addNotificationForAffiliation(
    reference: string,
    context: MyContext,
    affiliationId: string,
    notificationType: AdminNotificationType,
    metadata?: AdminNotificationMetadata,
  ): Promise<boolean> {
    const sql = `
    INSERT INTO adminNotifications (userId, notificationType, affiliationId, metadata, createdById, modifiedById, created, modified)
    SELECT u.id, ?, ?, ?, ?, ?, NOW(), NOW()
    FROM users AS u
    WHERE (u.role = 'ADMIN' OR u.role = 'SUPER_ADMIN') AND u.affiliationId = ?
  `;
    const values = [
      notificationType,
      affiliationId,
      JSON.stringify(metadata ?? {}),
      context.token.id.toString(),
      context.token.id.toString(),
      affiliationId,
    ];
    const result = await AdminNotification.query(context, sql, values, reference);
    return Array.isArray(result) && result.length > 0;
  }
}