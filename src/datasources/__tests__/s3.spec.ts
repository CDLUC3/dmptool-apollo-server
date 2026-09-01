/* eslint-disable @typescript-eslint/no-explicit-any */

import { jest } from '@jest/globals';
import type { Logger } from "pino";

import { mockAppConfigs, mockAppLogger } from '../../__tests__/mockConfigs.js';

mockAppConfigs();
mockAppLogger();


const mockGetPresignedURLForImageUpload = jest.fn<(...args: any[]) => Promise<any>>();
const mockRemoveObject = jest.fn<(...args: any[]) => Promise<any>>();
const mockToErrorMessage = jest.fn<(...args: any[]) => string>();

const actualDmpToolUtils = await import('@dmptool/utils');
jest.unstable_mockModule('@dmptool/utils', () => ({
  ...actualDmpToolUtils,
  getPresignedURLForImageUpload: mockGetPresignedURLForImageUpload,
  removeObject: mockRemoveObject,
  toErrorMessage: mockToErrorMessage,
}));

// --- uuid ---
const mockUuidV4 = jest.fn<(...args: any[]) => string>();
jest.unstable_mockModule('uuid', () => ({
  v4: mockUuidV4,
}));

const originalNodeEnv = process.env.NODE_ENV;

const buildLogger = (): Logger => {
  return {
    debug: jest.fn(),
    error: jest.fn(),
  } as unknown as Logger;
};

const loadS3Module = async (): Promise<typeof import("../s3.js")> => {
  return await import("../s3.js");
};

