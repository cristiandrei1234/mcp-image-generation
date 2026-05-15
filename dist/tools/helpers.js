import { formatGeminiError } from "../infra/errors.js";
export function errorResult(error) {
    return {
        isError: true,
        content: [{ type: "text", text: formatGeminiError(error) }],
    };
}
export function successResult(text) {
    return {
        content: [{ type: "text", text }],
    };
}
export function filesResult(files, header) {
    const body = `${header}\n${files.map((f) => `  - ${f}`).join("\n")}`;
    return successResult(body);
}
