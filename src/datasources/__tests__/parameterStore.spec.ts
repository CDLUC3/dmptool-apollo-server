import { SSMClient, GetParameterCommand, GetParameterCommandOutput } from "@aws-sdk/client-ssm";
import { getParameter } from "../parameterStore";
import { MyContext } from "../../context.js";
import { logger } from "../../logger.js";
import { buildContext } from "../../__mocks__/context.js";


// 🟢 Mock the entire AWS SDK client
jest.mock("@aws-sdk/client-ssm", () => {
  return {
    SSMClient: jest.fn(),
    GetParameterCommand: jest.fn()
  };
});

describe("ParameterStore.getParameter", () => {
  let mockSend: jest.Mock;
  let context: MyContext;

  beforeEach(() => {
    mockSend = jest.fn();
    (SSMClient as jest.Mock).mockImplementation(() => ({
      send: mockSend
    }));

    context = buildContext(logger);

    jest.clearAllMocks();
  });

  it("returns parameter value when SSM returns successfully", async () => {
    const mockOutput: GetParameterCommandOutput = {
      Parameter: { Value: "my-secret-value" },
      "$metadata": { httpStatusCode: 200, requestId: "123", attempts: 1, totalRetryDelay: 0 }
    };
    mockSend.mockResolvedValueOnce(mockOutput);

    const result = await getParameter(context, "my-key");

    expect(GetParameterCommand).toHaveBeenCalledWith({
      Name: "my-key",
      WithDecryption: true
    });

    expect(mockSend).toHaveBeenCalledTimes(1);
    expect(result).toBe("my-secret-value");
  });

  it("returns empty string if Parameter.Value is missing", async () => {
    const mockOutput: GetParameterCommandOutput = {
      Parameter: {},
      "$metadata": { httpStatusCode: 404, requestId: "123", attempts: 1, totalRetryDelay: 0 }
    };
    mockSend.mockResolvedValueOnce(mockOutput);

    const result = await getParameter(context, "missing-value");

    expect(result).toBe("");
  });

  it("logs error and returns empty string when SSM throws", async () => {
    const error = new Error("SSM failure");
    mockSend.mockRejectedValueOnce(error);

    const result = await getParameter(context, "bad-key");

    expect(result).toBe("");
    expect(context.logger?.error).toHaveBeenCalledWith(
      { err: {}, key: "bad-key" },
      "Error fetching parameter from SSM"
    );
  });
});
