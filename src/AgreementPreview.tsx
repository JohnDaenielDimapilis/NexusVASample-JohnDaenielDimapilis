import { useEffect, useRef, useState } from "react";
import { GlobalWorkerOptions, getDocument } from "pdfjs-dist";
import type { PDFDocumentProxy } from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

GlobalWorkerOptions.workerSrc = workerUrl;

export default function AgreementPreview({
  url,
  name,
}: {
  url: string;
  name: string;
}) {
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [page, setPage] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [pageText, setPageText] = useState("");
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let active = true;
    setPdf(null);
    setPage(1);
    setError("");
    setLoading(true);
    const task = getDocument({
      url,
      isEvalSupported: false,
      enableXfa: false,
      maxImageSize: 16777216,
      canvasMaxAreaInBytes: 67108864,
    });
    void task.promise
      .then((document) => {
        if (active) setPdf(document);
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : "The PDF could not be opened. Download it to review in your PDF reader.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
      void task.destroy();
    };
  }, [url]);
  useEffect(() => {
    if (!pdf || !canvas.current) return;
    let active = true;
    let cancel: (() => void) | undefined;
    setLoading(true);
    setError("");
    void pdf
      .getPage(page)
      .then(async (pdfPage) => {
        if (!active || !canvas.current) return;
        const natural = pdfPage.getViewport({ scale: 1 });
        const viewport = pdfPage.getViewport({
          scale: Math.min(1.5, 1800 / natural.width, 2400 / natural.height),
        });
        const target = canvas.current;
        target.width = viewport.width;
        target.height = viewport.height;
        const render = pdfPage.render({ canvas: target, viewport });
        cancel = () => render.cancel();
        await render.promise;
        const content = await pdfPage.getTextContent();
        if (active) {
          setPageText(
            content.items
              .map((item) => ("str" in item ? item.str : ""))
              .join(" "),
          );
          setLoading(false);
        }
      })
      .catch((e) => {
        if (active) {
          setError(
            e instanceof Error
              ? e.message
              : "This PDF page could not be rendered.",
          );
          setLoading(false);
        }
      });
    return () => {
      active = false;
      cancel?.();
    };
  }, [pdf, page]);
  return (
    <section className="wf-pdf-reader" aria-label={`PDF preview: ${name}`}>
      <div className="wf-pdf-toolbar">
        <button
          type="button"
          className="button secondary small"
          disabled={!pdf || page <= 1 || loading}
          onClick={() => setPage((p) => p - 1)}
        >
          Previous page
        </button>
        <span aria-live="polite">
          Page {page} of {pdf?.numPages || "…"}
        </span>
        <button
          type="button"
          className="button secondary small"
          disabled={!pdf || page >= pdf.numPages || loading}
          onClick={() => setPage((p) => p + 1)}
        >
          Next page
        </button>
      </div>
      {loading && <p role="status">Loading PDF page…</p>}
      {error && <p role="alert">{error}</p>}
      <canvas ref={canvas} role="img" aria-label={`${name}, page ${page}`} />
      <p className="sr-only">{pageText}</p>
    </section>
  );
}
