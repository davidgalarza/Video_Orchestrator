import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { archiveClips, createZip } from "../src/lib/archive";
import { DEFAULT_VIDEO, type Scene } from "../src/types";
function readZip(data: Uint8Array) {
  const dir = mkdtempSync(join(tmpdir(), "vidgen-zip-"));
  try {
    const file = join(dir, "clips.zip");
    writeFileSync(file, data);
    return JSON.parse(
      execFileSync(
        "python3",
        [
          "-c",
          "import zipfile,json,sys; z=zipfile.ZipFile(sys.argv[1]); assert z.testzip() is None; print(json.dumps({n:z.read(n).decode('utf-8') for n in z.namelist()}))",
          file,
        ],
        { encoding: "utf8" },
      ),
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}
describe("portable clip archives", () => {
  it("produces a ZIP readable by an independent decoder, with UTF-8 names and valid CRCs", async () => {
    const zip = await createZip([
      { name: "vídeo.mp4", blob: new Blob(["original media"]) },
      { name: "empty", blob: new Blob([]) },
    ]);
    expect(readZip(new Uint8Array(await zip.arrayBuffer()))).toEqual({
      "vídeo.mp4": "original media",
      empty: "",
    });
  });
  it("exports active versions, unique safe filenames and metadata, excluding drafts", async () => {
    const base: Scene = {
      id: "1",
      project_id: "p",
      order: 0,
      title: "../Mismo/clip",
      prompt: "draft",
      status: "completed",
      created_at: "",
      updated_at: "",
      versions: [
        {
          id: "old",
          blob: new Blob(["old"]),
          prompt: "selected prompt",
          settings: DEFAULT_VIDEO,
          duration: 8,
          mode: "generate",
          created_at: "",
        },
        {
          id: "new",
          blob: new Blob(["new"]),
          prompt: "new",
          settings: DEFAULT_VIDEO,
          duration: 8,
          mode: "edit",
          created_at: "",
        },
      ],
      active_version_id: "old",
    };
    const zip = await archiveClips([
      base,
      { ...base, id: "2" },
      { ...base, id: "3", versions: undefined },
    ]);
    const files = readZip(new Uint8Array(await zip.arrayBuffer()));
    const names = Object.keys(files).filter((name) => name.endsWith(".mp4"));
    expect(names).toHaveLength(2);
    expect(
      names.every((name) => !name.includes("/") && files[name] === "old"),
    ).toBe(true);
    expect(JSON.parse(files["clips.json"])[0].prompt).toBe("selected prompt");
  });
  it("rejects an empty selection and oversized archives before reading media", async () => {
    await expect(createZip([])).rejects.toThrow("Selecciona");
    await expect(
      createZip([{ name: "large.mp4", blob: { size: 0xffffffff } as Blob }]),
    ).rejects.toThrow("4 GB");
  });
});

describe("custom download names", () => {
  it("sanitizes user names and keeps colliding files distinct without metadata when disabled", async () => {
    const base: Scene = {
      id: "a",
      project_id: "p",
      title: "Clip",
      order: 0,
      prompt: "prompt",
      status: "completed",
      video_blob: new Blob(["original"]),
      created_at: "today",
      updated_at: "today",
    };
    const files = readZip(
      new Uint8Array(
        await (
          await archiveClips([base, { ...base, id: "b" }], {
            names: { a: "../Same/clip.mp4", b: "../Same/clip.mp4" },
            includeMetadata: false,
          })
        ).arrayBuffer(),
      ),
    );
    const names = Object.keys(files);
    expect(names).toHaveLength(2);
    expect(names[0]).not.toEqual(names[1]);
    expect(
      names.every((n) => !n.includes("/") && files[n] === "original"),
    ).toBe(true);
    expect(files["clips.json"]).toBeUndefined();
  });
});
