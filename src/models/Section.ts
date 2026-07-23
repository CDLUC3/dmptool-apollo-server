import { MyContext } from "../context";
import { MySqlModel } from "./MySqlModel";
import { Tag } from "./Tag";

// A Template for creating a DMP
export class Section extends MySqlModel {
  public templateId: number;
  public sourceSectionId: number;
  public name: string;
  public introduction?: string;
  public requirements?: string;
  public guidance?: string;
  public displayOrder: number;
  public bestPractice: boolean;
  public tags: Tag[];
  public isDirty: boolean;

  private tableName = 'sections';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.templateId = options.templateId;
    this.sourceSectionId = options.sourceSectionId;
    this.name = options.name;
    this.introduction = options.introduction;
    this.requirements = options.requirements;
    this.guidance = options.guidance;
    this.displayOrder = options.displayOrder;
    this.bestPractice = options.bestPractice ?? false;
    this.tags = options.tags;
    this.isDirty = options.isDirty ?? true;
  }

  //Check that the Section data contains the required name field
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (!this.name) this.addError('name', 'Name can\'t be blank');
    if (!this.displayOrder) this.addError('displayOrder', 'Order number can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  // Ensure data integrity
  prepForSave(): void {
    // Remove leading/trailing blank spaces
    this.name = this.name?.trim();
    this.introduction = this.introduction?.trim();
    this.requirements = this.requirements?.trim();
    this.guidance = this.guidance?.trim();
  }

  //Create a new Section
  async create(context: MyContext, templateId: number): Promise<Section> {

    // First make sure the record is valid
    if (await this.isValid()) {
      this.templateId = templateId;
      // Save the record and then fetch it
      const newId = await Section.insert(context, this.tableName, this, 'Section.create', ['tags']);
      const response = await Section.findById('Section.create', context, newId);
      return response;
    }
    // Otherwise return as-is with all the errors
    return new Section(this);
  }

  //Update an existing Section
  async update(context: MyContext, noTouch = false): Promise<Section> {
    const id = this.id;

    if (await this.isValid()) {
      if (id) {
        this.prepForSave();

        await Section.update(context, this.tableName, this, 'Section.update', ['tags'], noTouch);
        return await Section.findById('Section.update', context, id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'Section has never been saved');
    }
    return new Section(this);
  }

  //Delete Section based on the Section object's id and return
  async delete(context: MyContext): Promise<Section> {
    if (this.id) {
      /*First get the section to be deleted so we can return this info to the user
      since calling 'delete' doesn't return anything*/
      const deletedSection = await Section.findById('Section.delete', context, this.id);

      const successfullyDeleted = await Section.delete(context, this.tableName, this.id, 'Section.delete');
      if (successfullyDeleted) {
        return deletedSection;
      } else {
        return null
      }
    }
    return null;
  }

  // Find the current max section displayOrder for the specified templateId
  static async findMaxDisplayOrder(reference: string, context: MyContext, templateId: number): Promise<number> {
    const sql = 'SELECT MAX(displayOrder) as maxDisplayOrder FROM sections WHERE templateId = ?';
    const results = await Section.query(context, sql, [templateId?.toString()], reference);
    if (Array.isArray(results) && results.length > 0) {
      const maxDisplayOrder = results[0].maxDisplayOrder;
      return maxDisplayOrder ? parseInt(maxDisplayOrder) : 0;
    }
    return 0;
  }

  // Find section by section name
  static async findBySectionName(
    reference: string,
    context: MyContext,
    name: string,
    templateId: number
  ): Promise<Section> {
    const sql = 'SELECT * FROM sections WHERE LOWER(name) = ? AND templateId = ?';
    const searchTerm = (name ?? '');
    const vals = [searchTerm?.toLowerCase()?.trim(), templateId?.toString()];
    const results = await Section.query(context, sql, vals, reference);
    return Array.isArray(results) && results.length > 0 ? new Section(results[0]) : null;
  }

  // Find all Sections associated with the specified templateId
  static async findByTemplateId(reference: string, context: MyContext, templateId: number): Promise<Section[]> {
    const sql = 'SELECT * FROM sections WHERE templateId = ? ORDER BY displayOrder ASC';
    const results = await Section.query(context, sql, [templateId?.toString()], reference);
    return Array.isArray(results) ? results.map((entry) => new Section(entry)) : [];
  }

  static async findById(reference: string, context: MyContext, sectionId: number): Promise<Section> {
    const sql = 'SELECT * FROM sections where id = ?';
    const result = await Section.query(context, sql, [sectionId?.toString()], reference);
    return Array.isArray(result) && result.length > 0 ? new Section(result[0]) : null;
  }
}
