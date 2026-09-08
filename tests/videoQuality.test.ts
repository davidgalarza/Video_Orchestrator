import { describe, expect, it } from "vitest";
import { outputDimensions, qualityFilename } from "../src/lib/videoQuality";
describe("download sizes", () => {
  it("fits horizontal, vertical and square media without changing the framing", () => {
    expect(outputDimensions(1280, 720, "1080p")).toEqual({
      width: 1920,
      height: 1080,
    });
    expect(outputDimensions(720, 1280, "4k")).toEqual({
      width: 2160,
      height: 3840,
    });
    expect(outputDimensions(2160, 3840, "720p")).toEqual({
      width: 720,
      height: 1280,
    });
    expect(outputDimensions(1000, 1000, "1080p")).toEqual({
      width: 1080,
      height: 1080,
    });
    expect(outputDimensions(1920, 1080, "original")).toEqual({
      width: 1920,
      height: 1080,
    });
  });
  it("makes encoder-compatible dimensions and rejects broken metadata", () => {
    expect(outputDimensions(853, 480, "720p")).toEqual({
      width: 1280,
      height: 720,
    });
    expect(() => outputDimensions(0, 720, "4k")).toThrow();
    expect(() => outputDimensions(1920, NaN, "720p")).toThrow();
  });
  it("distinguishes prepared downloads from the original file", () => {
    expect(qualityFilename("Clip.mp4", "original")).toBe("Clip.mp4");
    expect(qualityFilename("Clip.MP4", "4k")).toBe("Clip-4k.mp4");
  });
});
