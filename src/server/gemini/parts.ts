// Uploaded page images + extracted text -> Gemini content parts.
export function buildImageParts(imageParts: any, textContent: any, textLabel: string): any[] {
  const parts: any[] = [];
  if (imageParts && Array.isArray(imageParts)) {
    for (const img of imageParts) {
      parts.push({ inlineData: { mimeType: img.mimeType || 'image/png', data: img.data } });
    }
  }
  if (textContent) {
    parts.push({ text: `${textLabel}:\n${textContent}` });
  }
  return parts;
}
