import { Request, Response, NextFunction } from "express";
import { authenticateApiKey } from "../middleware/auth";

describe("Authentication Middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe("authenticateApiKey", () => {
    it("should call next() with valid API key in x-api-key header", () => {
      mockReq.headers = { "x-api-key": "test-api-key" };

      authenticateApiKey(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should call next() with valid API key in authorization header", () => {
      mockReq.headers = { authorization: "Bearer test-api-key" };

      authenticateApiKey(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should return 401 for missing API key", () => {
      mockReq.headers = {};

      authenticateApiKey(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid or missing API key",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 401 for invalid API key", () => {
      mockReq.headers = { "x-api-key": "invalid-key" };

      authenticateApiKey(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid or missing API key",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should return 401 for empty API key", () => {
      mockReq.headers = { "x-api-key": "" };

      authenticateApiKey(mockReq as Request, mockRes as Response, nextFunction);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Invalid or missing API key",
      });
      expect(nextFunction).not.toHaveBeenCalled();
    });

    it("should handle authorization header without Bearer prefix", () => {
      mockReq.headers = { authorization: "test-api-key" };

      authenticateApiKey(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });

    it("should prioritize x-api-key over authorization header", () => {
      mockReq.headers = {
        "x-api-key": "test-api-key",
        authorization: "Bearer wrong-key",
      };

      authenticateApiKey(mockReq as Request, mockRes as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalled();
      expect(mockRes.status).not.toHaveBeenCalled();
    });
  });

  describe("when API_KEY environment variable is not set", () => {
    const originalApiKey = process.env.API_KEY;

    beforeEach(() => {
      delete process.env.API_KEY;
    });

    afterEach(() => {
      process.env.API_KEY = originalApiKey;
    });

    it("should return 500 server configuration error", () => {
      mockReq.headers = { "x-api-key": "any-key" };

      // Spy on console.error to avoid test output pollution
      const consoleSpy = jest.spyOn(console, "error").mockImplementation();

      authenticateApiKey(mockReq as Request, mockRes as Response, nextFunction);

      expect(consoleSpy).toHaveBeenCalledWith(
        "API_KEY environment variable not set",
      );
      expect(mockRes.status).toHaveBeenCalledWith(500);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: "Server configuration error",
      });
      expect(nextFunction).not.toHaveBeenCalled();

      consoleSpy.mockRestore();
    });
  });
});
