// pages/api/ocr.js
import multer from "multer";

// Next.js API config:
// - Use Node runtime (NOT edge) for tesseract.js
// - Disable default body parser so multer can handle multipart/form-data
export const config = {
  runtime: "nodejs",
  api: { bodyParser: false },
};

// In-memory storage (no temp files on disk)
const upload = multer({ storage: multer.memoryStorage() });

// Helper to promisify multer middleware
function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) => {
      if (result instanceof Error) return reject(result);
      return resolve(result);
    });
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    // Expect a single file field named "file"
    await runMiddleware(req, res, upload.single("file"));

    if (!req.file || !req.file.buffer) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    // Dynamically import tesseract.js so it only loads in Node
    const { createWorker } = await import("tesseract.js");

    const worker = await createWorker(); // uses CDN for core + traineddata by default
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
