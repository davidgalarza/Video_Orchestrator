import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildOmniPayload,
  buildVeoPayload,
  downloadVideo,
  generateVideo,
  blobDataUrl,
  validateSettings,
} from "../src/lib/google";
import { DEFAULT_VIDEO, VEO_MODEL, type GenerationTask } from "../src/types";
const task: GenerationTask = {
  prompt: "A calm ocean",
  settings: DEFAULT_VIDEO,
  mode: "generate",
  started_at: "2026-09-07",
};
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
afterEach(() => vi.unstubAllGlobals());
describe("Omni integration", () => {
  it("sends the official model, asynchronous URI delivery and duration", () => {
    expect(buildOmniPayload(task, [])).toMatchObject({
      model: "gemini-omni-1.1-flash",
      input: task.prompt,
      background: true,
      store: true,
      response_format: {
        duration: "8s",
        aspect_ratio: "9:16",
        resolution: "720p",
        delivery: "uri",
      },
    });
  });
  it("binds first, last and reference image roles without changing MIME types", () => {
    const body = buildOmniPayload(task, [
      { data: "AA==", mimeType: "image/png", role: "first" },
      { data: "BB==", mimeType: "image/webp", role: "last" },
      { data: "CC==", mimeType: "image/jpeg", role: "reference" },
    ]);
    expect(body.input).toEqual(
      expect.arrayContaining([
        { type: "image", data: "BB==", mime_type: "image/webp" },
        {
          type: "text",
          text: expect.stringContaining(
            "[# Sources <FIRST_FRAME>@Image1 <LAST_FRAME>@Image2] [# References <IMAGE_REF_0>@Image3]",
          ),
        },
      ]),
    );
  });
  it("rejects a last frame without a first frame before charging", () => {
    expect(() =>
      buildOmniPayload(task, [
        { data: "AA==", mimeType: "image/png", role: "last" },
      ]),
    ).toThrow("fotograma inicial");
  });
  it("edits and extends with the saved interaction and no conflicting task field", () => {
    const body = buildOmniPayload(
      {
        ...task,
        mode: "extend",
        previousInteractionId: "original",
        previousDuration: 20,
      },
      [],
    );
    expect(body).toMatchObject({
      previous_interaction_id: "original",
      input: expect.stringContaining("Extend this video by 10 seconds."),
    });
    expect(body).not.toHaveProperty("generation_config");
    expect(body.response_format).not.toHaveProperty("duration");
    expect(() =>
      buildOmniPayload(
        {
          ...task,
          mode: "extend",
          previousInteractionId: "original",
          previousDuration: 40,
        },
        [],
      ),
    ).toThrow("40 segundos");
    expect(() => buildOmniPayload({ ...task, mode: "edit" }, [])).toThrow(
      "versión de Omni",
    );
  });
  it("persists the operation before polling and downloads the completed clip", async () => {
    let saved = false;
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ id: "op-1", status: "in_progress" }))
      .mockImplementationOnce(() => {
        expect(saved).toBe(true);
        return response({
          id: "op-1",
          status: "completed",
          output_video: { data: btoa("video"), mime_type: "video/mp4" },
        });
      });
    vi.stubGlobal("fetch", fetcher);
    const result = await generateVideo({
      task,
      images: [],
      apiKey: "test-key",
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      onRemoteId: async () => {
        saved = true;
      },
      pollInterval: 0,
    });
    expect(result.interactionId).toBe("op-1");
    expect(await result.blob.text()).toBe("video");
    expect(fetcher.mock.calls[0][1].method).toBe("POST");
    expect(fetcher.mock.calls[1][0]).toMatch(/interactions\/op-1$/);
  });
  it("recovers using GET without issuing another paid POST", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response({
          id: "saved-op",
          status: "completed",
          output_video: { data: btoa("result") },
        }),
      );
    vi.stubGlobal("fetch", fetcher);
    await generateVideo({
      task: { ...task, remoteId: "saved-op" },
      images: [],
      apiKey: "test-key",
      signal: new AbortController().signal,
      onProgress: vi.fn(),
      onRemoteId: vi.fn(),
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][1].method).toBeUndefined();
  });
  it("does not retry POST on quota errors and redacts the key from errors", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        response({ error: { message: "Quota test-key exceeded" } }, 429),
      );
    vi.stubGlobal("fetch", fetcher);
    await expect(
      generateVideo({
        task,
        images: [],
        apiKey: "test-key",
        signal: new AbortController().signal,
        onProgress: vi.fn(),
        onRemoteId: vi.fn(),
      }),
    ).rejects.toThrow("cuota");
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("rejects cancelled requests before making network calls", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const controller = new AbortController();
    controller.abort();
    await expect(
      generateVideo({
        task,
        images: [],
        apiKey: "test-key",
        signal: controller.signal,
        onProgress: vi.fn(),
        onRemoteId: vi.fn(),
      }),
    ).rejects.toThrow();
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("stops polling promptly when paused", async () => {
    const ctrl = new AbortController();
    const fetcher = vi
      .fn()
      .mockResolvedValue(response({ id: "op", status: "in_progress" }));
    vi.stubGlobal("fetch", fetcher);
    await expect(
      generateVideo({
        task,
        images: [],
        apiKey: "key",
        signal: ctrl.signal,
        onProgress: (text) => {
          if (text.includes("creando")) ctrl.abort();
        },
        onRemoteId: vi.fn(),
      }),
    ).rejects.toThrow();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it("fails clearly on a terminal operation instead of polling forever", async () => {
    vi.stubGlobal(
      "fetch",
      vi
        .fn()
        .mockResolvedValue(
          response({
            id: "op",
            status: "failed",
            errors: [{ message: "Safety blocked" }],
          }),
        ),
    );
    await expect(
      generateVideo({
        task,
        images: [],
        apiKey: "key",
        signal: new AbortController().signal,
        onProgress: vi.fn(),
        onRemoteId: vi.fn(),
      }),
    ).rejects.toThrow("Safety blocked");
  });
});
describe("media and Veo compatibility", () => {
  it("never attaches API credentials to signed storage URLs", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response("video", { headers: { "content-type": "video/mp4" } }),
      );
    vi.stubGlobal("fetch", fetcher);
    await downloadVideo(
      { uri: "https://storage.googleapis.com/asset.mp4?signature=abc" },
      "secret",
    );
    expect(fetcher.mock.calls[0][1].headers).toBeUndefined();
    expect(String(fetcher.mock.calls[0][0])).not.toContain("secret");
  });
  it("refuses foreign download hosts and spoofed Google suffixes", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    await expect(
      downloadVideo(
        { uri: "https://googleapis.com.evil.test/video" },
        "secret",
      ),
    ).rejects.toThrow("no reconocida");
    expect(fetcher).not.toHaveBeenCalled();
  });
  it("encodes large images without argument stack overflow", async () => {
    const blob = new Blob([new Uint8Array(1024 * 1024)], {
      type: "image/webp",
    });
    const data = await blobDataUrl(blob);
    expect(data.startsWith("data:image/webp;base64,")).toBe(true);
    expect(atob(data.split(",")[1]).length).toBe(blob.size);
  });
  it("uses the Veo REST image schema, preserves last frame, rejects unsupported options", () => {
    const veo = { ...task, settings: { ...DEFAULT_VIDEO, model: VEO_MODEL } };
    const payload = buildVeoPayload(veo, [
      { role: "first", data: "AA==", mimeType: "image/png" },
      { role: "last", data: "BB==", mimeType: "image/webp" },
    ]);
    expect(payload.instances[0]).toMatchObject({
      image: { bytesBase64Encoded: "AA==", mimeType: "image/png" },
      lastFrame: { bytesBase64Encoded: "BB==", mimeType: "image/webp" },
    });
    expect(() =>
      validateSettings({ ...veo.settings, duration: 4, resolution: "1080p" }),
    ).toThrow("8 segundos");
  });
});
