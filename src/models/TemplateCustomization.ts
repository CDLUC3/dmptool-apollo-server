import { MySqlModel } from "./MySqlModel";
import { VersionedTemplateCustomization } from "./VersionedTemplateCustomization";
import { MyContext } from "../context";
import {
  isNullOrUndefined,
  normaliseDateTime,
  valueIsEmpty
} from "../utils/helpers";
import { PinnedSectionTypeEnum } from "./CustomSection";
import { PinnedQuestionTypeEnum } from "./CustomQuestion";

/**
 * The status of the customization.
 *  - DRAFT: The customization has not been published yet and is not available to users.
 *  - PUBLISHED: The customization has been published and is available to users.
 *  - ARCHIVED: The customization has been archived and is no longer available to users.
 */
export enum TemplateCustomizationStatus {
  DRAFT = 'DRAFT',
  PUBLISHED = 'PUBLISHED',
  ARCHIVED = 'ARCHIVED'
}

/**
 * The status of the customizations with regard to the base template.
 *  - OK: The funder template has not changed since the customization was created.
 *  - STALE: The funder has published a newer version of the template.
 *  - ORPHANED: The funder template is no longer available.
 */
export enum TemplateCustomizationMigrationStatus {
  OK = 'OK',
  STALE = 'STALE',
  ORPHANED = 'ORPHANED'
}

/**
 * Represents a summary of a template customization question
 */
export interface TemplateCustomizationQuestionOverview {
  questionType: PinnedQuestionTypeEnum;
  id: number;
  questionCustomizationId?: number;
  migrationStatus: TemplateCustomizationMigrationStatus;
  questionText: string;
  displayOrder: number;
  hasCustomGuidance: boolean;
  hasCustomSampleAnswer: boolean;
}

/**
 * Represents a summary of a template customization section
 */
export interface TemplateCustomizationSectionOverview {
  sectionType: PinnedSectionTypeEnum;
  id: number;
  sectionCustomizationId?: number;
  migrationStatus: TemplateCustomizationMigrationStatus;
  name: string;
  displayOrder: number;
  hasCustomGuidance: boolean;

  questions: TemplateCustomizationQuestionOverview[];
}

/**
 * A query result of the template customization and published funder template
 */
interface FetchTemplateResult {
  versionedTemplateId: number;
  versionedTemplateAffiliationId: string;
  versionedTemplateAffiliationName: string;
  versionedTemplateName?: string;
  versionedTemplateDescription: string;
  versionedTemplateVersion: string;
  versionedTemplateLastModified: string;

  customizationId: number;
  customizationIsDirty: boolean;
  customizationLastPublishedDate?: string;
  customizationStatus: TemplateCustomizationStatus;
  customizationMigrationStatus: TemplateCustomizationMigrationStatus;
  customizationLastCustomizedById?: number;
  customizationLastCustomized?: string;
  customizationLastCustomizedByName?: string;

  versionedSectionId: number;
  versionedSectionName: string;
  versionedSectionDisplayOrder: number;
  sectionCustomizationId: number;
  sectionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus;
  sectionCustomizationHasGuidanceText: boolean;

  versionedQuestionId: number;
  versionedQuestionText: string;
  versionedQuestionDisplayOrder: number;
  questionCustomizationId: number;
  questionCustomizationMigrationStatus: TemplateCustomizationMigrationStatus;
  questionCustomizationHasGuidanceText: boolean;
  questionCustomizationHasSampleText: boolean;
}

/**
 * A query result of custom sections
 */
interface FetchCustomSectionResult {
  customSectionId: number;
  customSectionMigrationStatus: TemplateCustomizationMigrationStatus;
  customSectionName: string;
  customSectionPinType: PinnedSectionTypeEnum;
  customSectionPinId: number | null;
  guidance?: string;
}

/**
 * A query result of custom questions
 */
