// The language layer's only outside dependency. Everything here is injectable so
// the extract/reply logic can be unit-tested offline with a fake client (no key,
// no network). A real run uses the official Anthropic SDK and needs ANTHROPIC_API_KEY.

export const MODEL = 'claude-opus-4-8';

/** The minimal surface extract/reply need from the Anthropic SDK. */
export interface LlmClient {
  messages: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    create(params: any): Promise<{ content: Array<{ type: string; text?: string }> }>;
  };
}

/**
 * Lazily construct the real Anthropic SDK client. Imported dynamically so that
 * offline tests (which inject a fake LlmClient) never require the SDK to be
 * installed or a key to be present.
 */
export async function defaultClient(): Promise<LlmClient> {
  // @ts-ignore - resolved at runtime once `npm install` has run in this package
  const mod = await import('@anthropic-ai/sdk');
  const Anthropic = mod.default;
  return new Anthropic() as unknown as LlmClient; // reads ANTHROPIC_API_KEY from env
}

/** Pull the first text block out of a Messages response. */
export function firstText(resp: { content: Array<{ type: string; text?: string }> }): string {
  const block = resp.content.find((b) => b.type === 'text' && typeof b.text === 'string');
  if (!block || block.text == null) {
    throw new Error('Model response contained no text block.');
  }
  return block.text;
}
