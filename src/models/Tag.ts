import { MySqlModel } from "./MySqlModel";
import { MyContext } from "../context";
import { prepareObjectForLogs } from "../logger";

const tableName = 'tags';
export class Tag extends MySqlModel {
  public slug: string;
  public name: string;
  public description?: string;

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.slug = options.slug;
    this.name = options.name;
    this.description = options.description;
  }

  // Validate the tag before saving
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.slug) this.addError('slug', 'Slug can\'t be blank');
    if (!this.name) this.addError('name', 'Name can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Generate a slug from the name
  static slugifyName(name: string): string {
    return name?.trim()?.toLowerCase()
      ?.replace(/[^a-z0-9]+/g, '-')
      ?.replace(/^-+|-+$/g, '');
  }

  // Save the current record
  async create(context: MyContext): Promise<Tag> {
    this.slug = Tag.slugifyName(this.name);
    const current = await Tag.findBySlug(
      'Section.create',
      context,
      this.slug,
    );

    // Then make sure it doesn't already exist
    if (current) {
      this.addError('general', 'Tag already exists');
    } else {
      if (await this.isValid()) {
        const newId = await Tag.insert(context, tableName, this, 'Tag.create');
        const response = await Tag.findById('Tag.create', context, newId);
        return response
      }
    }
    return new Tag(this);
  }

  async update(context: MyContext): Promise<Tag> {
    const id = this.id;
    if (await this.isValid()) {
      await Tag.update(context, tableName, this, 'Tag.update');
      const updatedTag = await Tag.findById('Tag.update', context, id);
      return updatedTag as Tag;
    }
    return new Tag(this);
  }

  async delete(context: MyContext): Promise<Tag> {
    if (this.id) {
      /*Get tag info to be deleted so we can return this info to the user
      since calling 'delete' doesn't return anything*/
      const deletedSection = await Tag.findById('Tag.delete', context, this.id);

      await Tag.delete(context, tableName, this.id, 'Tag.delete');
      return deletedSection;
    }
    return null;
  }

  // Add this Tag to a Section
  async addToSection(context: MyContext, sectionId: number): Promise<boolean> {
    const reference = 'Tag.addToSection';
    const sql = 'INSERT INTO sectionTags (tagId, sectionId, createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token?.id?.toString();
    const vals = [this.id?.toString(), sectionId?.toString(), userId, userId];
    const results = await Tag.query(context, sql, vals, reference);

    if (!results) {
      const payload = { tagId: this.id, sectionId };
      const msg = 'Unable to add the tag to the section';
      context.logger.error(prepareObjectForLogs(payload), msg);
      return false;
    }
    return true;
  }

  // Remove this Tag from a Section
  async removeFromSection(context: MyContext, sectionId: number): Promise<boolean> {
    const reference = 'Tag.removeFromSection';
    const sql = 'DELETE FROM sectionTags WHERE tagId = ? AND sectionId = ?';
    const vals = [this.id?.toString(), sectionId?.toString()];
    const results = await Tag.query(context, sql, vals, reference);

    if (!results) {
      const payload = { tagId: this.id, sectionId };
      const msg = 'Unable to remove the tag from the section';
      context.logger.error(prepareObjectForLogs(payload), `${reference} - ${msg}`);
      return false;
    }
    return true;
  }

  // Add this Tag to a VersionedSectionTags
  async addToVersionedSectionTags(context: MyContext, versionedSectionId: number): Promise<boolean> {
    const reference = 'Tag.addToVersionedSectionTags';
    const sql = 'INSERT INTO versionedSectionTags (tagId, versionedSectionId, createdById, modifiedById) VALUES (?, ?, ?, ?)';
    const userId = context.token?.id?.toString();
    const vals = [this.id?.toString(), versionedSectionId?.toString(), userId, userId];
    const results = await Tag.query(context, sql, vals, reference);

    if (!results) {
      const payload = { tagId: this.id, versionedSectionId };
      const msg = 'Unable to add the tag to the versioned section';
      context.logger.error(prepareObjectForLogs(payload), msg);
      return false;
    }
    return true;
  }

  static async findAll(reference: string, context: MyContext): Promise<Tag[]> {
    const sql = 'SELECT * FROM tags';
    const results = await Tag.query(context, sql, [], reference);
    return Array.isArray(results) && results.length > 0 ? results : null;
  }

  static async findBySectionId(reference: string, context: MyContext, sectionId: number): Promise<Tag[]> {
    const sql = `SELECT tags.* FROM sectionTags JOIN tags ON sectionTags.tagId = tags.id WHERE sectionTags.sectionId = ?;`;
    const result = await Tag.query(context, sql, [sectionId?.toString()], reference);
    return Array.isArray(result) ? result.map(item => new Tag(item)) : [];
  }

  static async findByVersionedSectionId(reference: string, context: MyContext, versionedSectionId: number): Promise<Tag[]> {
    const sql = `SELECT tags.* FROM versionedSectionTags vst JOIN tags ON vst.tagId = tags.id WHERE vst.versionedSectionId = ?;`;
    const result = await Tag.query(context, sql, [versionedSectionId?.toString()], reference);
    return Array.isArray(result) ? result.map(item => new Tag(item)) : [];
  }

  static async findById(reference: string, context: MyContext, tagId: number): Promise<Tag> {
    const sql = 'SELECT * FROM tags where id = ?';
    const result = await Tag.query(context, sql, [tagId?.toString()], reference);
    return Array.isArray(result) && result.length > 0 ? new Tag(result[0]) : null;
  }

  // Find tag by slug
  static async findBySlug(reference: string, context: MyContext, slug: string): Promise<Tag[]> {
    const sql = 'SELECT * FROM tags WHERE slug = ?';
    const searchTerm = (slug ?? '');
    const vals = [searchTerm];
    const results = await Tag.query(context, sql, vals, reference);
    return Array.isArray(results) && results.length > 0 ? results.map((entry) => new Tag(entry)) : null;
  }
}
