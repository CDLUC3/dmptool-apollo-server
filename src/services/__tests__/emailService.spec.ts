/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';
import casual from "casual";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();

const mockSendEmail = jest.fn<(...args: any[]) => Promise<boolean>>().mockResolvedValue(true);

const mockCreateTransport = jest.fn().mockImplementation(() => ({
  sendMail: mockSendEmail,
}));

// No pre-import of the real module here — nodemailer only exports
// createTransport (plus a couple of things we never use), and importing
// it "for real" first is exactly what broke interception on this
// specifier. __esModule + default are needed because emailService.js does
// `import nodemailer from 'nodemailer'` (a default import), not a named one.
jest.unstable_mockModule('nodemailer', () => ({
  __esModule: true,
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

async function autoMockModule(specifier: string): Promise<void> {
  const actual: Record<string, any> = await import(specifier);
  const mocked: Record<string, any> = {};
  for (const [key, value] of Object.entries(actual)) {
    mocked[key] = typeof value === 'function' ? jest.fn() : value;
  }
  jest.unstable_mockModule(specifier, () => mocked);
}
await autoMockModule('../../config/awsConfig.js');

import { MyContext } from "../../context.js";


const { buildMockContextWithToken } = await import('../../__mocks__/context.js');
const { logger } = await import("../../logger.js");
const {
  emailMessages,
  emailSubjects,
  sendEmailConfirmationNotification,
  sendProjectCollaborationEmail,
  sendTemplateCollaborationEmail,
  sendProjectCollaboratorsCommentsAddedEmail,
  sendFeedbackCompleteEmail,
  sendContactUsEmail,
  sendResetPasswordEmail,
} = await import("../emailService.js");
const { generalConfig } = await import("../../config/generalConfig.js");
const { emailConfig } = await import("../../config/emailConfig.js");
const { User } = await import("../../models/User.js");

let context: MyContext;

const subjectPrefix = `${generalConfig.applicationName}`;
process.env.NODE_ENV = 'test';

beforeEach(async () => {
  jest.resetAllMocks();

  context = await buildMockContextWithToken(logger);
});

afterEach(() => {
  jest.clearAllMocks();
})

describe('sendEmail', () => {
  it('sends the confirmation email', async () => {
    jest.spyOn(logger, 'info');
    const email = casual.email;
    const sent = await sendEmailConfirmationNotification(context, email);

    const expectedSubject = `${subjectPrefix} - ${emailSubjects.emailConfirmation}`

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      "bcc": "",
      "cc": "",
      "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
      "html": emailMessages.emailConfirmation,
      "replyTo": emailConfig.helpDeskAddress,
      "sender": emailConfig.doNotReplyAddress,
      "subject": expectedSubject,
      "to": email,
    });
  });

  it('sends the template collaboration email', async () => {
    jest.spyOn(logger, 'info');
    const email = casual.email;
    const templateName = casual.sentence;
    const inviterName = `${casual.first_name} ${casual.last_name}`;
    const sent = await sendTemplateCollaborationEmail(context, templateName, inviterName, email);

    const expectedSubject = `${subjectPrefix} - ${emailSubjects.templateCollaboration}`
    const expectedMessage = emailMessages.templateCollaboration;

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      "bcc": "",
      "cc": "",
      "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
      "html": expectedMessage.replace('%{templateTitle}', templateName).replace('%{inviterName}', inviterName),
      "replyTo": emailConfig.helpDeskAddress,
      "sender": emailConfig.doNotReplyAddress,
      "subject": expectedSubject,
      "to": email,
    });
  });

  it('sends the template collaboration email to the user\'s primary email', async () => {
    jest.spyOn(logger, 'info');
    const email = casual.email;
    const user = new User({
      id: casual.integer(1, 99),
      created: new Date(),
      createdById: 1,
      modified: new Date(),
      modifiedById: 1,
      errors: [],
      givenName: casual.first_name,
      surName: casual.last_name,
      // add any other required fields
    });

    const templateName = casual.sentence;
    const inviterName = `${casual.first_name} ${casual.last_name}`;

    jest.spyOn(User.prototype, 'getEmail').mockResolvedValue(email);
    (User.findById as jest.Mock) = jest.fn<() => Promise<InstanceType<typeof User> | null>>().mockResolvedValueOnce(user);
    const sent = await sendTemplateCollaborationEmail(context, templateName, inviterName, email, user.id);

    const expectedSubject = `${subjectPrefix} - ${emailSubjects.templateCollaboration}`
    const expectedMessage = emailMessages.templateCollaboration;

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      "bcc": "",
      "cc": "",
      "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
      "html": expectedMessage.replace('%{templateTitle}', templateName).replace('%{inviterName}', inviterName),
      "replyTo": emailConfig.helpDeskAddress,
      "sender": emailConfig.doNotReplyAddress,
      "subject": expectedSubject,
      "to": email,
    });
  });

  it('sends the project collaboration email', async () => {
    jest.spyOn(logger, 'info');
    const email = casual.email;
    jest.spyOn(User.prototype, 'getEmail').mockResolvedValue(email);
    const projectName = casual.sentence;
    const inviterName = `${casual.first_name} ${casual.last_name}`;
    const sent = await sendProjectCollaborationEmail(context, projectName, inviterName, email);

    const expectedSubject = `${subjectPrefix} - ${emailSubjects.projectCollaboration}`
    const expectedMessage = emailMessages.projectCollaboration;

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      "bcc": "",
      "cc": "",
      "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
      "html": expectedMessage.replace('%{projectTitle}', projectName).replace('%{inviterName}', inviterName),
      "replyTo": emailConfig.helpDeskAddress,
      "sender": emailConfig.doNotReplyAddress,
      "subject": expectedSubject,
      "to": email,
    });
  });

  it('sends the project collaboration email to the user\'s primary email', async () => {
    jest.spyOn(logger, 'info');
    jest.spyOn(context.logger, 'error');
    const email = casual.email;
    const user = new User({
      id: casual.integer(1, 99),
      givenName: casual.first_name,
      surName: casual.last_name,
    });
    const projectName = casual.sentence;
    const inviterName = `${casual.first_name} ${casual.last_name}`;

    jest.spyOn(User.prototype, 'getEmail').mockResolvedValue(email);

    (User.findById as jest.Mock) = jest.fn<() => Promise<InstanceType<typeof User> | null>>().
      mockResolvedValueOnce(user);
    const sent = await sendProjectCollaborationEmail(context, projectName, inviterName, email, user.id);
    const expectedSubject = `${subjectPrefix} - ${emailSubjects.projectCollaboration}`
    const expectedMessage = emailMessages.projectCollaboration;

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      "bcc": "",
      "cc": "",
      "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
      "html": expectedMessage.replace('%{projectTitle}', projectName).replace('%{inviterName}', inviterName),
      "replyTo": emailConfig.helpDeskAddress,
      "sender": emailConfig.doNotReplyAddress,
      "subject": expectedSubject,
      "to": email,
    });
  });

  it('should send the project collaborators emails when a comment is added', async () => {
    jest.spyOn(logger, 'info');
    const email = casual.email;
    const emails = Array.from({ length: 5 }, () => casual.email);
    jest.spyOn(User.prototype, 'getEmail').mockResolvedValue(email);
    const sent = await sendProjectCollaboratorsCommentsAddedEmail(context, emails);

    const expectedSubject = `${subjectPrefix} - ${emailSubjects.projectCollaboratorCommentsAdded}`
    const expectedMessage = emailMessages.projectCollaboratorCommentsAdded;

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(5);
    // sendEmail should have been called once per email
    expect(mockSendEmail).toHaveBeenCalledTimes(emails.length);
    for (const email of emails) {
      expect(mockSendEmail).toHaveBeenCalledWith({
        "bcc": "",
        "cc": "",
        "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
        "html": expectedMessage,
        "replyTo": emailConfig.helpDeskAddress,
        "sender": emailConfig.doNotReplyAddress,
        "subject": expectedSubject,
        "to": email,
      });
    }
  });

  it('should return false and does not send email when no collaborator emails provided', async () => {
    const sent = await sendProjectCollaboratorsCommentsAddedEmail(context, []);

    expect(sent).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('should send plan owner an email when feedback is complete', async () => {
    jest.spyOn(logger, 'info');
    const email = casual.email;
    const planOwnerUserId = casual.integer(1, 99);
    const adminName = `${casual.first_name} ${casual.last_name}`;
    const planTitle = casual.sentence;
    const planURL = casual.url;
    const user = new User({
      id: planOwnerUserId,
      givenName: casual.first_name,
      surName: casual.last_name,
      notify_on_feedback_complete: true,
    });
    (User.findById as jest.Mock) = jest.fn<() => Promise<InstanceType<typeof User> | null>>().mockResolvedValueOnce(user);
    jest.spyOn(User.prototype, 'getEmail').mockResolvedValue(email);
    const sent = await sendFeedbackCompleteEmail(context, planOwnerUserId, adminName, planTitle, planURL);

    const expectedSubject = `${subjectPrefix} - ${emailSubjects.feedbackComplete}`;
    const planOwnerName = [user.givenName, user.surName].filter(Boolean).join(' ');
    const domain = generalConfig.domain;
    const expectedMessage = emailMessages.feedbackComplete
      .replace('%{planOwnerName}', planOwnerName)
      .replace('%{adminName}', adminName)
      .replace('%{planUrl}', `${domain}${planURL}`)
      .replace('%{planTitle}', planTitle)
      .replace('%{profileUrl}', `${domain}/account/profile`)
      .replace('%{helpDeskEmail}', emailConfig.helpDeskAddress)
      .replace('%{helpUrl}', `${domain}/help`);

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    // sendEmail should have been called once
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      "bcc": "",
      "cc": "",
      "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
      "html": expectedMessage,
      "replyTo": emailConfig.helpDeskAddress,
      "sender": emailConfig.doNotReplyAddress,
      "subject": expectedSubject,
      "to": email,
    });
  });

  it('should return false when user has notify_on_feedback_complete disabled', async () => {
    const planOwnerUserId = casual.integer(1, 99);
    const user = new User({
      id: planOwnerUserId,
      givenName: casual.first_name,
      surName: casual.last_name,
      notify_on_feedback_complete: false,
    });
    (User.findById as jest.Mock) = jest.fn<() => Promise<InstanceType<typeof User> | null>>().mockResolvedValueOnce(user);

    const sent = await sendFeedbackCompleteEmail(
      context,
      planOwnerUserId,
      casual.full_name,
      casual.sentence,
      casual.url,
    );

    expect(sent).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('should log an error and return false when the plan owner has no email address', async () => {
    jest.spyOn(context.logger, 'error');
    const planOwnerUserId = casual.integer(1, 99);
    const user = new User({
      id: planOwnerUserId,
      givenName: casual.first_name,
      surName: casual.last_name,
      notify_on_feedback_complete: true,
    });
    (User.findById as jest.Mock) = jest.fn<() => Promise<InstanceType<typeof User> | null>>().mockResolvedValueOnce(user);
    jest.spyOn(User.prototype, 'getEmail').mockResolvedValue(null);

    const sent = await sendFeedbackCompleteEmail(
      context,
      planOwnerUserId,
      casual.full_name,
      casual.sentence,
      casual.url,
    );

    expect(sent).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(context.logger.error).toHaveBeenCalledTimes(1);
  });

  it('should send feedback request emails to all collaborators', async () => {
    jest.spyOn(logger, 'info');
    const emails = Array.from({ length: 3 }, () => casual.email);
    const planOwnerName = `${casual.first_name} ${casual.last_name}`;
    const planURL = `/plans/${casual.uuid}`;
    const planTitle = casual.sentence;
    const feedbackMessage = casual.sentence;
    // Import here to avoid hoisting issues
    const { sendFeedbackRequestEmail } = await import('../emailService.js');
    const sent = await sendFeedbackRequestEmail(context, planOwnerName, planURL, planTitle, emails, feedbackMessage);

    const expectedSubject = `${subjectPrefix} - ${emailSubjects.feedbackRequest}`;
    const domain = generalConfig.domain;
    const baseHtml = emailMessages.feedbackRequest
      .replace('%{planOwnerName}', planOwnerName)
      .replace('%{feedbackRequestMessage}', feedbackMessage)
      .replace('%{planUrl}', `${domain}${planURL}`)
      .replace('%{planTitle}', planTitle)
      .replace('%{profileUrl}', `${domain}/account/profile`)
      .replace('%{helpDeskEmail}', emailConfig.helpDeskAddress)
      .replace('%{helpUrl}', `${domain}/help`);

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(emails.length);
    expect(mockSendEmail).toHaveBeenCalledTimes(emails.length);
    for (const email of emails) {
      const expectedHtml = baseHtml.replace('%{adminEmail}', email);
      expect(mockSendEmail).toHaveBeenCalledWith({
        "bcc": "",
        "cc": "",
        "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
        "html": expectedHtml,
        "replyTo": emailConfig.helpDeskAddress,
        "sender": emailConfig.doNotReplyAddress,
        "subject": expectedSubject,
        "to": email,
      });
    }
  });

  it('should send the contact us email', async () => {
    jest.spyOn(logger, 'info');
    const name = `${casual.first_name} ${casual.last_name}`;
    const email = casual.email;
    const subject = casual.sentence;
    const message = casual.sentence;

    const sent = await sendContactUsEmail(context, name, email, subject, message);

    const expectedSubject = `${subjectPrefix} - ${emailSubjects.contactUs}: ${subject}`;
    const attribution = `Sent by ${name} <${email}>`;
    const expectedHtml = emailMessages.contactUs
      .replace('%{message}', message)
      .replace('%{attribution}', attribution);

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      "bcc": "",
      "cc": "",
      "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
      "html": expectedHtml,
      "replyTo": email,
      "sender": emailConfig.doNotReplyAddress,
      "subject": expectedSubject,
      "to": emailConfig.helpDeskAddress,
    });
  });

  it('should send the reset password email', async () => {
    jest.spyOn(logger, 'info');
    const emailAddress = "dmp@cdlib.org";
    const userEmail = "jsmith@example.com";
    const resetToken = casual.uuid;
    const user = new User({
      id: casual.integer(1, 99),
      givenName: casual.first_name,
      surName: casual.last_name,
    });
    jest.spyOn(User.prototype, 'getEmail').mockResolvedValue(emailAddress);

    const sent = await sendResetPasswordEmail(context, user, userEmail, resetToken);

    const expectedSubject = `${subjectPrefix} - Reset Your Password`;
    const domain = generalConfig.domain;
    const resetPasswordUrl = `${domain}/login/reset-password?token=${resetToken}`;
    const expectedMessage = emailMessages.sendResetPassword
      .replace('%{userEmail}', userEmail)
      .replace('%{resetPasswordUrl}', resetPasswordUrl)
      .replaceAll('%{helpDeskEmail}', emailConfig.helpDeskAddress)
      .replace('%{helpUrl}', `${domain}/help`);

    expect(sent).toBe(true);
    expect(logger.info).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledTimes(1);
    expect(mockSendEmail).toHaveBeenCalledWith({
      "bcc": "",
      "cc": "",
      "from": `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
      "html": expectedMessage,
      "replyTo": emailConfig.helpDeskAddress,
      "sender": emailConfig.doNotReplyAddress,
      "subject": expectedSubject,
      "to": userEmail,
    });
  });

  it('should log an error and return false when the user has no email address for reset password', async () => {
    jest.spyOn(context.logger, 'error');
    const user = new User({
      id: casual.integer(1, 99),
      givenName: casual.first_name,
      surName: casual.last_name,
    });
    jest.spyOn(User.prototype, 'getEmail').mockResolvedValue(null);

    const sent = await sendResetPasswordEmail(context, user, undefined, casual.uuid);

    expect(sent).toBe(false);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(context.logger.error).toHaveBeenCalledTimes(1);
  });
});
