// pages/api/ocr.js
import multer from "multer";
import path from "path";
import { createWorker } from "tesseract.js";

// Let multer handle multipart/form-data (so we get a Buffer)
export const config = {
  api: { bodyParser: false },
};

// In-memory storage (no temp files)
const upload = multer({ storage: multer.memoryStorage() });

// Tiny helper to await multer
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  try {
    // Expect the field name to be "image"
    await runMiddleware(req, res, upload.single("image"));

    if (!req.file?.buffer) {
      return res
        .status(400)
        .json({ error: "No image uploaded (field name should be 'image')." });
    }

    const worker = await createWorker({
      corePath: require.resolve("tesseract.js-core/tesseract-core.wasm"),
      workerPath: require.resolve("tesseract.js/dist/worker.min.js"),
      langPath: path.join(process.cwd(), "eng.traineddata"),
    });
    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");
    const { data } = await worker.recognize(req.file.buffer);
    const text = (data?.text || "").trim();
    await worker.terminate();

    return res.status(200).json({ text });
  } catch (err) {
    console.error("OCR Error:", err);
    return res.status(500).json({ error: "OCR failed" });
  }
}
