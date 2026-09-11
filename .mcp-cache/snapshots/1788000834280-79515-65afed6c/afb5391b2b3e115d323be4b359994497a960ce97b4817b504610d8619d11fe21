import type { z } from "zod";

import { demoEnabled } from "#/domains/demo/config";
import { demoRoute } from "#/domains/demo/router";
import { ApiError } from "./api-error";

type RequestInfo = { method: string; path: string; body: unknown };

export interface RestResponse {
	readonly status: number;
	readonly body: unknown;
	text(): string;
	json(): unknown;
	assertOk(): void;
	jsonParsed<TSchema extends z.ZodType>(schema: TSchema): z.infer<TSchema>;
}

function buildRestResponse({
	status,
	responseBody,
	requestInfo,
}: {
	status: number;
	responseBody: string;
	requestInfo: RequestInfo;
}): RestResponse {
	return {
		status,
		body: responseBody,
		text() {
			return responseBody;
		},
		assertOk() {
			if (status >= 200 && status < 300) {
				return;
			}
			throw new ApiError({
				message: `API request failed with status ${status}`,
				request: requestInfo,
				response: { status, body: responseBody },
			});
		},
		json(): unknown {
			try {
				return JSON.parse(responseBody);
			} catch (error) {
				console.error("Failed to parse JSON response", {
					path: requestInfo.path,
					text: responseBody,
				});
				throw new ApiError({
					message: "Failed to parse API response",
					request: requestInfo,
					response: { status, body: responseBody },
					cause: error,
				});
			}
		},
		jsonParsed<TSchema extends z.ZodType>(schema: TSchema): z.infer<TSchema> {
			const data = this.json();
			try {
				const parsed = schema.safeParse(data);
				if (parsed.success) {
					return parsed.data;
				}
				console.error("API response schema validation failed", {
					path: requestInfo.path,
					method: requestInfo.method,
					issues: parsed.error.issues,
					response: data,
				});
				throw new ApiError({
					message: `API response did not match expected schema`,
					request: requestInfo,
					response: { status, body: responseBody },
					cause: parsed.error,
				});
			} catch (error) {
				if (error instanceof ApiError) throw error;
				throw new ApiError({
					message:
						error instanceof Error
							? error.message
							: "API response validation failed",
					request: requestInfo,
					response: { status, body: responseBody },
					cause: error,
				});
			}
		},
	};
}

/**
 * Browser-compatible REST fetch client.
 * Replaces the Tauri-based transport from open-grind.
 */
export async function fetchRest(
	path: string,
	options: {
		method?: string;
		body?: unknown;
		signal?: AbortSignal;
	} = { method: "GET" },
): Promise<RestResponse> {
	const method = options.method ?? "GET";
	const requestInfo = { method, path, body: options.body };

	const headers: Record<string, string> = {};
	if (options.body !== undefined) {
		headers["Content-Type"] = "application/json";
	}

	if (
		demoEnabled &&
		(path.startsWith("/v") ||
			path.startsWith("/public/") ||
			path.startsWith("/api/auth/"))
	) {
		const response = demoRoute({ path, method, body: options.body });
		return buildRestResponse({
			status: response.status,
			responseBody: JSON.stringify(response.body),
			requestInfo,
		});
	}

	try {
		const res = await globalThis.fetch(path, {
			method,
			headers,
			body:
				options.body !== undefined ? JSON.stringify(options.body) : undefined,
			signal: options.signal,
		});

		const textBody = await res.text();

		return buildRestResponse({
			status: res.status,
			responseBody: textBody,
			requestInfo,
		});
	} catch (error) {
		if (error instanceof ApiError) throw error;

		const message = error instanceof Error ? error.message : String(error);

		// Detect network-level blocks
		if (
			message.includes("Failed to fetch") ||
			message.includes("NetworkError") ||
			message.includes("ERR_BLOCKED")
		) {
			throw new ApiError({
				message: "Network request blocked",
				request: requestInfo,
				response: null,
				kind: "NetworkBlocked",
				cause: error,
			});
		}

		throw new ApiError({
			message,
			request: requestInfo,
			response: null,
			cause: error,
		});
	}
}
