const mockSendEmail = jest.fn().mockResolvedValue(true);

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({
    sendMail: mockSendEmail,
  })),
}));

jest.mock('../../config/awsConfig');

import casual from "casual";
import { buildMockContextWithToken } from '../../__mocks__/context';
import { logger } from "../../logger";
import {
  emailMessages,
  emailSubjects,
  sendEmailConfirmationNotification,
  sendProjectCollaborationEmail,
  sendTemplateCollaborationEmail,
  sendProjectCollaboratorsCommentsAddedEmail
} from "../emailService";
import { generalConfig } from "../../config/generalConfig";
import { emailConfig } from "../../config/emailConfig";
import { User } from "../../models/User";

let context;

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
    (User.findById as jest.Mock) = jest.fn().mockResolvedValueOnce(user);
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
    const email = casual.email;
    const user = new User({
      id: casual.integer(1, 99),
      givenName: casual.first_name,
      surName: casual.last_name,
    });
    const projectName = casual.sentence;
    const inviterName = `${casual.first_name} ${casual.last_name}`;

    jest.spyOn(User.prototype, 'getEmail').mockResolvedValue(email);

    (User.findById as jest.Mock) = jest.fn().
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
});