interface FetchCustomQuestionResult {
  customQuestionId: number;
  customQuestionMigrationStatus: TemplateCustomizationMigrationStatus;
  customQuestionText: string;
  customQuestionSectionType: PinnedSectionTypeEnum;
  customQuestionSectionId: number;
  customQuestionPinType: PinnedQuestionTypeEnum;
  customQuestionPinId: number | null;
  guidanceText?: string;
  sampleText?: string;
}

/**
 * An overview of a funder template customization that includes the published
 * version of the funder template and the customizations made to it.
 */
export class TemplateCustomizationOverview {
  // Information about the funder template
  public versionedTemplateId: number;
  public versionedTemplateAffiliationId: string;
  public versionedTemplateAffiliationName: string;
  public versionedTemplateName: string;
  public versionedTemplateDescription?: string;
  public versionedTemplateVersion: string;
  public versionedTemplateLastModified: string;

  // Information about the customization
  public customizationId: number;
  public customizationIsDirty: boolean;
  public customizationLastPublishedDate?: string;
  public customizationStatus: TemplateCustomizationStatus;
  public customizationMigrationStatus: TemplateCustomizationMigrationStatus;
  public customizationLastCustomizedById?: number;
  public customizationLastCustomizedByName?: string;
  public customizationLastCustomized?: string;

  public sections: TemplateCustomizationSectionOverview[];
  public errors: Record<string, string> = {};

  constructor(options) {
    this.versionedTemplateId = options.versionedTemplateId;
    this.versionedTemplateAffiliationId = options.versionedTemplateAffiliationId;
    this.versionedTemplateAffiliationName = options.versionedTemplateAffiliationName;
    this.versionedTemplateName = options.versionedTemplateName;
    this.versionedTemplateDescription = options.versionedTemplateDescription;
    this.versionedTemplateVersion = options.versionedTemplateVersion;
    this.versionedTemplateLastModified = options.versionedTemplateLastModified;

    this.customizationId = options.customizationId;
    this.customizationIsDirty = options.customizationIsDirty;
    this.customizationLastPublishedDate = options.customizationLastPublishedDate;
    this.customizationStatus = options.customizationStatus;
    this.customizationMigrationStatus = options.customizationMigrationStatus;
    this.customizationLastCustomizedById = options.customizationLastCustomizedById;
    this.customizationLastCustomizedByName = options.customizationLastCustomizedByName;
    this.customizationLastCustomized = options.customizationLastCustomized;

    this.sections = options.sections ?? [];
    this.errors = options.errors ?? {};
  }

