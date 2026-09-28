// OpenAI integration — uses the openai package directly.
import OpenAI from 'openai';
import { env } from './env';

const openai = new OpenAI({ apiKey: env.openaiApiKey });

// Every 1.0 model took plain text or an array of text blocks; only the image
// block was gated on vision support.
export type TextContent = string | Array<{ type: "text"; text: string }>;

export type MessageContent =
  | string
  | Array<{ type: "text"; text: string } | { type: "image_url"; image_url: { url: string } }>;

type ChatMessage = { role: "user" | "assistant" | "system"; content: MessageContent };

type TextParams = {
  model?: string;
  prompt?: string;
  systemPrompt?: string;
  messages?: ChatMessage[];
};

function buildMessages(params: TextParams): OpenAI.Chat.ChatCompletionMessageParam[] {
  const messages: ChatMessage[] = [];
  if (params.systemPrompt) messages.push({ role: "system", content: params.systemPrompt });
  // messages OR prompt, as 1.0 did — appending the prompt to a conversation
  // would add a turn the app never asked for.
  if (params.messages) messages.push(...params.messages);
  else if (params.prompt) messages.push({ role: "user", content: params.prompt });
  // openai's param type is a discriminated union per role; ours is one shape
  // across all three, which is a superset only TS can't see through.
  return messages as OpenAI.Chat.ChatCompletionMessageParam[];
}

// Returns an AsyncIterable<string>, as the 1.0 SDK did — iterate it with
// `for await (const chunk of textStream)` and `stream?.write(chunk)` each chunk.
export async function streamText(params: TextParams): Promise<AsyncIterable<string>> {
  const completion = await openai.chat.completions.create({
    model: params.model ?? "gpt-4o",
    messages: buildMessages(params),
    stream: true,
    // Required for the fetch interceptor to see token usage on the final SSE chunk.
    stream_options: { include_usage: true },
  });
  return (async function* () {
    for await (const chunk of completion) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) yield content;
    }
  })();
}

export async function generateText(params: TextParams) {
  const response = await openai.chat.completions.create({
    model: params.model ?? "gpt-4o",
    messages: buildMessages(params),
  });
  return { text: response.choices[0]?.message?.content ?? "" };
}

export async function generateObject(params: TextParams & {
  // Stringified JSON Schema describing the object to return.
  responseFormat: string;
}) {
  const response = await openai.chat.completions.create({
    model: params.model ?? "gpt-4o",
    messages: buildMessages(params),
    response_format: {
      type: "json_schema",
      json_schema: { name: "response", schema: JSON.parse(params.responseFormat) },
    },
  });
  const choice = response.choices[0];
  if (choice?.message?.refusal) {
    throw new Error("OpenAI refused to generate an object: " + choice.message.refusal);
  }
  // Empty content would JSON.parse to {} and silently violate the caller's schema.
  if (!choice?.message?.content) {
    throw new Error("OpenAI returned no object content (finish_reason: " + (choice?.finish_reason ?? "unknown") + ")");
  }
  return JSON.parse(choice.message.content);
}

export async function generateImage(params: {
  prompt: string;
  model?: string;
}) {
  const model = params.model ?? "dall-e-3";
  // gpt-image-* return base64 natively and reject `response_format`;
  // dall-e needs it set explicitly to get base64 instead of a temp URL.
  const isGptImage = model.startsWith("gpt-image");
  const response = await openai.images.generate({
    model,
    prompt: params.prompt,
    n: 1,
    ...(isGptImage ? {} : { response_format: "b64_json" as const }),
  });
  // dall-e can still answer with a URL, which 1.0 passed through — building a
  // data: URL around an empty string would hand the app a broken image instead.
  const image = response.data?.[0];
  return {
    imageUrl: image?.b64_json
      ? `data:image/png;base64,${image.b64_json}`
      : image?.url ?? "",
  };
}

// Per-model wrappers for backwards compatibility with old SDK imports.

export const OpenAIGpt54 = {
  streamText: (params: { prompt?: string; systemPrompt?: string; messages?: Array<{ role: "user" | "assistant" | "system"; content: MessageContent }> }) =>
    streamText({ ...params, model: 'gpt-5.4' }),
  generateText: (params: { prompt?: string; systemPrompt?: string; messages?: Array<{ role: "user" | "assistant" | "system"; content: MessageContent }> }) =>
    generateText({ ...params, model: 'gpt-5.4' }),
  generateObject: (params: { prompt?: string; systemPrompt?: string; responseFormat: string; messages?: Array<{ role: "user" | "assistant" | "system"; content: MessageContent }> }) =>
    generateObject({ ...params, model: 'gpt-5.4' }),
};

export const OpenAIGptimage1Mini = {
  generateImage: (params: { prompt: string }) =>
    generateImage({ ...params, model: 'gpt-image-1-mini' }),
};
