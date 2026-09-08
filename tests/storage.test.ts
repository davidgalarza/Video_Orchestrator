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
