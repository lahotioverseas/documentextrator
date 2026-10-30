import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker
if (typeof window !== 'undefined') {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version || '4.10.38'}/pdf.worker.min.mjs`;
  } catch (e) {
    console.warn('Could not set external workerSrc, will fallback to inline worker if available');
  }
}

export interface ConvertedPageImage {
  pageNumber: number;
  mimeType: string;
  data: string; // Base64 without data:image/png;base64, prefix
  dataUrl: string; // Full Data URL
}

export async function convertFileToVisionParts(file: File): Promise<{
  pages: ConvertedPageImage[];
  extractedText?: string;
}> {
  // If it's an image file (PNG/JPG/WEBP)
  if (file.type.startsWith('image/')) {
    const dataUrl = await readFileAsDataUrl(file);
    const base64 = dataUrl.split(',')[1];
    return {
      pages: [
        {
          pageNumber: 1,
          mimeType: file.type || 'image/png',
          data: base64,
          dataUrl
        }
      ]
    };
  }

  // If it's a PDF file
  if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
      const pdf = await loadingTask.promise;
      const numPages = Math.min(pdf.numPages, 10); // Cap at 10 pages for multimodal payload size
      const pages: ConvertedPageImage[] = [];
      let fullText = '';

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 1.5 }); // 1.5x scale for optimal text vision with low payload size

        // Render to canvas
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        if (context) {
          // Fill canvas with white background before rendering PDF to prevent transparent background turning black in JPEG
          context.fillStyle = '#FFFFFF';
          context.fillRect(0, 0, canvas.width, canvas.height);

          await (page.render as any)({
            canvasContext: context,
            viewport: viewport,
            canvas: canvas
          }).promise;

          const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
          const base64 = dataUrl.split(',')[1];

          pages.push({
            pageNumber: i,
            mimeType: 'image/jpeg',
            data: base64,
            dataUrl
          });
        }

        // Also extract text layer if present
        try {
          const textContent = await page.getTextContent();
          const pageStrings = textContent.items.map((item: any) => item.str || '').join(' ');
          fullText += `\n--- PAGE ${i} ---\n` + pageStrings;
        } catch {
          // ignore text extraction errors if scanned image
        }
      }

      return { pages, extractedText: fullText.trim() };
    } catch (err) {
      console.warn('PDF.js rendering error, falling back to direct arrayBuffer base64:', err);
      const dataUrl = await readFileAsDataUrl(file);
      const base64 = dataUrl.split(',')[1];
      return {
        pages: [
          {
            pageNumber: 1,
            mimeType: 'application/pdf',
            data: base64,
            dataUrl
          }
        ]
      };
    }
  }

  // Fallback for text files
  const text = await file.text();
  return {
    pages: [],
    extractedText: text
  };
}

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