describe("src/datasources/s3", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.NODE_ENV = "test";
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe("CDN_BASE_URL", () => {
    it("uses the S3 bucket URL in development", async () => {
      process.env.NODE_ENV = "development";
      jest.resetModules();

      const { CDN_BASE_URL } = await loadS3Module();

      expect(CDN_BASE_URL).toBe(
        "http://localhost:4566/test-bucket/"
      );
    });

    it("uses the CDN domain in non-development environments", async () => {
      process.env.NODE_ENV = "production";
      jest.resetModules();

      const { CDN_BASE_URL } = await loadS3Module();

      expect(CDN_BASE_URL).toBe("https://cdn.localhost:3000/");
    });
  });

  describe("getPresignedURLForAffiliationLogo", () => {
    it("returns a presigned URL and sanitizes the uploaded file name", async () => {
      const logger = buildLogger();
      const { getPresignedURLForAffiliationLogo } = await loadS3Module();

      mockGetPresignedURLForImageUpload.mockResolvedValue({
        url: "https://s3.example.com/upload",
        fields: "{\"key\":\"value\"}",
      });

      const result = await getPresignedURLForAffiliationLogo(
        logger,
        "https://ror.org/12345",
        "café 2026!!.png",
        "image/jpeg"
      );

      expect(mockGetPresignedURLForImageUpload).toHaveBeenCalledWith(
        logger,
        "test-bucket",
        "logos/ror.org/12345/cafe_2026_.png",
        "image/jpeg",
        "us-west-2"
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          affiliationURI: "https://ror.org/12345",
          fileName: "café 2026!!.png",
          bucket: "test-bucket",
          url: "https://s3.example.com/upload",
          fields: "{\"key\":\"value\"}",
        }),
        "Generated presigned URL"
      );
      expect(result).toEqual({
        url: "https://s3.example.com/upload",
        fields: "{\"key\":\"value\"}",
      });
    });

    it("defaults the content type to image/png when one is not provided", async () => {
      const logger = buildLogger();
      const { getPresignedURLForAffiliationLogo } = await loadS3Module();

      mockGetPresignedURLForImageUpload.mockResolvedValue({
        url: "https://s3.example.com/upload",
        fields: "fields",
      });

      await getPresignedURLForAffiliationLogo(
        logger,
        "https://ror.org/12345",
        "logo.png"
      );

      expect(mockGetPresignedURLForImageUpload).toHaveBeenCalledWith(
        logger,
        "test-bucket",
        "logos/ror.org/12345/logo.png",
        "image/png",
        "us-west-2"
      );
    });

    it("generates a fallback logo name when the file name sanitizes to an empty value", async () => {
      const logger = buildLogger();
      const { getPresignedURLForAffiliationLogo } = await loadS3Module();

      mockUuidV4.mockReturnValue("generated-uuid");
      mockGetPresignedURLForImageUpload.mockResolvedValue({
        url: "https://s3.example.com/upload",
        fields: "fields",
      });

      await getPresignedURLForAffiliationLogo(
        logger,
        "https://ror.org/12345",
        "!!!"
      );

      expect(mockUuidV4).toHaveBeenCalledTimes(1);
      expect(mockGetPresignedURLForImageUpload).toHaveBeenCalledWith(
        logger,
        "test-bucket",
        "logos/ror.org/12345/logo-generated-uuid",
        "image/png",
        "us-west-2"
      );
    });

    it("truncates long file names while preserving the extension", async () => {
      const logger = buildLogger();
      const { getPresignedURLForAffiliationLogo } = await loadS3Module();

      mockGetPresignedURLForImageUpload.mockResolvedValue({
        url: "https://s3.example.com/upload",
        fields: "fields",
      });

      const longFileName = `${"a".repeat(60)}.png`;
      const expectedFileName = `${"a".repeat(46)}.png`;

      await getPresignedURLForAffiliationLogo(
        logger,
        "https://ror.org/12345",
        longFileName
      );

      expect(mockGetPresignedURLForImageUpload).toHaveBeenCalledWith(
        logger,
        "test-bucket",
        `logos/ror.org/12345/${expectedFileName}`,
        "image/png",
        "us-west-2"
      );
    });

    it("truncates long file names without an extension", async () => {
      const logger = buildLogger();
      const { getPresignedURLForAffiliationLogo } = await loadS3Module();

      mockGetPresignedURLForImageUpload.mockResolvedValue({
        url: "https://s3.example.com/upload",
        fields: "fields",
      });

      const longFileName = "b".repeat(60);
      const expectedFileName = "b".repeat(50);

      await getPresignedURLForAffiliationLogo(
        logger,
        "https://ror.org/12345",
        longFileName
      );

      expect(mockGetPresignedURLForImageUpload).toHaveBeenCalledWith(
        logger,
        "test-bucket",
        `logos/ror.org/12345/${expectedFileName}`,
        "image/png",
        "us-west-2"
      );
    });

    it("logs and returns undefined when presigned URL generation fails", async () => {
      const logger = buildLogger();
      const { getPresignedURLForAffiliationLogo } = await loadS3Module();
      const err = new Error("Unable to create upload URL");

      mockGetPresignedURLForImageUpload.mockRejectedValue(err);

      const result = await getPresignedURLForAffiliationLogo(
        logger,
        "https://ror.org/12345",
        "logo.png"
      );

      expect(result).toBeUndefined();
      expect(logger.error).toHaveBeenCalledWith(
        expect.objectContaining({
          affiliationURI: "https://ror.org/12345",
          fileName: "logo.png",
          bucket: "test-bucket",
          err,
        }),
        "Unable to generate presigned URL for S3."
      );
    });

    it("returns undefined when the affiliation URI cannot be parsed", async () => {
      const logger = buildLogger();
      const { getPresignedURLForAffiliationLogo } = await loadS3Module();

      const result = await getPresignedURLForAffiliationLogo(
        logger,
        "not a url",
        "logo.png"
      );

      expect(result).toBeUndefined();
      expect(mockGetPresignedURLForImageUpload).not.toHaveBeenCalled();
      expect(logger.error).not.toHaveBeenCalled();
    });
  });

  describe("deleteAffiliationLogoFile", () => {
    it("returns true when S3 responds with DeleteMarker: true", async () => {
      const logger = buildLogger();
      const { deleteAffiliationLogoFile } = await loadS3Module();

      mockRemoveObject.mockResolvedValue({ DeleteMarker: true });

      const result = await deleteAffiliationLogoFile(logger, "logos/ror.org/12345/logo.png");

      expect(result).toBe(true);
      expect(mockRemoveObject).toHaveBeenCalledWith(
        logger,
        "test-bucket",
        "logos/ror.org/12345/logo.png",
        "http://localstack:4566",
        "us-west-2"
      );
      expect(logger.debug).toHaveBeenCalledWith(
        expect.objectContaining({ logoName: "logos/ror.org/12345/logo.png", bucket: "test-bucket" }),
        "Removing Affiliation logo from S3"
      );
    });

    it("returns false when S3 responds with DeleteMarker: false", async () => {
      const logger = buildLogger();
      const { deleteAffiliationLogoFile } = await loadS3Module();

      mockRemoveObject.mockResolvedValue({ DeleteMarker: false });

      const result = await deleteAffiliationLogoFile(logger, "logos/ror.org/12345/logo.png");

      expect(result).toBe(false);
      expect(mockRemoveObject).toHaveBeenCalledTimes(1);
    });

    it("returns false when removeObject returns a falsy response", async () => {
      const logger = buildLogger();
      const { deleteAffiliationLogoFile } = await loadS3Module();

      mockRemoveObject.mockResolvedValue(null);

      const result = await deleteAffiliationLogoFile(logger, "logos/ror.org/12345/logo.png");

      expect(result).toBe(false);
    });

    it("returns false and logs fatal when removeObject throws", async () => {
      const logger = buildLogger() as Logger & { fatal: jest.Mock };
      (logger as unknown as Record<string, unknown>).fatal = jest.fn();
      const { deleteAffiliationLogoFile } = await loadS3Module();

      const error = new Error("S3 connection refused");
      mockRemoveObject.mockRejectedValue(error);
      mockToErrorMessage.mockReturnValue("S3 connection refused");

      const result = await deleteAffiliationLogoFile(logger, "logos/ror.org/12345/logo.png");

      expect(result).toBe(false);
      expect((logger as unknown as { fatal: jest.Mock }).fatal).toHaveBeenCalledWith(
        expect.objectContaining({
          logoName: "logos/ror.org/12345/logo.png",
          bucket: "test-bucket",
          error: "S3 connection refused",
        }),
        "Unable to remove object from S3"
      );
    });
  });
});