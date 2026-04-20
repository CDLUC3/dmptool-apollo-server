-- Add messageToOrg column to feedback table, which can be NULL
ALTER TABLE `feedback`
ADD COLUMN `messageToOrg` text NULL AFTER `completed`;