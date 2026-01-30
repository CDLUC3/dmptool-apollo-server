-- Add the research output types we support
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'audiovisual', 'Audiovisual', 'A series of visual representations imparting an impression of motion when shown in succession. May or may not include sound. (e.g. films, video, etc.)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'collection', 'Collection', 'An aggregation of resources, which may encompass collections of one resourceType as well as those of mixed types. A collection is described as a group; its parts may also be separately described. (e.g. A collection of samples, or various files making up a report)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'data-paper', 'Data paper', 'A factual and objective publication with a focused intent to identify and describe specific data, sets of data, or data collections to facilitate discoverability. (i.e. A data paper describes data provenance and methodologies used in the gathering, processing, organizing, and representing the data)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'dataset', 'Dataset', 'Data encoded in a defined structure.', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'event', 'Event', 'A non-persistent, time-based occurrence. (i.e. Descriptive information and/or content that is the basis for discovery of the purpose, location, duration, and responsible agents associated with an event such as a webcast or convention)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'image', 'Image', 'A visual representation other than text. (e.g. Digitised or born digital images, drawings or photographs)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'interactive-resource', 'Interactive resource', 'A resource requiring interaction from the user to be understood, executed, or experienced. (e.g. Training modules, files that require use of a viewer (e.g., Flash), or query/response portals)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'model', 'Model', 'An abstract, conceptual, graphical, mathematical or visualization model that represents empirical objects, phenomena, or physical processes. (e.g. different aspects of languages or a molecular biology reaction chain)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'other', 'Other', 'Use this type when your output type does not fall within one of the other categories.', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'physical-object', 'Physical object', 'A physical object or substance. (e.g. Artifacts, specimens, material samples, and features-of-interest of any size. Note that digital representations of physical objects should use one of the other resourceTypeGeneral values.)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'service', 'Service', 'An organized system of apparatus, appliances, staff, etc., for supplying some function(s) required by end users. (e.g. Data management service, or long-term preservation service)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'software', 'Software', 'A computer program other than a computational notebook, in either source code (text) or compiled form. Use this type for general software components supporting scholarly research. Use the “ComputationalNotebook” value for virtual notebooks.', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'sound', 'Sound', 'A resource primarily intended to be heard. (e.g. an audio recording)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'text', 'Text', 'A resource consisting primarily of words for reading that is not covered by any other textual resource type in this list.', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
INSERT INTO `researchOutputTypes` (`value`, `name`, `description`, `createdById`, `modifiedById`)
SELECT 'workflow', 'Workflow', 'A structured series of steps which can be executed to produce a final outcome, allowing users a means to specify and enact their work in a more reproducible manner. (e.g. Computational workflows involving sequential operations made on data by wrapped software and may be specified in a format belonging to a workflow management system, such as Taverna)', id, id FROM `users` WHERE `role` = 'SUPERADMIN' ORDER BY id DESC LIMIT 1;