  /**
   * Generate a TemplateCustomizationOverview object for a template customization.
   *
   * @param reference The reference string for logging.
   * @param context The Apollo context.
   * @param templateCustomizationId The ID of the template customization.
   */
  static async generateOverview(
    reference: string,
    context: MyContext,
    templateCustomizationId: number
  ): Promise<TemplateCustomizationOverview | undefined> {

    // Fetch the required data in parallel
    const [templateRows, customSectionRows, customQuestionRows] = await Promise.all([
      this.fetchTemplateData(context, templateCustomizationId, reference),
      this.fetchCustomSections(context, templateCustomizationId, reference),
      this.fetchCustomQuestions(context, templateCustomizationId, reference)
    ]);

    if (!templateRows?.length) {
      context.logger.error(
        { templateCustomizationId },
        'Unable to find template customization'
      );
      return undefined;
    }

    // Use the first row to build the funder template and customization info
    const first: FetchTemplateResult = templateRows[0];
    const result = new TemplateCustomizationOverview({
      versionedTemplateId: first.versionedTemplateId,
      versionedTemplateAffiliationId: first.versionedTemplateAffiliationId,
      versionedTemplateAffiliationName: first.versionedTemplateAffiliationName,
      versionedTemplateName: first.versionedTemplateName,
      versionedTemplateDescription: first.versionedTemplateDescription,
      versionedTemplateVersion: first.versionedTemplateVersion,
      versionedTemplateLastModified: normaliseDateTime(first.versionedTemplateLastModified),
      customizationId: first.customizationId,
      customizationIsDirty: first.customizationIsDirty,
      customizationLastPublishedDate: normaliseDateTime(first.customizationLastPublishedDate),
      customizationStatus: first.customizationStatus,
      customizationMigrationStatus: first.customizationMigrationStatus,
      customizationLastCustomizedById: first.customizationLastCustomizedById,
      customizationLastCustomizedByName: first.customizationLastCustomizedByName,
      customizationLastCustomized: normaliseDateTime(first.customizationLastCustomized),
      sections: [],
    });

    // Build Base Structure
    const sectionMap = new Map<number, TemplateCustomizationSectionOverview>();

    for (const row of templateRows) {
      let section: TemplateCustomizationSectionOverview = sectionMap.get(row.versionedSectionId);

      if (!section) {
        section = {
          sectionType: PinnedSectionTypeEnum.BASE,
          id: row.versionedSectionId,
          sectionCustomizationId: row.sectionCustomizationId,
          migrationStatus: row.sectionCustomizationMigrationStatus,
          hasCustomGuidance: row.sectionCustomizationHasGuidanceText,
          name: row.versionedSectionName,
          displayOrder: row.versionedSectionDisplayOrder,
          questions: []
        };
        sectionMap.set(section.id, section);
        result.sections.push(section);
      }

      if (row.versionedQuestionId) {
        section.questions.push({
          questionType: PinnedQuestionTypeEnum.BASE,
          id: row.versionedQuestionId,
          questionCustomizationId: row.questionCustomizationId,
          migrationStatus: row.questionCustomizationMigrationStatus,
          hasCustomGuidance: row.questionCustomizationHasGuidanceText,
          hasCustomSampleAnswer: row.questionCustomizationHasSampleText,
          displayOrder: row.versionedQuestionDisplayOrder,
          questionText: row.versionedQuestionText,
        });
      }
    }

    // Inject Custom Sections
    this.injectCustomSections(result.sections, customSectionRows, context);

    // Inject Custom Questions
    this.injectCustomQuestions(result.sections, customQuestionRows, context);

    // Ensure that the display orders of each section are sequential and that each
    // question's display order is sequential within its section.
    let currentSectionDisplayOrder = 0;
    for (const section of result.sections) {
      let currentQuestionDisplayOrder = 0;
      section.displayOrder = currentSectionDisplayOrder++;
      for (const question of section.questions) {
        question.displayOrder = currentQuestionDisplayOrder++;
      }
    }

    return result;
  }

  /**
   * Splice the custom sections into the correct order.
   *
   * @param sections The sections of the template customization overview.
   * @param customRows The custom sections for the template customization.
   * @param context The Apollo context.
   */
  private static injectCustomSections(
    sections: TemplateCustomizationSectionOverview[],
    customRows: FetchCustomSectionResult[],
    context: MyContext
  ): void {
    // Sort to ensure sequential pinning works
    customRows.sort((a, b) => (a.customSectionId ?? 0) - (b.customSectionId ?? 0));

    for (const row of customRows) {
      const newSection: TemplateCustomizationSectionOverview = {
        sectionType: PinnedSectionTypeEnum.CUSTOM,
        id: row.customSectionId,
        migrationStatus: row.customSectionMigrationStatus,
        name: row.customSectionName,
        displayOrder: 0, // Custom sections usually don't have a base display order
        hasCustomGuidance: !valueIsEmpty(row.guidance),
        questions: []
      };

      // Make it the first section on the funder template if the pin id is null
      if (row.customSectionPinId === null) {
        sections.unshift(newSection);

      } else {
        const index = sections.findIndex(s => {
          return s.sectionType === row.customSectionPinType && s.id === row.customSectionPinId
        });

        // Splice the custom section in if the pin id is found otherwise add it to the end
        if (index !== -1) {
          sections.splice(index + 1, 0, newSection);
        } else {
          context.logger.error({ ...row }, 'Unable to find section to pin custom section');
          sections.push(newSection); // Fallback
        }
      }
    }
  }

