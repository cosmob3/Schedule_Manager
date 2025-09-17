// pages/api/ocr.js
import multer from "multer";

export const config = {
  runtime: "nodejs",
  api: { bodyParser: false },
};

const upload = multer({
  storage: multer.memoryStorage(),
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype || !file.mimetype.startsWith("image/")) {
      return cb(
        new multer.MulterError("LIMIT_UNEXPECTED_FILE", file.fieldname)
      );
    }
    cb(null, true);
  },
  limits: { fileSize: 8 * 1024 * 1024 },
});

const acceptEitherField = upload.fields([
  { name: "file", maxCount: 1 },
  { name: "image", maxCount: 1 },
]);

function runMiddleware(req, res, fn) {
  return new Promise((resolve, reject) => {
    fn(req, res, (result) =>
      result instanceof Error ? reject(result) : resolve(result)
    );
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST")
    return res.status(405).json({ error: "Method not allowed" });

  try {
    await runMiddleware(req, res, acceptEitherField);

    const file =
      (req.files?.file && req.files.file[0]) ||
      (req.files?.image && req.files.image[0]);

    if (!file?.buffer)
      return res.status(400).json({ error: "No image uploaded" });

    // pages/api/ocr.js  (only the worker section shown here)
    const { createWorker } = await import("tesseract.js");

   const worker = await createWorker({
     workerPath: "https://unpkg.com/tesseract.js@4.1.1/dist/worker.min.js",
      corePath: "https://unpkg.com/tesseract.js-core@4.0.3/tesseract-core.wasm.js",
      langPath: "https://tessdata.projectnaptha.com/4.0.0",
    logger: () => {},
    });

    await worker.load();
    await worker.loadLanguage("eng");
    await worker.initialize("eng");

    const { data } = await worker.recognize(file.buffer);
    await worker.terminate();

    return res.status(200).json({ text: (data?.text || "").trim() });
  } catch (err) {
    console.error("OCR Error:", err);
    if (err?.name === "MulterError") {
      return res.status(400).json({ error: err.code || "Upload error" });
    }
    return res.status(500).json({ error: "OCR failed" });
  }
}
