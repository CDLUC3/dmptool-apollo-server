import * as dotenv from 'dotenv';
import { verifyCriticalEnvVariable } from '../utils/helpers.js';

dotenv.config();

verifyCriticalEnvVariable('HELPDESK_EMAIL_ADDRESS');

export const emailConfig = {
  helpDeskAddress: process.env.HELPDESK_EMAIL_ADDRESS,
  doNotReplyAddress: process.env.DO_NOT_REPLY_EMAIL_ADDRESS || `do-not-reply@${process.env.DOMAIN}`,
}
