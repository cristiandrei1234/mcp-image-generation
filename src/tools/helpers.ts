import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { formatGeminiError, type GeminiError } from "../infra/errors.js";

export function errorResult(error: GeminiError): CallToolResult {
  return {
    isError: true,
    content: [{ type: "text", text: formatGeminiError(error) }],
  };
}

export function successResult(text: string): CallToolResult {
  return {
    content: [{ type: "text", text }],
  };
}

export function filesResult(files: string[], header: string): CallToolResult {
  const body = `${header}\n${files.map((f) => `  - ${f}`).join("\n")}`;
  return successResult(body);
}
