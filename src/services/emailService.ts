// TODO: Store the automated email in a table so we can eventually have a UI page for
//       SuperAdmins to update them.
//       Load the appropriate message and send it out
import nodemailer from 'nodemailer';
import { MyContext } from "../context";
import { User } from "../models/User";
import { awsConfig } from "../config/awsConfig";
import { emailConfig } from "../config/emailConfig";
import { prepareObjectForLogs } from "../logger";
import { generalConfig } from '../config/generalConfig';

export const emailSubjects = {
  emailConfirmation: 'Please confirm your email address',
  projectCollaboration: 'You were invited to collaborate on a data management plan',
  templateCollaboration: 'You were invited to collaborate on a template',
  projectCollaboratorCommentsAdded: 'New comments added to the plan'
}

export const emailMessages = {
  emailConfirmation: `<p>This is a placeholder until we get the email confirmation tokens setup.</p>`,
  projectCollaboration: `
<p>%{inviterName} has invited you to collaborate on their data management plan: "%{projectTitle}".</p>
<p>Placeholder text for a project collaboration email.</p>
`,
  templateCollaboration: `
<p>%{inviterName} has invited you to collaborate on their template: "%{templateTitle}".</p>
<p>Placeholder text for a template collaboration email.</p>
`,
  projectCollaboratorCommentsAdded: `
<p>New comments were added to the plan.</p>
`,
}

const transporter = nodemailer.createTransport({
  host: awsConfig.sesEndpoint,
  // Use the SES TLS port
  port: awsConfig.port,
  // Use TLS/SSL from the start
  secure: true,
  auth: {
    user: awsConfig.sesAccessKey,
    pass: awsConfig.sesAccessSecret,
  },
});

// Function to either send or log an email notification based on the environment
const sendEmail = async (
  context: MyContext,
  emailType: string,
  toAddresses: string[],
  ccAddresses: string[] = [],
  bccAddresses: string[] = [],
  subject: string,
  message: string,
  asHTML = true,
): Promise<boolean> => {

  // Add the App name to the start of the subject line. We include the env when not in production
  const subjectLine = `${generalConfig.applicationName} - ${subject}`;

  if (['development'].includes(process.env.NODE_ENV)) {
    // When running in development mode, we do not have access to AWS SES and we probably don't want to
    // actually send emails to people by accident so so just log the message
    context.logger.info(
      prepareObjectForLogs({ toAddresses, ccAddresses, bccAddresses, subjectLine, message, asHTML }),
      `Logging email notification of type '${emailType}' because we are in ${process.env.NODE_ENV} mode`
    );
    return true;

  } else {
    // Otherwise go ahead and send the email
    let response;
    const options = {
      from: `"${generalConfig.applicationName}" <${emailConfig.doNotReplyAddress}>`,
      sender: emailConfig.doNotReplyAddress,
      replyTo: emailConfig.helpDeskAddress,
      to: toAddresses.join(', '),
      cc: ccAddresses.join(', '),
      bcc: bccAddresses.join(', '),
      subject: subjectLine,
    };
    context.logger.debug(prepareObjectForLogs(options), `Preparing to send ${emailType} email`);

    try {
      // Send as HTML (default) or text depending on what was specified
      if (asHTML) {
        response = await transporter.sendMail({ ...options, html: message });
      } else {
        response = await transporter.sendMail({ ...options, text: message });
      }
      const logInfo = { id: response?.messageId, to: toAddresses, subject: subject };
      context.logger.info(prepareObjectForLogs(logInfo), `${emailType} email sent`);

      return true;
    } catch (err) {
      context.logger.error(prepareObjectForLogs({ err, options }), `Unable to send ${emailType} email`);
    }
    return false;
  }
}

// Send out an email asking the user to confirm the email address
export const sendEmailConfirmationNotification = async (context: MyContext, email: string): Promise<boolean> => {
  return await sendEmail(
    context,
    'EmailConfirmation',
    [email],
    [],
    [],
    emailSubjects.emailConfirmation,
    emailMessages.emailConfirmation,
  );
}

// Send out the collaboration email. Note that the emails should be different based on whether or not
// the userId is present. If no userId is present we are inviting them to create an account.
export const sendTemplateCollaborationEmail = async (
  context: MyContext,
  templateName: string,
  inviterName: string,
  email: string,
  userId?: number
): Promise<boolean> => {
  let toAddress = email;
  const message = emailMessages.templateCollaboration;

  if (userId) {
    const user = await User.findById('sendTemplateCollaborationEmail', context, userId);
    // Bail out if the user has asked us not to send these notifications
    if (!user.notify_on_template_shared) {
      return false;
    }
    // Use the user's primary email address, regardless of what was provided
    toAddress = await user.getEmail(context);
  }

  return await sendEmail(
    context,
    'TemplateCollaboration',
    [toAddress],
    [],
    [],
    emailSubjects.templateCollaboration,
    message.replace('%{inviterName}', inviterName).replace('%{templateTitle}', templateName),
  );
}

export const sendProjectCollaborationEmail = async (
  context: MyContext,
  projectTitle: string,
  inviterName: string,
  email: string,
  userId?: number,
): Promise<boolean> => {
  let toAddress = email;
  const message = emailMessages.projectCollaboration;

  if (userId) {
    const user = await User.findById('sendProjectCollaborationEmail', context, userId);
    // Bail out if the user has asked us not to send these notifications
    if (!user.notify_on_template_shared) {
      return false;
    }
    // Use the user's primary email address, regardless of what was provided
    toAddress = await user.getEmail(context);
  }

  return await sendEmail(
    context,
    'ProjectCollaboration',
    [toAddress],
    [],
    [],
    emailSubjects.projectCollaboration,
    message.replace('%{inviterName}', inviterName).replace('%{projectTitle}', projectTitle),
  );
}

export const sendProjectCollaboratorsCommentsAddedEmail = async (
  context: MyContext,
  collaboratorEmails: string[],
): Promise<boolean> => {
  if (collaboratorEmails.length === 0) {
    return false;
  };

  const message = emailMessages.projectCollaboratorCommentsAdded;

  // Send each collaborator their own email
  for (const email of collaboratorEmails) {
    await sendEmail(
      context,
      'ProjectCommentsAdded',
      [email],
      [],
      [],
      emailSubjects.projectCollaboratorCommentsAdded,
      message,
    );
  }
  return true;
}
