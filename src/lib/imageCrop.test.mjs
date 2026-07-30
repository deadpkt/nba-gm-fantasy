import assert from "node:assert/strict";
import test from "node:test";
import { calculateCropPlacement } from "./imageCrop.js";

test("square crop covers a landscape image without empty space", () => {
  const crop = calculateCropPlacement({ imageWidth: 1200, imageHeight: 800, outputWidth: 512, outputHeight: 512 });
  assert.equal(crop.drawHeight, 512);
  assert.equal(crop.drawWidth, 768);
  assert.equal(crop.x, -128);
});

test("normalized positioning and zoom remain inside the crop", () => {
  const crop = calculateCropPlacement({ imageWidth: 1000, imageHeight: 1000, outputWidth: 1600, outputHeight: 500, zoom: 2, position: { x: 1, y: -1 } });
  assert.equal(crop.x, 0);
  assert.equal(crop.y, -2700);
  assert.ok(crop.drawWidth >= 1600 && crop.drawHeight >= 500);
});
