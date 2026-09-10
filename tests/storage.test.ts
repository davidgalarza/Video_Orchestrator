import { describe, expect, it } from "vitest";
import * as db from "../src/lib/storage";
import {
  activeVersion,
  DEFAULT_VIDEO,
  sceneBlob,
  sequenceScenes,
  type ClipVersion,
} from "../src/types";
describe("local projects and non-destructive iterations", () => {
  it("creates, edits and reorders scenes, and duplicates only the draft", async () => {
    const p = await db.createProject(
      "Test project",
      [
        { title: "Hook", prompt: "one" },
        { title: "Close", prompt: "two" },
      ],
      DEFAULT_VIDEO,
    );
    let scenes = (await db.readWorkspace()).scenes.filter(
      (s) => s.project_id === p.id,
    );
    await db.reorderScenes(p.id, scenes.map((s) => s.id).reverse());
    scenes = (await db.readWorkspace()).scenes.filter(
      (s) => s.project_id === p.id,
    );
    expect(scenes[0].title).toBe("Close");
    const copy = await db.duplicateScene(scenes[0].id);
    expect(copy.prompt).toBe("two");
    expect(copy.versions).toBeUndefined();
    await db.deleteProject(p.id);
    expect(
      (await db.readWorkspace()).scenes.some((s) => s.project_id === p.id),
    ).toBe(false);
  });
  it("retains previous clips when generation fails and restores a selected version", async () => {
    const p = await db.createProject(
      "Versions",
      [{ title: "Scene", prompt: "first" }],
      DEFAULT_VIDEO,
    );
    const scene = (await db.readWorkspace()).scenes.find(
      (s) => s.project_id === p.id,
    )!;
    const version: ClipVersion = {
      id: "v1",
      blob: new Blob(["video"]),
      prompt: "first",
      settings: DEFAULT_VIDEO,
      mode: "generate",
      duration: 8,
      interactionId: "interaction1",
      created_at: new Date().toISOString(),
    };
    await db.saveVersion(scene.id, version);
    await db.patchScene(scene.id, {
      status: "failed",
      error: "Quota exceeded",
    });
    expect(await sceneBlob((await db.getScene(scene.id))!)?.text()).toBe(
      "video",
    );
    await db.saveVersion(scene.id, {
      ...version,
      id: "v2",
      blob: new Blob(["edited"]),
      mode: "edit",
    });
    await db.patchScene(scene.id, { active_version_id: "v1" });
    const restored = (await db.getScene(scene.id))!;
    expect(activeVersion(restored)?.interactionId).toBe("interaction1");
    expect(restored.versions).toHaveLength(2);
  });
  it("keeps blobs and operation IDs across subsequent database reads", async () => {
    const p = await db.createProject(
      "Recovery",
      [{ title: "S", prompt: "draft" }],
      DEFAULT_VIDEO,
    );
    const scene = (await db.readWorkspace()).scenes.find(
      (s) => s.project_id === p.id,
    )!;
    await db.patchScene(scene.id, {
      video_blob: new Blob(["legacy"]),
      task: {
        remoteId: "saved-op",
        prompt: "draft",
        mode: "generate",
        settings: DEFAULT_VIDEO,
        started_at: "today",
      },
    });
    const saved = (await db.readWorkspace()).scenes.find(
      (s) => s.id === scene.id,
    )!;
    expect(await sceneBlob(saved)?.text()).toBe("legacy");
    expect(saved.task?.remoteId).toBe("saved-op");
  });
  it("cleans references when an asset is deleted", async () => {
    const p = await db.createProject(
      "References",
      [{ title: "S", prompt: "draft" }],
      DEFAULT_VIDEO,
    );
    const scene = (await db.readWorkspace()).scenes.find(
      (s) => s.project_id === p.id,
    )!;
    await db.putAsset({
      id: "ref",
      file_name: "image.png",
      data_url: "data:image/png;base64,AA==",
      type: "STYLE",
      is_global: true,
      project_ids: [],
      created_at: "today",
    });
    await db.patchScene(scene.id, {
      first_frame_asset_id: "ref",
      reference_asset_ids: ["ref"],
    });
    await db.deleteAsset("ref");
    const clean = (await db.getScene(scene.id))!;
    expect(clean.first_frame_asset_id).toBeUndefined();
    expect(clean.reference_asset_ids).toEqual([]);
  });
});