  /**
   * Splice the custom questions into the correct order.
   *
   * @param sections The sections of the template customization overview.
   * @param customRows The custom questions for the template customization.
   * @param context The Apollo context.
   */
  private static injectCustomQuestions(
    sections: TemplateCustomizationSectionOverview[],
    customRows: FetchCustomQuestionResult[],
    context: MyContext
  ): void {
    customRows.sort((a: FetchCustomQuestionResult, b: FetchCustomQuestionResult) => {
      return (a.customQuestionId ?? 0) - (b.customQuestionId ?? 0);
    });

    for (const row of customRows) {
      // Find the section that the custom question belongs to
      const section: TemplateCustomizationSectionOverview = sections.find((s: TemplateCustomizationSectionOverview) => {
        return s.id === row.customQuestionSectionId;
      });

      const newQuestion: TemplateCustomizationQuestionOverview = {
        questionType: PinnedQuestionTypeEnum.CUSTOM,
        id: row.customQuestionId,
        migrationStatus: row.customQuestionMigrationStatus,
        questionText: row.customQuestionText,
        displayOrder: 0,
        hasCustomGuidance: !valueIsEmpty(row.guidanceText),
        hasCustomSampleAnswer: !valueIsEmpty(row.sampleText),
      };

      // If the section is not found, log an error and tack it onto the last section
      if (!section) {
        context.logger.error(
          { ...row },
          'Unable to find the section the custom question belongs to'
        );
        sections[sections.length - 1].questions.push(newQuestion)

      } else {
        // Make it the first question of the section if the pin id is null
        if (row.customQuestionPinId === null) {
          section.questions.unshift(newQuestion);

        } else {
          // Find the question that this custom question should be pinned to
          const pinIdx = section.questions.findIndex(q => {
            return q.questionType === row.customQuestionPinType && q.id === row.customQuestionPinId
          });
          if (pinIdx !== -1) {
            // Splice the custom question in if the pin id is found
            section.questions.splice(pinIdx + 1, 0, newQuestion);
          } else {
            context.logger.error(
              { ...row },
              'Unable to find the question to pin the custom question to'
            );
            // Otherwise add it to the end
            section.questions.push(newQuestion);
          }
        }
      }
    }
  }

  /**
   * Fetch the template customization and the published version of the funder template.
   *
   * @param context The Apollo context.
   * @param templateCustomizationId The ID of the template customization.
   * @param reference The reference string for logging.
   * @returns The template customization and funder template overview.
   */
  private static async fetchTemplateData(
    context: MyContext,
    templateCustomizationId: number,
    reference: string
  ): Promise<FetchTemplateResult[]> {
    const sql = `
      SELECT
        vt.id AS versionedTemplateId,
        a.uri AS versionedTemplateAffiliationId, a.name AS versionedTemplateAffiliationName,
        vt.name AS versionedTemplateName, vt.description AS versionedTemplateDescription,
        vt.version AS versionedTemplateVersion, vt.modified AS versionedTemplateLastModified,

        tc.id customizationId, tc.isDirty AS customizationIsDirty,
        tc.latestPublishedDate AS customizationLastPublishedDate,
        tc.status AS customizationStatus, tc.migrationStatus AS customizationMigrationStatus,
        tc.modifiedById AS customizationLastCustomizedById, tc.modified AS customizationLastCustomized,
        CONCAT(u.givenName, ' ', u.surname) AS customizationLastCustomizedByName,

        vs.id AS versionedSectionId, vs.name as versionedSectionName,
        vs.displayOrder as versionedSectionDisplayOrder,
        sc.id AS sectionCustomizationId, sc.migrationStatus AS sectionCustomizationMigrationStatus,
        (sc.guidance IS NOT NULL) AS sectionCustomizationHasGuidanceText,

        vq.id AS versionedQuestionId, vq.questionText as versionedQuestionText,
        vq.displayOrder as versionedQuestionDisplayOrder,
        qc.id AS questionCustomizationId, qc.migrationStatus AS questionCustomizationMigrationStatus,
        (qc.guidanceText IS NOT NULL) AS questionCustomizationHasGuidanceText,
        (qc.sampleText IS NOT NULL) AS questionCustomizationHasSampleText

      FROM templateCustomizations AS tc
        JOIN users AS u ON tc.modifiedById = u.id

        JOIN versionedTemplates AS vt ON vt.templateId = tc.templateId
        JOIN affiliations AS a ON vt.ownerId = a.uri

        JOIN versionedSections AS vs ON vt.id = vs.versionedTemplateId
          LEFT JOIN sectionCustomizations AS sc
          ON vs.sectionId = sc.sectionId AND sc.templateCustomizationId = tc.id

          LEFT JOIN versionedQuestions AS vq ON vs.id = vq.versionedSectionId
            LEFT JOIN questionCustomizations AS qc
            ON vq.questionId = qc.questionId AND qc.templateCustomizationId = tc.id
      WHERE vt.active = 1 AND tc.id = ?
      ORDER BY vs.displayOrder ASC, vq.displayOrder ASC;
    `;
    const results = await TemplateCustomization.query(
      context,
      sql,
      [templateCustomizationId.toString()],
      reference
    );
    return Array.isArray(results) ? results : [];
  };

