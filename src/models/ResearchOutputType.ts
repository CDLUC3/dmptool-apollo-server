import { MyContext } from "../context.js";
import { isNullOrUndefined } from "../utils/helpers.js";
import { MySqlModel } from "./MySqlModel.js";

// Our current default research output types were derived from a subset of
// the DataCite resourceType definitions.
// See: https://datacite-metadata-schema.readthedocs.io/en/4.5/properties/resourcetype/

export class ResearchOutputType extends MySqlModel {
  public value: string;
  public name: string;
  public description?: string;

  public static tableName = 'researchOutputTypes';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified, options.modifiedById, options.errors);

    this.name = options.name;
    this.value = options.value;
    this.description = options.description;
  }

  // Validation to be used prior to saving the record
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.name)) this.addError('name', 'Name can\'t be blank');
    if (isNullOrUndefined(this.value)) this.addError('value', 'Value can\'t be blank');

    return Object.keys(this.errors).length === 0;
  }

  static nameToValue(name: string): string {
    return name.trim().toLowerCase().replace(/\s+/g, '-');
  }

  // Prepare data for the database
  prepForSave(): void {
    this.name = this.name.trim();
    this.value = ResearchOutputType.nameToValue(this.name);
    this.description = this.description.trim();
  }

  //Create a new License
  async create(context: MyContext): Promise<ResearchOutputType> {
    const reference = 'ResearchOutputType.create';

    this.prepForSave();
    // First make sure the record is valid
    if (await this.isValid()) {
      const current = await ResearchOutputType.findByValue(
        reference,
        context,
        this.value
      );

      // Then make sure it doesn't already exist
      if (current) {
        this.addError('general', 'Research output type already exists');
      } else {
        // Save the record and then fetch it
        const newId = await ResearchOutputType.insert(
          context,
          ResearchOutputType.tableName,
          this,
          reference
        );
        return await ResearchOutputType.findById(reference, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new ResearchOutputType(this);
  }

  //Update an existing License
  async update(context: MyContext, noTouch = false): Promise<ResearchOutputType> {
    const id = this.id;
    const ref = 'ResearchOutputType.update';

    if (await this.isValid()) {
      if (id) {
        await ResearchOutputType.update(context, ResearchOutputType.tableName, this, ref, [], noTouch);
        return await ResearchOutputType.findById(ref, context, id);
      }
      // This template has never been saved before so we cannot update it!
      this.addError('general', 'Research output type has never been saved');
    }
    return new ResearchOutputType(this);
  }

  //Delete the License
  async delete(context: MyContext): Promise<ResearchOutputType> {
    const ref = 'ResearchOutputType.delete';
    if (this.id) {
      const deleted = await ResearchOutputType.findById(ref, context, this.id);

      const successfullyDeleted = await ResearchOutputType.delete(
        context,
        ResearchOutputType.tableName,
        this.id,
        ref
      );
      if (successfullyDeleted) {
        return deleted;
      } else {
        return null
      }
    }
    return null;
  }

  // Return all of the member roles
  static async all(reference: string, context: MyContext): Promise<ResearchOutputType[]> {
    const sql = `SELECT * FROM ${ResearchOutputType.tableName} ORDER BY name`;
    const results = await ResearchOutputType.query(context, sql, [], reference);
    return Array.isArray(results) ? results.map((entry) => new ResearchOutputType(entry)) : [];
  }

  // Fetch a member role by it's id
  static async findById(reference: string, context: MyContext, id: number): Promise<ResearchOutputType> {
    const sql = `SELECT * FROM ${ResearchOutputType.tableName} WHERE id = ?`;
    const results = await ResearchOutputType.query(context, sql, [id?.toString()], reference);
    return Array.isArray(results) && results.length > 0 ? new ResearchOutputType(results[0]) : null;
  }

  // Fetch a member role by it's value
  static async findByValue(reference: string, context: MyContext, value: string): Promise<ResearchOutputType> {
    const sql = `SELECT * FROM ${ResearchOutputType.tableName} WHERE value = ?`;
    const results = await ResearchOutputType.query(context, sql, [value], reference);
    return Array.isArray(results) && results.length > 0 ? new ResearchOutputType(results[0]) : null;
  }
}