describe("optional sequences", () => {
  it("retains the montage order of legacy projects and ignores stale IDs", async () => {
    const p = await db.createProject(
      "Legacy",
      [
        { title: "One", prompt: "" },
        { title: "Two", prompt: "" },
      ],
      DEFAULT_VIDEO,
    );
    const clips = (await db.readWorkspace()).scenes.filter(
      (s) => s.project_id === p.id,
    );
    expect(
      sequenceScenes({ ...p, sequence_ids: undefined }, clips).map((s) => s.id),
    ).toEqual(clips.map((s) => s.id));
    expect(
      sequenceScenes(
        { ...p, sequence_ids: ["deleted", clips[1].id] },
        clips,
      ).map((s) => s.id),
    ).toEqual([clips[1].id]);
  });
  it("persists subset order independently from the clip library and removes deleted references", async () => {
    const p = await db.createProject(
      "Clips",
      [1, 2, 3].map((n) => ({ title: `Clip ${n}`, prompt: "" })),
      DEFAULT_VIDEO,
    );
    const clips = (await db.readWorkspace()).scenes.filter(
      (s) => s.project_id === p.id,
    );
    expect(p.sequence_ids).toEqual([]);
    await db.saveSequence(p.id, [clips[2].id, clips[0].id]);
    let saved = (await db.readWorkspace()).projects.find(
      (item) => item.id === p.id,
    )!;
    expect(saved.sequence_ids).toEqual([clips[2].id, clips[0].id]);
    expect(
      (await db.readWorkspace()).scenes
        .filter((s) => s.project_id === p.id)
        .map((s) => s.id),
    ).toEqual(clips.map((s) => s.id));
    await expect(db.saveSequence(p.id, ["foreign"])).rejects.toThrow(
      "cambiaron",
    );
    await expect(
      db.saveSequence(p.id, [clips[0].id, clips[0].id]),
    ).rejects.toThrow("cambiaron");
    await db.deleteScene(clips[2].id);
    saved = (await db.readWorkspace()).projects.find(
      (item) => item.id === p.id,
    )!;
    expect(saved.sequence_ids).toEqual([clips[0].id]);
  });
});

describe("recoverable clip deletion", () => {
  it("keeps original media and restores the previous sequence position after reload", async () => {
    const project = await db.createProject(
      "Trash",
      [1, 2].map((n) => ({ title: `Clip ${n}`, prompt: "prompt" })),
      DEFAULT_VIDEO,
    );
    const clips = (await db.readWorkspace()).scenes.filter(
      (s) => s.project_id === project.id,
    );
    await db.patchScene(clips[0].id, {
      video_blob: new Blob(["original"]),
      edit_prompt: "saved edit",
      extend_prompt: "saved extension",
    });
    await db.saveSequence(
      project.id,
      clips.map((s) => s.id),
    );
    await db.deleteScene(clips[0].id);
    let workspace = await db.readWorkspace();
    expect(workspace.scenes.some((s) => s.id === clips[0].id)).toBe(false);
    expect(
      await sceneBlob(
        workspace.trash.find((s) => s.id === clips[0].id)!,
      )!.text(),
    ).toBe("original");
    await expect(db.saveSequence(project.id, [clips[0].id])).rejects.toThrow(
      "cambiaron",
    );
    await db.restoreScene(clips[0].id);
    workspace = await db.readWorkspace();
    expect(
      workspace.projects.find((p) => p.id === project.id)?.sequence_ids,
    ).toEqual(clips.map((s) => s.id));
    expect(
      workspace.scenes.find((s) => s.id === clips[0].id)?.edit_prompt,
    ).toBe("saved edit");
    expect(workspace.trash.some((s) => s.id === clips[0].id)).toBe(false);
    await db.restoreScene(clips[0].id);
    expect(
      (await db.readWorkspace()).projects.find((p) => p.id === project.id)
        ?.sequence_ids,
    ).toHaveLength(2);
  });
});

