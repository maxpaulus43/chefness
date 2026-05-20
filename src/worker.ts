const MAX_HTML_BYTES = 2_000_000;
const FETCH_TIMEOUT_MS = 8_000;
const MAX_REDIRECTS = 3;

interface Env {
    ASSETS?: { fetch: (request: Request) => Promise<Response> };
}

interface RecipePayload {
    title: string;
    description: string;
    ingredients: string[];
    steps: string[];
}

interface ErrorPayload {
    ok: false;
    code: string;
    message: string;
}

interface SuccessPayload {
    ok: true;
    recipe: RecipePayload;
    sourceUrl: string;
    sourceName: string;
}

type JsonLdValue =
    | string
    | number
    | boolean
    | null
    | JsonLdValue[]
    | { [key: string]: JsonLdValue };

export default {
    async fetch(request: Request, env: Env): Promise<Response> {
        const url = new URL(request.url);

        if (url.pathname === "/api/extract-recipe-url") {
            return handleExtractRecipeUrl(request);
        }

        if (env.ASSETS) {
            return env.ASSETS.fetch(request);
        }

        return new Response("Not found", { status: 404 });
    },
};

async function handleExtractRecipeUrl(request: Request): Promise<Response> {
    if (request.method !== "POST") {
        return errorJson(405, "METHOD_NOT_ALLOWED", "Method not allowed.");
    }

    let body: unknown;
    try {
        body = await request.json();
    } catch {
        return errorJson(400, "INVALID_JSON", "Request body must be JSON.");
    }

    const rawUrl =
        typeof body === "object" && body !== null && "url" in body
            ? (body as { url?: unknown }).url
            : undefined;

    if (typeof rawUrl !== "string") {
        return errorJson(400, "INVALID_URL", "Missing recipe URL.");
    }

    const targetUrl = parseAllowedUrl(rawUrl);
    if (!targetUrl) {
        return errorJson(400, "INVALID_URL", "Invalid recipe URL.");
    }

    let response: Response;
    let finalUrl: URL;
    try {
        const result = await fetchHtmlResponse(targetUrl);
        response = result.response;
        finalUrl = result.finalUrl;
    } catch (err) {
        if (err instanceof FetchError) {
            return errorJson(err.status, err.code, err.message);
        }

        return errorJson(502, "FETCH_FAILED", "Could not fetch recipe site.");
    }

    if (!response.ok) {
        return errorJson(502, "FETCH_FAILED", "Could not fetch recipe site.");
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (contentType && !contentType.toLowerCase().includes("html")) {
        return errorJson(
            415,
            "UNSUPPORTED_CONTENT_TYPE",
            "Recipe URL did not return an HTML page.",
        );
    }

    let html: string;
    try {
        html = await readTextWithLimit(response, MAX_HTML_BYTES);
    } catch {
        return errorJson(413, "RESPONSE_TOO_LARGE", "Recipe page is too large.");
    }

    const recipeJson = findRecipeJsonLd(html);
    if (!recipeJson) {
        return noJsonLdRecipe();
    }

    const recipe = normalizeRecipe(recipeJson, targetUrl);
    if (!recipe) {
        return noJsonLdRecipe();
    }

    const payload: SuccessPayload = {
        ok: true,
        recipe,
        sourceUrl: finalUrl.toString(),
        sourceName: finalUrl.hostname.replace(/^www\./, ""),
    };

    return json(payload, 200);
}

class FetchError extends Error {
    constructor(
        public readonly status: number,
        public readonly code: string,
        message: string,
    ) {
        super(message);
    }
}

async function fetchHtmlResponse(
    initialUrl: URL,
): Promise<{ response: Response; finalUrl: URL }> {
    let currentUrl = initialUrl;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    try {
        for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
            const response = await fetch(currentUrl.toString(), {
                headers: {
                    Accept: "text/html,application/xhtml+xml",
                    "User-Agent":
                        "ChefnessRecipeImporter/1.0 (+https://chefness.app)",
                },
                redirect: "manual",
                signal: controller.signal,
            });

            if (!isRedirect(response.status)) {
                return { response, finalUrl: currentUrl };
            }

            const location = response.headers.get("location");
            if (!location) {
                throw new FetchError(502, "FETCH_FAILED", "Could not fetch recipe site.");
            }

            if (redirectCount === MAX_REDIRECTS) {
                throw new FetchError(508, "TOO_MANY_REDIRECTS", "Recipe site redirected too many times.");
            }

            const nextUrl = parseAllowedUrl(new URL(location, currentUrl).toString());
            if (!nextUrl) {
                throw new FetchError(400, "INVALID_URL", "Invalid recipe URL.");
            }

            currentUrl = nextUrl;
        }
    } catch (err) {
        if (err instanceof FetchError) throw err;

        const aborted = err instanceof DOMException && err.name === "AbortError";
        throw new FetchError(
            aborted ? 504 : 502,
            aborted ? "FETCH_TIMEOUT" : "FETCH_FAILED",
            aborted ? "Recipe site took too long to respond." : "Could not fetch recipe site.",
        );
    } finally {
        clearTimeout(timeout);
    }

    throw new FetchError(508, "TOO_MANY_REDIRECTS", "Recipe site redirected too many times.");
}

function isRedirect(status: number): boolean {
    return status >= 300 && status < 400;
}

