-- Add the SSO entity ID for local testing
update affiliations set ssoEntityId = 'urn:mace:incommon:ucop.edu' where name = 'California Digital Library';
-- Add the email domain for local testing
insert into affiliationEmailDomains (affiliationId, emailDomain, createdById, created, modifiedById, modified)
values ('https://ror.org/03yrm5c26', 'ucop.edu', 1, CURRENT_TIMESTAMP(), 1, CURRENT_TIMESTAMP());
