export const mockPlan = {
  id: 7,
  versionedTemplateId: 973,
};

export const mockUser = {
  id: 1,
  affiliationId: "https://ror.org/03yrm5c26",
};

export const mockVersionedTemplate = {
  id: 973,
  ownerId: "https://ror.org/021nxhr62",
};

export const mockUserSelections = [
  { affiliationId: "https://ror.org/01cwqze88", userId: 1 },
  { affiliationId: "https://ror.org/021nxhr62", userId: 1 },
  { affiliationId: "https://ror.org/03yrm5c26", userId: 1 },
];

export const mockTagsMap = { 1: "Data Sharing", 2: "Preservation" };

export const mockBestPracticeGuidance = [
  { tagId: 1, guidanceText: "Best practice 1" },
  { tagId: 2, guidanceText: "Best practice 2" },
];

export const mockAffiliationCDL = {
  displayName: "California Digital Library (cdlib.org)",
  name: "California Digital Library",
  acronyms: ["CDL"],
};

export const mockAffiliationNSF = {
  displayName: "National Science Foundation (nsf.gov)",
  name: "National Science Foundation",
  acronyms: ["NSF"],
};

export const mockAffiliationNIH = {
  displayName: "National Institutes of Health (nih.gov)",
  name: "National Institutes of Health",
  acronyms: ["NIH"],
};

export const mockTagBasedGuidanceCDL = [
  { tagId: 1, guidanceText: "CDL guidance 1" },
  { tagId: 2, guidanceText: "CDL guidance 2" },
];

export const mockTagBasedGuidanceNSF = [
  { tagId: 1, guidanceText: "NSF guidance 1" },
  { tagId: 2, guidanceText: "NSF guidance 2" },
  { tagId: 1, guidanceText: "NSF guidance 3" },
];

export const mockTagBasedGuidanceNIH = [
  { tagId: 1, guidanceText: "NIH guidance 1" },
  { tagId: 2, guidanceText: "NIH guidance 2" },
];