  /**
   * Fetch custom sections for a template customization.
   *
   * @param context The Apollo context.
   * @param templateCustomizationId The ID of the template customization.
   * @param reference The reference string for logging.
   * @returns The custom section overviews for the template customization.
   */
  private static async fetchCustomSections(
    context: MyContext,
    templateCustomizationId: number,
    reference: string
  ): Promise<FetchCustomSectionResult[]> {
    const customSectionsSQL = `
      SELECT
        cs.id AS customSectionId, cs.migrationStatus AS customSectionMigrationStatus,
        cs.name AS customSectionName,
        cs.pinnedSectionType AS customSectionPinType,
        cs.pinnedSectionId AS customSectionPinId, cs.guidance
      FROM customSections AS cs
      WHERE cs.templateCustomizationId = ?
      ORDER BY cs.pinnedSectionType ASC, cs.pinnedSectionId ASC;
    `;
    const results = await TemplateCustomization.query(
      context,
      customSectionsSQL,
      [templateCustomizationId.toString()],
      reference
    );
    return Array.isArray(results) ? results : [];
  };

  /**
   * Fetch custom questions for a template customization.
   *
   * @param context The Apollo context.
   * @param templateCustomizationId The ID of the template customization.
   * @param reference The reference string for logging.
   * @returns The custom question overviews for the template customization.
   */
  private static async fetchCustomQuestions(
    context: MyContext,
    templateCustomizationId: number,
    reference: string
  ): Promise<FetchCustomQuestionResult[]> {
    const customQuestionsSQL = `
      SELECT
        cq.id AS customQuestionId, cq.migrationStatus AS customQuestionMigrationStatus,
        cq.questionText AS customQuestionText,
        cq.sectionType AS customQuestionSectionType, cq.sectionId AS customQuestionSectionId,
        cq.pinnedQuestionType AS customQuestionPinType,
        cq.pinnedQuestionId AS customQuestionPinId, cq.guidanceText, cq.sampleText
      FROM templateCustomizations AS tc
        JOIN customQuestions AS cq ON tc.id = cq.templateCustomizationId
      WHERE tc.id = ?
      ORDER BY cq.pinnedQuestionType ASC, cq.pinnedQuestionId ASC;
    `;
    const results = await TemplateCustomization.query(
      context,
      customQuestionsSQL,
      [templateCustomizationId.toString()],
      reference
    );
    return Array.isArray(results) ? results : [];
  };
}