describe("durable background queue", () => {
  it("keeps submitted inputs independent of drafts and claims each request only once", async () => {
    const project = await db.createProject(
      "Queue",
      [{ title: "Clip", prompt: "Original" }],
      DEFAULT_VIDEO,
    );
    const scene = (await db.readWorkspace()).scenes.find(
      (s) => s.project_id === project.id,
    )!;
    const first = {
      id: "queued-first",
      sceneId: scene.id,
      task: {
        prompt: "Original",
        mode: "generate" as const,
        settings: DEFAULT_VIDEO,
        started_at: "today",
      },
      images: [{ role: "first" as const, mimeType: "image/png", data: "AA==" }],
      index: 1,
      total: 2,
      created_at: "today",
    };
    const second = { ...first, id: "queued-second", index: 2 };
    await db.enqueueGenerations([first, second]);
    await db.patchScene(scene.id, { prompt: "Changed draft" });
    expect(
      (await db.getScene(scene.id))?.generation_queue?.[0].task.prompt,
    ).toBe("Original");
    expect(await db.startQueuedGeneration(first)).toBe(true);
    expect(await db.startQueuedGeneration(first)).toBe(false);
    const saved = (await db.getScene(scene.id))!;
    expect(saved.task?.prompt).toBe("Original");
    expect(saved.prompt).toBe("Changed draft");
    expect(saved.generation_queue).toEqual([second]);
    await db.patchScene(scene.id, {
      task: { ...first.task, remoteId: "remote-op" },
    });
    await db.cancelQueuedGenerations(scene.id);
    expect(await db.startQueuedGeneration(second)).toBe(false);
    expect((await db.getScene(scene.id))?.task?.remoteId).toBe("remote-op");
  });
});

describe("independent generated clips", () => {
  it("allocates N cards with one request each and preserves the source when editing or extending", async () => {
    const project = await db.createProject(
      "Independent",
      [{ title: "Landscape", prompt: "Mountain" }],
      DEFAULT_VIDEO,
    );
    const original = (await db.readWorkspace()).scenes.find(
      (s) => s.project_id === project.id,
    )!;
    const request = {
      id: "output-1",
      sceneId: original.id,
      task: {
        mode: "generate" as const,
        prompt: "Mountain",
        settings: DEFAULT_VIDEO,
        started_at: "today",
      },
      images: [],
      index: 1,
      total: 3,
      created_at: "today",
    };
    const outputs = await db.enqueueClipOutputs([
      request,
      { ...request, id: "output-2", index: 2 },
      { ...request, id: "output-3", index: 3 },
    ]);
    expect(new Set(outputs.map((q) => q.sceneId)).size).toBe(3);
    expect(outputs[0].sceneId).toBe(original.id);
    let clips = (await db.readWorkspace()).scenes.filter(
      (s) => s.project_id === project.id,
    );
    expect(clips).toHaveLength(3);
    expect(clips.every((s) => s.generation_queue?.length === 1)).toBe(true);
    await db.startQueuedGeneration(outputs[0]);
    const version: ClipVersion = {
      id: "base",
      blob: new Blob(["base video"]),
      mode: "generate",
      prompt: "Mountain",
      settings: DEFAULT_VIDEO,
      duration: 8,
      created_at: "today",
      interactionId: "base-remote",
    };
    await db.saveVersion(original.id, version);
    for (const mode of ["edit", "extend"] as const) {
      const [output] = await db.enqueueClipOutputs([
        {
          ...request,
          id: `output-${mode}`,
          task: {
            ...request.task,
            mode,
            prompt: "Move camera",
            previousInteractionId: "base-remote",
            previousDuration: 8,
          },
          total: 1,
        },
      ]);
      expect(output.sceneId).not.toBe(original.id);
      const derived = (await db.getScene(output.sceneId))!;
      expect(derived.origin).toMatchObject({
        sceneId: original.id,
        versionId: "base",
        mode,
      });
      expect(derived.output_request?.task.previousInteractionId).toBe(
        "base-remote",
      );
    }
    clips = (await db.readWorkspace()).scenes.filter(
      (s) => s.project_id === project.id,
    );
    expect(clips).toHaveLength(5);
    expect((await db.getScene(original.id))?.versions).toHaveLength(1);
    expect(await sceneBlob((await db.getScene(original.id))!)?.text()).toBe(
      "base video",
    );
  });

  it("separates existing versions without changing the active result or losing media", async () => {
    const project = await db.createProject(
      "Old results",
      [{ title: "Clip", prompt: "Scene" }],
      DEFAULT_VIDEO,
    );
    const original = (await db.readWorkspace()).scenes.find(
      (s) => s.project_id === project.id,
    )!;
    for (const id of ["old-a", "old-b", "old-c"])
      await db.saveVersion(original.id, {
        id,
        blob: new Blob([id]),
        prompt: id,
        settings: DEFAULT_VIDEO,
        mode: "generate",
        duration: 8,
        created_at: "today",
      });
    await db.patchScene(original.id, { active_version_id: "old-b" });
    await db.separateVersions(original.id);
    await db.separateVersions(original.id);
    const clips = (await db.readWorkspace()).scenes.filter(
      (s) => s.project_id === project.id,
    );
    expect(clips).toHaveLength(3);
    expect(clips.every((s) => s.versions?.length === 1)).toBe(true);
    expect(await Promise.all(clips.map((s) => sceneBlob(s)!.text()))).toEqual([
      "old-b",
      "old-a",
      "old-c",
    ]);
  });
});

