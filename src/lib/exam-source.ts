/* The original paper, opened in the reviewer's own browser so a card can be checked
 * against the page it was read from. Nothing here is uploaded anywhere: the files the
 * reviewer picks are read from disk and drawn onto a canvas. pdf.js is loaded the
 * first time a paper is opened, never with the app. */

import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";

export interface PaperPages {
  /** pages across the chosen files, counted from 1 in the order they were chosen —
   * the same way the backend counts the pages of an upload */
  count: number;
  /** draw page `page` into `canvas`, `cssWidth` CSS pixels wide. Resolves when the
   * page is drawn, or when `signal` aborts (a page change while drawing). */
  render: (
    page: number,
    canvas: HTMLCanvasElement,
    cssWidth: number,
    signal: AbortSignal,
  ) => Promise<void>;
  dispose: () => void;
}

type Source =
  | { kind: "pdf"; doc: PDFDocumentProxy; pages: number }
  | { kind: "image"; image: HTMLImageElement; url: string };

const loadPdfjs = () => import("pdfjs-dist/legacy/build/pdf.mjs");

const isPdf = (file: File) => file.type === "application/pdf" || /\.pdf$/i.test(file.name);

function loadImage(file: File): Promise<Extract<Source, { kind: "image" }>> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve({ kind: "image", image, url });
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Không mở được ảnh “${file.name}”`));
    };
    image.src = url;
  });
}

/** Opens the picked files as one paper. Rejects with a message fit to show. */
export async function openPaper(files: File[]): Promise<PaperPages> {
  if (files.length === 0) throw new Error("Chưa chọn tệp nào");
  const sources: Source[] = [];
  const free = () => {
    for (const s of sources) {
      if (s.kind === "pdf") void s.doc.destroy();
      else URL.revokeObjectURL(s.url);
    }
  };
  try {
    let pdfjs: Awaited<ReturnType<typeof loadPdfjs>> | null = null;
    for (const file of files) {
      if (isPdf(file)) {
        pdfjs ??= await loadPdfjs();
        pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
        try {
          const doc = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
            .promise;
          sources.push({ kind: "pdf", doc, pages: doc.numPages });
        } catch {
          throw new Error(`Không mở được “${file.name}” (tệp PDF hỏng hoặc có mật khẩu)`);
        }
      } else if (file.type.startsWith("image/")) {
        sources.push(await loadImage(file));
      } else {
        throw new Error(`“${file.name}” không phải PDF hay ảnh`);
      }
    }
  } catch (e) {
    free();
    throw e;
  }

  const count = sources.reduce((n, s) => n + (s.kind === "pdf" ? s.pages : 1), 0);

  /** which source holds page n, and the page number inside it */
  const locate = (page: number): { source: Source; local: number } | null => {
    let rest = page;
    for (const source of sources) {
      const size = source.kind === "pdf" ? source.pages : 1;
      if (rest <= size) return { source, local: rest };
      rest -= size;
    }
    return null;
  };

  return {
    count,
    dispose: free,
    async render(page, canvas, cssWidth, signal) {
      const at = locate(page);
      const ctx = canvas.getContext("2d");
      if (!at || !ctx || signal.aborted) return;
      const ratio = Math.min(window.devicePixelRatio || 1, 2);
      if (at.source.kind === "image") {
        const { image } = at.source;
        const height = (cssWidth * image.naturalHeight) / image.naturalWidth;
        canvas.width = Math.round(cssWidth * ratio);
        canvas.height = Math.round(height * ratio);
        canvas.style.width = `${cssWidth}px`;
        canvas.style.height = `${height}px`;
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        return;
      }
      const pdfPage = await at.source.doc.getPage(at.local);
      if (signal.aborted) return;
      const natural = pdfPage.getViewport({ scale: 1 });
      const viewport = pdfPage.getViewport({ scale: (cssWidth / natural.width) * ratio });
      canvas.width = Math.floor(viewport.width);
      canvas.height = Math.floor(viewport.height);
      canvas.style.width = `${cssWidth}px`;
      canvas.style.height = `${viewport.height / ratio}px`;
      const task = pdfPage.render({ canvasContext: ctx, viewport });
      const stop = () => task.cancel();
      signal.addEventListener("abort", stop, { once: true });
      try {
        await task.promise;
      } catch (e) {
        if ((e as { name?: string } | null)?.name !== "RenderingCancelledException") throw e;
      } finally {
        signal.removeEventListener("abort", stop);
      }
    },
  };
}
