import { describe, expect, it } from "vitest";
import {
  clipAtTime,
  makeSequenceItem,
  projectSequence,
  resolveTimeline,
  sequenceSource,
  sourceKey,
  splitSequence,
  timecode,
} from "../src/lib/timeline";
import { DEFAULT_VIDEO, type Scene } from "../src/types";
const blob = new Blob(["original"]);
const scene: Scene = {
  id: "s",
  project_id: "p",
  order: 0,
  prompt: "",
  status: "completed",
  created_at: "",
  updated_at: "",
  versions: [
    {
      id: "v1",
      blob,
      mode: "generate",
      prompt: "",
      settings: DEFAULT_VIDEO,
      duration: 8,
      created_at: "",
    },
  ],
};
describe("non-destructive timeline", () => {
  it("migrates legacy order, respects an empty montage and pins the chosen generation", () => {
    const project = { id: "p", name: "", created_at: "" };
    const [item] = projectSequence(project, [scene]);
    expect(item.version_id).toBe("v1");
    expect(projectSequence({ ...project, sequence_ids: [] }, [scene])).toEqual(
      [],
    );
    const later = {
      ...scene,
      active_version_id: "v2",
      versions: [
        ...scene.versions!,
        { ...scene.versions![0], id: "v2", blob: new Blob(["new"]) },
      ],
    };
    expect(sequenceSource(item, [later]).blob).toBe(blob);
    expect(
      sequenceSource(item, [{ ...later, versions: later.versions.slice(1) }])
        .blob,
    ).toBeUndefined();
  });
  it("uses decoded media duration, clamps trims and locates both sides of a cut", () => {
    const item = makeSequenceItem(scene, "one");
    const clips = resolveTimeline(
      [
        { ...item, in: 0.25, out: 0.75 },
        { ...item, id: "two", in: 0.5, out: 8 },
      ],
      [scene],
      { [sourceKey(item)]: 1 },
    );
    expect(clips.map((c) => [c.start, c.length])).toEqual([
      [0, 0.5],
      [0.5, 0.5],
    ]);
    expect(clipAtTime(clips, 0.499)?.id).toBe("one");
    expect(clipAtTime(clips, 0.5)?.id).toBe("two");
    expect(clipAtTime(clips, 1)?.id).toBe("two");
  });
  it("splits at source time without gaps, preserves mute and refuses endpoint cuts", () => {
    const item = {
      ...makeSequenceItem(scene, "one"),
      in: 2,
      out: 6,
      volume: 0,
    };
    const [clip] = resolveTimeline([item], [scene]);
    expect(splitSequence([item], clip, 0)).toEqual([item]);
    expect(splitSequence([item], clip, 4)).toEqual([item]);
    const split = splitSequence([item], clip, 1.5, "two");
    expect(split.map((c) => [c.in, c.out, c.volume])).toEqual([
      [2, 3.5, 0],
      [3.5, 6, 0],
    ]);
    expect(
      resolveTimeline(split, [scene]).reduce((sum, c) => sum + c.length, 0),
    ).toBe(4);
    expect(timecode(61.5)).toBe("01:01:12");
  });
});