function parseAllowedUrl(rawUrl: string): URL | null {
    try {
        const url = new URL(rawUrl.trim());
        if (url.protocol !== "http:" && url.protocol !== "https:") return null;
        if (url.username || url.password) return null;
        if (url.port && url.port !== "80" && url.port !== "443") return null;
        if (isBlockedHost(url.hostname)) return null;
        return url;
    } catch {
        return null;
    }
}

function isBlockedHost(hostname: string): boolean {
    const host = hostname.toLowerCase().replace(/^\[|\]$/g, "");

    if (
        host === "localhost" ||
        host === "0.0.0.0" ||
        host === "::" ||
        host === "::1" ||
        host.startsWith("fc") ||
        host.startsWith("fd") ||
        host.startsWith("fe80:") ||
        host.endsWith(".localhost") ||
        host.endsWith(".local")
    ) {
        return true;
    }

    const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(host);
    if (!ipv4) return false;

    const octets = ipv4.slice(1).map(Number);
    if (octets.some((octet) => octet < 0 || octet > 255)) return true;

    const [a, b] = octets;
    return (
        a === 10 ||
        a === 127 ||
        (a === 172 && b >= 16 && b <= 31) ||
        (a === 192 && b === 168) ||
        (a === 169 && b === 254)
    );
}

async function readTextWithLimit(response: Response, maxBytes: number): Promise<string> {
    const reader = response.body.getReader();
    const chunks: Uint8Array[] = [];
    let total = 0;

    try {
        let isDone = false;
        while (!isDone) {
            const { done, value } = await reader.read();
            isDone = done;
            if (done) continue;
            total += value.byteLength;
            if (total > maxBytes) {
                throw new Error("Response too large");
            }
            chunks.push(value);
        }
    } finally {
        reader.releaseLock();
    }

    const bytes = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        bytes.set(chunk, offset);
        offset += chunk.byteLength;
    }

    return new TextDecoder().decode(bytes);
}

function findRecipeJsonLd(html: string): Record<string, JsonLdValue> | null {
    for (const block of extractJsonLdBlocks(html)) {
        const parsed = parseJsonLd(block);
        if (parsed === undefined) continue;

        const recipe = findRecipeObject(parsed);
        if (recipe) return recipe;
    }

    return null;
}

function extractJsonLdBlocks(html: string): string[] {
    const blocks: string[] = [];
    const scriptRegex = /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match: RegExpExecArray | null;

    while ((match = scriptRegex.exec(html)) !== null) {
        blocks.push(decodeHtmlEntities(match[1]?.trim() ?? ""));
    }

    return blocks;
}

function decodeHtmlEntities(value: string): string {
    return value
        .replace(/&quot;/g, '"')
        .replace(/&#34;/g, '"')
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">");
}

function parseJsonLd(value: string): JsonLdValue | undefined {
    try {
        return JSON.parse(value) as JsonLdValue;
    } catch {
        return undefined;
    }
}

function findRecipeObject(value: JsonLdValue): Record<string, JsonLdValue> | null {
    if (Array.isArray(value)) {
        for (const item of value) {
            const found = findRecipeObject(item);
            if (found) return found;
        }
        return null;
    }

    if (!isRecord(value)) return null;

    if (isRecipeType(value["@type"])) {
        return value;
    }

    const graph = value["@graph"];
    if (Array.isArray(graph)) {
        for (const item of graph) {
            const found = findRecipeObject(item);
            if (found) return found;
        }
    }

    return null;
}

function isRecipeType(type: unknown): boolean {
    if (typeof type === "string") return type.toLowerCase() === "recipe";
    if (Array.isArray(type)) {
        return type.some((item) => typeof item === "string" && item.toLowerCase() === "recipe");
    }
    return false;
}

function normalizeRecipe(value: JsonLdValue, sourceUrl: URL): RecipePayload | null {
    if (!isRecord(value)) return null;

    const title = stringValue(value.name).trim();
    const description =
        stringValue(value.description).trim() ||
        `Imported from ${sourceUrl.hostname.replace(/^www\./, "")}`;
    const ingredients = stringArray(value.recipeIngredient);
    const steps = instructionTexts(value.recipeInstructions);

    if (!title || ingredients.length === 0 || steps.length === 0) return null;

    return { title, description, ingredients, steps };
}

function instructionTexts(value: JsonLdValue | undefined): string[] {
    if (typeof value === "string") return [value.trim()].filter(Boolean);

    if (Array.isArray(value)) {
        return value.flatMap(instructionTexts).filter(Boolean);
    }

    if (!isRecord(value)) return [];

    const text = stringValue(value.text).trim();
    if (text) return [text];

    return instructionTexts(value.itemListElement);
}

function stringArray(value: JsonLdValue | undefined): string[] {
    if (!Array.isArray(value)) return [];
    return value
        .map((item) => stringValue(item).trim())
        .filter((item) => item.length > 0);
}

function stringValue(value: JsonLdValue | undefined): string {
    if (typeof value === "string") return value;
    if (typeof value === "number") return String(value);
    return "";
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}

function noJsonLdRecipe(): Response {
    return errorJson(422, "NO_JSON_LD_RECIPE", "Site doesn't support extraction.");
}

function errorJson(status: number, code: string, message: string): Response {
    const payload: ErrorPayload = { ok: false, code, message };
    return json(payload, status);
}

function json(payload: SuccessPayload | ErrorPayload, status: number): Response {
    return new Response(JSON.stringify(payload), {
        status,
        headers: { "Content-Type": "application/json; charset=utf-8" },
    });
}
