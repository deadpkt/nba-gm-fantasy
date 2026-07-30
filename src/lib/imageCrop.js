export function calculateCropPlacement({ imageWidth, imageHeight, outputWidth, outputHeight, zoom = 1, position = { x: 0, y: 0 } }) {
  if (![imageWidth, imageHeight, outputWidth, outputHeight].every((value) => Number.isFinite(value) && value > 0)) {
    throw new Error("A valid image and crop size are required.");
  }
  const safeZoom = Math.max(1, zoom);
  const scale = Math.max(outputWidth / imageWidth, outputHeight / imageHeight) * safeZoom;
  const drawWidth = imageWidth * scale;
  const drawHeight = imageHeight * scale;
  const overflowX = Math.max(0, drawWidth - outputWidth);
  const overflowY = Math.max(0, drawHeight - outputHeight);
  const x = (outputWidth - drawWidth) / 2 + Math.max(-1, Math.min(1, position.x || 0)) * overflowX / 2;
  const y = (outputHeight - drawHeight) / 2 + Math.max(-1, Math.min(1, position.y || 0)) * overflowY / 2;
  return { x, y, drawWidth, drawHeight };
}

function loadImage(source) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("The selected image could not be opened."));
    image.src = source;
  });
}

export async function createCroppedImage(file, options) {
  const source = URL.createObjectURL(file);
  try {
    const image = await loadImage(source);
    const canvas = document.createElement("canvas");
    canvas.width = options.width;
    canvas.height = options.height;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image cropping is not supported in this browser.");
    const placement = calculateCropPlacement({
      imageWidth: image.naturalWidth,
      imageHeight: image.naturalHeight,
      outputWidth: options.width,
      outputHeight: options.height,
      zoom: options.zoom,
      position: options.position,
    });
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.drawImage(image, placement.x, placement.y, placement.drawWidth, placement.drawHeight);
    const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/jpeg", options.quality ?? 0.9));
    if (!blob) throw new Error("The cropped image could not be created.");
    return blob;
  } finally {
    URL.revokeObjectURL(source);
  }
}