/**
 * An affiliation's customizations to a funder template
 *
 * When an affiliation ADMIN user customizes a funder template, this object is created
 * to track the customization.
 *
 * The customization is initially set to `status: DRAFT` and `migrationStatus: OK`.
 *
 * The ADMIN can then add SectionCustomizations, QuestionCustomizations, CustomSections
 * and CustomQuestions. This object acts as the parent to those objects.
 *
 *   - SectionCustomizations: Custom guidance added directly to a funder
 *     template's Section.
 *   - QuestionCustomizations: Custom guidance and sample answer added directly
 *     to a funder template's Question.
 *   - CustomSections: A new section created by the ADMIN and attached to the
 *     funder template.
 *   - CustomQuestions: A new question created by the ADMIN and attached to
 *     EITHER their own CustomSection or to a funder template's Section.
 *
 * As the ADMIN makes changes to the above child object, this object's `isDirty`
 * is set to true.
 *
 * When the ADMIN publishes the customization. New versioned copies of this object
 * and all child objects are created. Then the following changes are made to this
 * object: `status: PUBLISHED`, `migrationStatus: OK`, `isDirty: false`,
 * `latestPublishedVersionId: <id>`, `latestPublishedDate: <date>`.
 *
 * The templateCustomizationService is called in some resolvers to determine if
 * the base funder template has changed. If so, the `migrationStatus` is set to
 * `STALE` and each child object is examined to determine its own unique
 * `migrationStatus`. If the base funder template has been archived, then the
 * `migrationStatus` is set to `ORPHANED`. If it has not been republished, the
 * `migrationStatus` is set to `OK`.
 *
 * When this object is deleted, all child objects and related versions will also
 * be deleted due to the `ON DELETE CASCADE` constraints in the database.
 */
export class TemplateCustomization extends MySqlModel {
  // Pointer to the affiliation that owns this customization
  public affiliationId: string;
  // Pointer to the base (not versioned) template that this object tracks
  public templateId: number;
  // Pointer to the current published version of the funder template
  public currentVersionedTemplateId: number;
  // The status of the customization
  public status: TemplateCustomizationStatus;
  // The status of the customizations with regard to the base template
  public migrationStatus: TemplateCustomizationMigrationStatus;
  // Pointer to the current published version of this customization
  public latestPublishedVersionId: number;
  // The date this customization was last published
  public latestPublishedDate: string;
  // Whether the customization has been modified since it was last published
  public isDirty: boolean;

  static tableName = 'templateCustomizations';

  constructor(options) {
    super(options.id, options.created, options.createdById, options.modified,
      options.modifiedById, options.errors);

    this.affiliationId = options.affiliationId;
    this.templateId = options.templateId;
    this.currentVersionedTemplateId = options.currentVersionedTemplateId;
    this.status = options.status ?? TemplateCustomizationStatus.DRAFT;
    this.migrationStatus = options.migrationStatus ?? TemplateCustomizationMigrationStatus.OK;
    this.latestPublishedVersionId = options.latestPublishedVersionId;
    this.latestPublishedDate = options.latestPublishedDate;
    this.isDirty = options.isDirty ?? false;
  }

  /**
   * Make sure the customization is valid. Any errors will be added to the
   * errors object.
   *
   * @returns true if the customization is valid, false otherwise.
   */
  async isValid(): Promise<boolean> {
    await super.isValid();

    if (isNullOrUndefined(this.affiliationId)) {
      this.addError('affiliationId', 'Affiliation can\'t be blank');
    }
    if (isNullOrUndefined(this.templateId)) {
      this.addError('templateId','Template can\'t be blank');
    }
    if (isNullOrUndefined(this.currentVersionedTemplateId)) {
      this.addError(
        'currentVersionedTemplateId',
        'Current template version can\'t be blank'
      );
    }

    return Object.keys(this.errors).length === 0;
  }

