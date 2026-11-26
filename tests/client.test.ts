import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  test,
} from "bun:test";
import { createTranslator, type TranslatorOptions } from "../src/client.ts";
import { FatalError } from "../src/errors.ts";

type CapturedRequest = {
  readonly path: string;
  readonly authorization: string | null;
  readonly body: unknown;
};

const requests: CapturedRequest[] = [];
let reply: { status: number; body: unknown };
let server: ReturnType<typeof Bun.serve>;

function completion(content: string) {
  return {
    id: "chatcmpl-test",
    object: "chat.completion",
    created: 0,
    model: "test-model",
    choices: [
      {
        index: 0,
        finish_reason: "stop",
        message: { role: "assistant", content },
      },
    ],
    usage: { prompt_tokens: 12, completion_tokens: 7, total_tokens: 19 },
  };
}

function translatorFor(overrides: Partial<TranslatorOptions> = {}) {
  return createTranslator({
    baseURL: new URL("/v1", server.url).href,
    model: "test-model",
    noTimeout: false,
    ...overrides,
  });
}

beforeAll(() => {
  server = Bun.serve({
    port: 0,
    async fetch(request) {
      requests.push({
        path: new URL(request.url).pathname,
        authorization: request.headers.get("authorization"),
        body: await request.json(),
      });
      return Response.json(reply.body, { status: reply.status });
    },
  });
});

afterAll(async () => {
  await server.stop(true);
});

beforeEach(() => {
  requests.length = 0;
  reply = { status: 200, body: completion("Merhaba") };
});

describe("createTranslator", () => {
  test("sends a chat completion without auth or temperature by default", async () => {
    const result = await translatorFor().translate("Hello");
    expect(result).toEqual({
      text: "Merhaba",
      usage: { inputTokens: 12, outputTokens: 7 },
    });
    const [captured] = requests;
    expect(captured?.path).toBe("/v1/chat/completions");
    expect(captured?.authorization).toBeNull();
    expect(captured?.body).toMatchObject({
      model: "test-model",
      messages: [{ role: "user", content: "Hello" }],
    });
    expect(captured?.body).not.toHaveProperty("temperature");
  });

  test("sends the API key and temperature when provided", async () => {
    await translatorFor({ apiKey: "secret", temperature: 0.3 }).translate(
      "Hello",
    );
    expect(requests[0]?.authorization).toBe("Bearer secret");
    expect(requests[0]?.body).toMatchObject({ temperature: 0.3 });
  });

  test("strips a leading reasoning block from local reasoning models", async () => {
    reply = {
      status: 200,
      body: completion("<think>\nthinking...\n</think>\n\nMerhaba"),
    };
    const result = await translatorFor().translate("Hello");
    expect(result.text.trim()).toBe("Merhaba");
  });

  test("maps authentication errors to FatalError", async () => {
    reply = {
      status: 401,
      body: {
        error: { message: "Invalid API key", type: "invalid_request_error" },
      },
    };
    await expect(translatorFor().translate("Hello")).rejects.toBeInstanceOf(
      FatalError,
    );
    expect(requests).toHaveLength(1);
  });

  test("keeps server errors retryable", async () => {
    reply = { status: 500, body: { error: { message: "boom" } } };
    const error = await translatorFor()
      .translate("Hello")
      .then(
        () => undefined,
        (caught: unknown) => caught,
      );
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(FatalError);
    expect(requests).toHaveLength(1);
  });
});
