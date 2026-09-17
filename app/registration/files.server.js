const formats = {
  pdf: {
    mime: "application/pdf",
    magic: (bytes) => bytes.subarray(0, 5).toString() === "%PDF-",
  },
  png: {
    mime: "image/png",
    magic: (bytes) =>
      bytes
        .subarray(0, 8)
        .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])),
  },
  jpg: {
    mime: "image/jpeg",
    magic: (bytes) => bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
  },
};
export async function validateUpload(file, field) {
  const filename = Array.from(
    String(file.name || "document")
      .split(/[\\/]/)
      .pop(),
  )
    .filter((char) => char.charCodeAt(0) >= 32 && char.charCodeAt(0) !== 127)
    .join("")
    .slice(0, 150);
  const extension = filename
    .split(".")
    .pop()
    .toLowerCase()
    .replace("jpeg", "jpg");
  const format = formats[extension];
  const maximum =
    Math.min(10, Math.max(1, Number(field.settings?.maxFileSizeMB) || 5)) *
    1024 *
    1024;
  if (!format || file.type !== format.mime)
    throw new Error(
      "Upload a PDF, JPG, JPEG or PNG with a matching file type.",
    );
  if (!file.size || file.size > maximum)
    throw new Error(
      `File must be between 1 byte and ${maximum / 1024 / 1024} MB.`,
    );
  const bytes = Buffer.from(await file.arrayBuffer());
  if (!format.magic(bytes))
    throw new Error("The file contents do not match its declared type.");
  return { filename, mimeType: format.mime, size: bytes.length, data: bytes };
}
