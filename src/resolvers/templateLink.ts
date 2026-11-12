import { Resolvers } from "../types.js";
import { MyContext } from "../context.js";
import { Template } from "../models/Template.js";
import { Affiliation } from "../models/Affiliation.js";
import { VersionedTemplate } from "../models/VersionedTemplate.js";
import { maxTemplateLinks, TemplateLink, TemplateLinkType } from "../models/TemplateLink.js";
import { VersionedTemplateLink } from "../models/VersionedTemplateLink.js";
import { UserRole } from "../models/User.js";
import { authenticatedResolver } from "../services/authService.js";
import { hasPermissionOnTemplate } from "../services/templateService.js";
import { ForbiddenError, NotFoundError } from "../utils/graphQLErrors.js";
import { normaliseDateTime } from "../utils/helpers.js";

// Fetch the Template and verify that the current user is allowed to modify it
const findAuthorizedTemplate = async (
  reference: string,
  context: MyContext,
  templateId: number
): Promise<Template> => {
  const template = await Template.findById(reference, context, templateId);
  if (!template) throw NotFoundError('Template not found');

  if (!(await hasPermissionOnTemplate(context, template))) throw ForbiddenError();

  return template;
}

// Fetch the TemplateLink and verify that the current user is allowed to modify its Template
const findAuthorizedTemplateLink = async (
  reference: string,
  context: MyContext,
  templateLinkId: number
): Promise<{ link: TemplateLink, template: Template }> => {
  const link = await TemplateLink.findById(reference, context, templateLinkId);
  if (!link) throw NotFoundError('Template link not found');

  const template = await findAuthorizedTemplate(reference, context, link.templateId);
  return { link, template };
}

export const FUNDER_ONLY_ERROR = 'Links can only be added to templates owned by a funder';

// Funder and sample plan links are only available on Templates owned by a funder affiliation
const isOwnedByFunder = async (reference: string, context: MyContext, template: Template): Promise<boolean> => {
  const owner = await Affiliation.findByURI(reference, context, template.ownerId);
  return owner?.funder === true;
}

// Touch the Template so that it is flagged as having changes that have not been published
const markTemplateAsDirty = async (context: MyContext, template: Template): Promise<void> => {
  await new Template({ ...template }).update(context);
}

export const resolvers: Resolvers = {
  Mutation: {
    // Add a funder or sample plan link to a Template
    //    - called by the Template Builder's "Links" sidebar
    addTemplateLink: authenticatedResolver(
      'addTemplateLink resolver',
      UserRole.ADMIN,
      async (_, { templateId, linkType, url, text }, context: MyContext): Promise<TemplateLink> => {
        const reference = 'addTemplateLink resolver';
        const template = await findAuthorizedTemplate(reference, context, templateId);

        if (!(await isOwnedByFunder(reference, context, template))) {
          const link = new TemplateLink({ templateId: template.id, linkType, url, text });
          link.addError('general', FUNDER_ONLY_ERROR);
          return link;
        }

        const created = await new TemplateLink({ templateId: template.id, linkType: linkType as TemplateLinkType, url, text })
          .create(context);

        if (created && !created.hasErrors()) {
          await markTemplateAsDirty(context, template);
        }
        return created;
      }
    ),

    // Update the URL and/or text of a Template link
    //    - called by the Template Builder's "Edit link" modal
    updateTemplateLink: authenticatedResolver(
      'updateTemplateLink resolver',
      UserRole.ADMIN,
      async (_, { templateLinkId, url, text }, context: MyContext): Promise<TemplateLink> => {
        const reference = 'updateTemplateLink resolver';
        const { link, template } = await findAuthorizedTemplateLink(reference, context, templateLinkId);

        if (!(await isOwnedByFunder(reference, context, template))) {
          link.addError('general', FUNDER_ONLY_ERROR);
          return link;
        }

        const toUpdate = new TemplateLink({ ...link, url, text });
        const updated = await toUpdate.update(context);

        if (updated && !updated.hasErrors()) {
          await markTemplateAsDirty(context, template);
        }
        return updated;
      }
    ),

    // Remove a link from a Template
    //    - called by the Template Builder's "Links" sidebar
    removeTemplateLink: authenticatedResolver(
      'removeTemplateLink resolver',
      UserRole.ADMIN,
      async (_, { templateLinkId }, context: MyContext): Promise<TemplateLink> => {
        const reference = 'removeTemplateLink resolver';
        const { link, template } = await findAuthorizedTemplateLink(reference, context, templateLinkId);

        const removed = await new TemplateLink({ ...link }).delete(context);
        if (!removed) {
          link.addError('general', 'Unable to remove the link');
          return link;
        }

        await markTemplateAsDirty(context, template);
        return removed;
      }
    ),
  },

  Template: {
    // Chained resolver to fetch the Template's links
    links: async (parent: Template, { linkType }, context: MyContext): Promise<TemplateLink[]> => {
      if (parent.id) {
        return await TemplateLink.findByTemplateId(
          'Chained Template.links',
          context,
          parent.id,
          linkType as TemplateLinkType
        );
      }
      return [];
    },

    // The maximum number of links of the specified type that the Template can have
    maxLinks: (_parent: Template, { linkType }): number => {
      return maxTemplateLinks(linkType as TemplateLinkType);
    },
  },

  VersionedTemplate: {
    // Chained resolver to fetch the links captured when the Template was versioned
    links: async (parent: VersionedTemplate, { linkType }, context: MyContext): Promise<VersionedTemplateLink[]> => {
      if (parent.id) {
        return await VersionedTemplateLink.findByVersionedTemplateId(
          'Chained VersionedTemplate.links',
          context,
          parent.id,
          linkType as TemplateLinkType
        );
      }
      return [];
    },
  },

  TemplateLink: {
    created: (parent: TemplateLink) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: TemplateLink) => {
      return normaliseDateTime(parent.modified);
    },
  },

  VersionedTemplateLink: {
    created: (parent: VersionedTemplateLink) => {
      return normaliseDateTime(parent.created);
    },
    modified: (parent: VersionedTemplateLink) => {
      return normaliseDateTime(parent.modified);
    },
  },
};