describe("review and queue preferences", () => {
  it("persists favorites, discarded clips, priority and batch cancellation without changing an active task", async () => {
    const project = await db.createProject(
      "Activity",
      [{ title: "Clip", prompt: "prompt" }],
      DEFAULT_VIDEO,
    );
    const source = (await db.readWorkspace()).scenes.find(
      (s) => s.project_id === project.id,
    )!;
    const request = {
      id: "managed-1",
      batchId: "batch",
      sceneId: source.id,
      task: {
        mode: "generate" as const,
        prompt: "prompt",
        settings: DEFAULT_VIDEO,
        started_at: "today",
      },
      images: [],
      index: 1,
      total: 3,
      created_at: "today",
    };
    const items = await db.enqueueClipOutputs([
      request,
      { ...request, id: "managed-2", index: 2 },
      { ...request, id: "managed-3", index: 3 },
    ]);
    await db.startQueuedGeneration(items[0]);
    await db.patchScene(source.id, {
      review: "favorite",
      task: { ...request.task, remoteId: "in-progress" },
    });
    await db.patchScene(items[1].sceneId, { review: "discarded" });
    await db.updateQueuedOrder([items[2].id, items[1].id]);
    expect(
      (await db.getScene(items[2].sceneId))?.generation_queue?.[0].queueOrder,
    ).toBe(0);
    await db.updateQueuedOrder([], [items[1].id, items[2].id]);
    expect((await db.getScene(source.id))?.task?.remoteId).toBe("in-progress");
    expect((await db.getScene(source.id))?.review).toBe("favorite");
    expect((await db.getScene(items[1].sceneId))?.review).toBe("discarded");
    expect(
      (await db.readWorkspace()).scenes
        .filter((s) => s.project_id === project.id)
        .flatMap((s) => s.generation_queue || []),
    ).toHaveLength(0);
  });
});

it("persists independent trims and restores every occurrence after trash, without regrouping when adding clips", async () => {
  const p = await db.createProject(
    "Montage",
    [
      { title: "A", prompt: "a" },
      { title: "B", prompt: "b" },
      { title: "C", prompt: "c" },
    ],
    DEFAULT_VIDEO,
  );
  const [a, b, c] = (await db.readWorkspace()).scenes.filter(
    (s) => s.project_id === p.id,
  );
  const items = [
    { id: "a1", scene_id: a.id, in: 1, out: 3, volume: 0 },
    { id: "b1", scene_id: b.id, in: 0, out: 2, volume: 1 },
    { id: "a2", scene_id: a.id, in: 4, out: 6, volume: 0.5 },
  ];
  await db.saveMontage(p.id, items, "16:9");
  await db.saveSequence(p.id, [a.id, b.id, c.id]);
  let saved = (await db.readWorkspace()).projects.find((x) => x.id === p.id)!;
  expect(saved.sequence_items?.slice(0, 3)).toEqual(items);
  await db.deleteScene(a.id);
  saved = (await db.readWorkspace()).projects.find((x) => x.id === p.id)!;
  expect(saved.sequence_items?.map((i) => i.scene_id)).toEqual([b.id, c.id]);
  await db.restoreScene(a.id);
  saved = (await db.readWorkspace()).projects.find((x) => x.id === p.id)!;
  expect(saved.sequence_items?.slice(0, 3)).toEqual(items);
  expect(saved.sequence_aspect).toBe("16:9");
  await expect(
    db.saveMontage(p.id, [{ ...items[0], out: 0.1 }], "9:16"),
  ).rejects.toThrow("recorte");
  expect(
    (await db.readWorkspace()).projects.find((x) => x.id === p.id)
      ?.sequence_items,
  ).toEqual(saved.sequence_items);
});
