import { createWorker } from "tesseract.js";
import multer from "multer";
import { promisify } from "util";

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB limit
});

const uploadMiddleware = promisify(upload.single("image"));

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  try {
    await uploadMiddleware(req, res);

    if (!req.file) {
      return res.status(400).json({ error: "No image provided" });
    }

    const worker = await createWorker("eng");

    // Optimize for schedule text
    await worker.setParameters({
      tessedit_char_whitelist:
        "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz -/:.,()#",
      tessedit_pageseg_mode: "6", // Single uniform block of text
    });

    const {
      data: { text, confidence },
    } = await worker.recognize(req.file.buffer);

    await worker.terminate();

    if (confidence < 30) {
      return res.status(400).json({
        error:
          "Text extraction confidence too low. Please try a clearer image.",
        confidence,
      });
    }

    res.status(200).json({
      text: text.trim(),
      confidence: Math.round(confidence),
    });
  } catch (error) {
    console.error("OCR Error:", error);
    res.status(500).json({ error: "Failed to process image" });
  }
}

export const config = {
  api: {
    bodyParser: false,
  },
};