  /**
   * Publish the customization
   *
   * @param context The Apollo context.
   * @returns The published Template customization.
   */
  async publish(context: MyContext): Promise<TemplateCustomization> {
    if (!this.id) {
      // Cannot publish it if it hasn't been saved yet!
      this.addError('general', 'Customization has never been saved');

    } else if (this.status === TemplateCustomizationStatus.PUBLISHED || this.latestPublishedVersionId) {
        // Can't publish if it is already published!
        this.addError('general', 'Customization is already published!');

    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        // Create a new published version of the customization
        const newVersion = new VersionedTemplateCustomization(
          {
            affiliationId: this.affiliationId,
            templateCustomizationId: this.id,
            currentVersionedTemplateId: this.currentVersionedTemplateId,
            active: true
          }
        )

        const created: VersionedTemplateCustomization = await newVersion.create(context);

        if (!isNullOrUndefined(created) && !created.hasErrors() && created.id) {
          // Update the status of the customization to reflect the change
          this.status = TemplateCustomizationStatus.PUBLISHED;
          this.isDirty = false;
          this.latestPublishedVersionId = created.id;
          this.latestPublishedDate = created.created;
          const published: TemplateCustomization = await this.update(context);

          if (!published) {
            this.addError('general', 'Unable to publish');
          }
        } else {
          this.errors = created?.errors ?? this.errors;
        }
      }
    }
    return new TemplateCustomization(this);
  }

  /**
   * Unpublish the customization
   *
   * @param context The Apollo context.
   * @returns The unpublished Template customization.
   */
  async unpublish(context: MyContext): Promise<TemplateCustomization> {
    const ref = 'TemplateCustomization.unpublish';
    if (!this.id) {
      // Cannot unpublish it if it hasn't been saved yet!
      this.addError('general', 'Customization has never been saved');

    } else if (this.status !== TemplateCustomizationStatus.PUBLISHED && !this.latestPublishedVersionId) {
      // Can't unpublish if it isn't published!
      this.addError('general', 'Customization is not published!');

    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        const ver: VersionedTemplateCustomization = await VersionedTemplateCustomization.findById(
          ref,
          context,
          this.latestPublishedVersionId
        );

        if (ver) {
          // Deactivate the published version of the customization
          ver.active = false;
          const updatedVer: VersionedTemplateCustomization = await ver.update(context, false);

          if (isNullOrUndefined(updatedVer)) {
            this.addError('general', 'Unable to unpublish');
          } else {
            // Update the status of the customization to reflect the change
            this.status = TemplateCustomizationStatus.DRAFT;
            this.isDirty = false;
            this.latestPublishedVersionId = undefined;
            this.latestPublishedDate = undefined;
            const published: TemplateCustomization = await this.update(context);

            if (published) {
              return published;
            }

            this.addError('general', 'Unable to unpublish the customization');
          }
        }
      }
    }
    return new TemplateCustomization(this);
  }

  /**
   * Save the current record
   *
   * @param context The Apollo context.
   * @returns The newly created Template customization.
   */
  async create(context: MyContext): Promise<TemplateCustomization> {
    const ref = 'TemplateCustomization.create';
    // Make sure the record is valid
    if (await this.isValid()) {
      const current: TemplateCustomization = await TemplateCustomization.findByAffiliationAndTemplate(
        ref,
        context,
        this.affiliationId,
        this.templateId
      );

      // Make sure it doesn't already exist
      if (!isNullOrUndefined(current)) {
        this.addError('general', 'Template has already been customized');
      } else {
        // Save the record and then fetch it
        const newId: number = await TemplateCustomization.insert(
          context,
          TemplateCustomization.tableName,
          this,
          ref
        );
        return await TemplateCustomization.findById(ref, context, newId);
      }
    }
    // Otherwise return as-is with all the errors
    return new TemplateCustomization(this);
  }

  /**
   * Update the record
   *
   * @param context The Apollo context
   * @param noTouch Whether or not the modification timestamp should be updated
   * @returns The updated Template customization.
   */
  async update(context: MyContext, noTouch = false): Promise<TemplateCustomization> {
    const ref = 'TemplateCustomization.update';

    if (!this.id) {
      // We cannot update it if the customization has never been saved!
      this.addError('general', 'Customization has never been saved');
    } else {
      // Make sure the record is valid
      if (await this.isValid()) {
        // Set the isDirty flag if the customization is published
        if (this.latestPublishedVersionId && !noTouch) {
          this.isDirty = true;
        }

        await TemplateCustomization.update(
          context,
          TemplateCustomization.tableName,
          this,
          ref,
          [],
          noTouch
        );
        return await TemplateCustomization.findById(ref, context, this.id);
      }
    }
    // Otherwise return as-is with all the errors
    return new TemplateCustomization(this);
  }

  /**
   * Archive the customization
   *
   * @param context The Apollo context
   * @returns The archived Template customization.
   */
  async delete(context: MyContext): Promise<TemplateCustomization> {
    const ref = 'TemplateCustomization.delete';
    if (!this.id) {
      // Cannot delete it if it hasn't been saved yet!
      this.addError('general', 'Customization has never been saved');
    } else {
      const original: TemplateCustomization = await TemplateCustomization.findById(
        ref,
        context,
        this.id
      );
      const result: boolean = await TemplateCustomization.delete(
        context,
        TemplateCustomization.tableName,
        this.id,
        ref
      );
      if (result) {
        return original;
      }
    }
    if (!this.hasErrors()) {
      this.addError('general', 'Failed to remove customization');
    }
    // Otherwise return as-is with all the errors
    return new TemplateCustomization(this);
  }

  /**
   * Update the specified templateCustomization's isDirty flag to true
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizationId The template customization id.
   * @returns true if the customization was updated or was already dirty
   */
  static async markAsDirty(
    reference: string,
    context: MyContext,
    templateCustomizationId: number
  ): Promise<boolean> {
    const customization: TemplateCustomization = await TemplateCustomization.findById(
      reference,
      context,
      templateCustomizationId
    );
    if (isNullOrUndefined(customization)) return false;

    // If its already dirty just return true
    if (customization.isDirty) return true;

    customization.isDirty = true;
    const updated: TemplateCustomization = await customization.update(context);

    // Return true if the update was successful
    return !isNullOrUndefined(updated) && !updated.hasErrors();
  }

  /**
   * Find the customization by its id
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateCustomizationId The template customization id.
   * @returns The Template customization.
   */
  static async findById(
    reference: string,
    context: MyContext,
    templateCustomizationId: number
  ): Promise<TemplateCustomization> {
    const results = await TemplateCustomization.query(
      context,
      `SELECT * FROM ${TemplateCustomization.tableName} WHERE id = ?`,
      [templateCustomizationId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new TemplateCustomization(results[0]) : undefined;
  }

  /**
   * Find the customization by the affiliation and template
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param affiliationId The affiliation id.
   * @param templateId The template id.
   * @returns The Template customization.
   */
  static async findByAffiliationAndTemplate(
    reference: string,
    context: MyContext,
    affiliationId: string,
    templateId: number
  ): Promise<TemplateCustomization> {
    const results = await TemplateCustomization.query(
      context,
      `SELECT * FROM ${TemplateCustomization.tableName}
         WHERE affiliationId = ? AND templateId = ?`,
      [affiliationId, templateId?.toString()],
      reference
    );
    return Array.isArray(results) && results.length > 0 ? new TemplateCustomization(results[0]) : undefined;
  }

  /**
   * Find all the customizations for a given funder template
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param templateId The template id.
   * @returns The Template customizations.
   */
  static async findByTemplateId(
    reference: string,
    context: MyContext,
    templateId: number
  ): Promise<TemplateCustomization[]> {
    const results = await TemplateCustomization.query(
      context,
      `SELECT * FROM ${TemplateCustomization.tableName} WHERE templateId = ?`,
      [templateId?.toString()],
      reference
    )
    return Array.isArray(results) ? results.map(c => new TemplateCustomization(c)) : [];
  }

  /**
   * Find all the customizations for a given published version of a funder template
   *
   * @param reference The reference to use for logging errors.
   * @param context The Apollo context.
   * @param versionedTemplateId The versioned template id.
   * @returns The Template customizations.
   */
  static async findByVersionedTemplateId(
    reference: string,
    context: MyContext,
    versionedTemplateId: number
  ): Promise<TemplateCustomization[]> {
    const results = await TemplateCustomization.query(
      context,
      `SELECT * FROM ${TemplateCustomization.tableName}
         WHERE currentVersionedTemplateId = ?`,
      [versionedTemplateId?.toString()],
      reference
    )
    return Array.isArray(results) ? results.map(c => new TemplateCustomization(c)) : [];
  }
}
