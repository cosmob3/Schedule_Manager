// app/page.tsx
"use client";

import React, { useState, useEffect } from "react";
import { Upload, Calendar, CheckCircle, AlertCircle } from "lucide-react";
import { useSession } from "next-auth/react";
import ConnectGoogle from "./components/ConnectGoogle";
import RequireGoogle from "./components/RequireGoogle";
// If you have a localStorage hook, you can keep using it;
// otherwise you can swap to regular useState and JSON.parse/stringify.

interface Shift {
  id: string;
  date: string;
  startTime: string;
  endTime: string;
  location: string;
  position: string;
  notes: string;
}

export default function Home() {
  const { data: session } = useSession();

  // --- STATE ---
  const [hydrated, setHydrated] = useState(false);
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState("");
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [dragActive, setDragActive] = useState(false);

  // ---- PERSIST on change ----
  useEffect(() => {
    localStorage.setItem("sm.extractedText", extractedText);
  }, [extractedText]);

  useEffect(() => {
    localStorage.setItem("sm.shifts", JSON.stringify(shifts));
  }, [shifts]);

  useEffect(() => {
    localStorage.setItem("sm.currentStep", String(currentStep));
  }, [currentStep]);

  // ---- RESTORE once on first client mount ----
  useEffect(() => {
    try {
      const storedText = localStorage.getItem("sm.extractedText") || "";
      const storedShiftsRaw = localStorage.getItem("sm.shifts");
      const storedStepRaw = localStorage.getItem("sm.currentStep");

      if (storedText) setExtractedText(storedText);
      if (storedShiftsRaw) {
        const parsed = JSON.parse(storedShiftsRaw);
        if (Array.isArray(parsed)) setShifts(parsed);
      }

      // Decide the step strictly from storage (don’t infer from File objects)
      if (storedStepRaw) {
        setCurrentStep(Number(storedStepRaw));
      } else if (storedText && storedShiftsRaw) {
        setCurrentStep(4);
      } else if (storedText) {
        setCurrentStep(3);
      } else {
        setCurrentStep(1);
      }
    } catch (e) {
      // if something goes wrong, don’t crash hydration
      console.warn("restore failed:", e);
    } finally {
      setHydrated(true);
    }
  }, []);

  // (optional) receive a “persist now” ping just before auth redirects
  useEffect(() => {
    const handler = () => {
      localStorage.setItem("sm.extractedText", extractedText);
      localStorage.setItem("sm.shifts", JSON.stringify(shifts));
      localStorage.setItem("sm.currentStep", String(currentStep));
    };
    window.addEventListener("sm:persist", handler);
    return () => window.removeEventListener("sm:persist", handler);
  }, [extractedText, shifts, currentStep]);
  // Clear workspace
  const clearWorkspace = () => {
    localStorage.removeItem("sm.currentStep");
    localStorage.removeItem("sm.extractedText");
    localStorage.removeItem("sm.shifts");
    setCurrentStep(1);
    setExtractedText("");
    setShifts([]);
    setSelectedImage(null);
  };

  // ---- Upload / DnD ----
  const handleFile = (file?: File | null) => {
    if (!file) return;
    setSelectedImage(file);
    setCurrentStep(2);
    runOCR(file);
  };

  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!dragActive) setDragActive(true);
  };

  const onDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const onDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    const file = e.dataTransfer.files?.[0];
    handleFile(file ?? null);
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFile(event.target.files?.[0] ?? null);
  };

  // ---- OCR ----
  const runOCR = async (file: File) => {
    setIsProcessing(true);
    const fd = new FormData();
    fd.append("image", file);
    const res = await fetch("/api/ocr", { method: "POST", body: fd });
    setIsProcessing(false);

    if (!res.ok) {
      alert("OCR failed");
      return;
    }
    const data = await res.json(); // { text }
    setExtractedText(data.text || "");
    setCurrentStep(3);
  };

  // ---- Parse ----
  const parseSchedule = async () => {
    if (!extractedText) return;
    const res = await fetch("/api/parse-schedule", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: extractedText }),
    });
    if (!res.ok) {
      alert("Parsing failed");
      return;
    }
    const data = await res.json(); // { shifts: Shift[] }
    setShifts(data.shifts || []);
    setCurrentStep(4);
  };

  // ---- Edit ----
  const updateShift = (id: string, patch: Partial<Shift>) => {
    setShifts((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...patch } : s))
    );
  };

  // ---- Calendar ----
  const addToCalendar = async () => {
    for (const shift of shifts) {
      const payload = {
        title: `${shift.position} Shift`,
        description: shift.notes,
        startISO: `${shift.date}T${shift.startTime}:00`,
        endISO: `${shift.date}T${shift.endTime}:00`,
        location: shift.location,
      };
      const res = await fetch("/api/calendar/create-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const msg = await res.text();
        alert(`Failed to add ${shift.date} shift: ${msg}`);
        return;
      }
    }
    alert("All shifts added to Google Calendar!");
  };

  if (!hydrated) {
    // avoid a “flash” of step 1 before restore runs
    return null; // or a tiny spinner if you prefer
  }
  // ---- UI ----
  return (
    <RequireGoogle>
      <div className="min-h-screen bg-gradient-to-br from-green-600 to-green-800 p-4">
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="text-center text-white mb-8">
            <h1 className="text-4xl font-bold mb-2">
              ☕ Starbucks Schedule Manager
            </h1>
            <p className="text-lg">
              Upload your schedule image and add shifts to Google Calendar
            </p>
            <div className="flex justify-center">
              <ConnectGoogle />
            </div>

            <button
              onClick={clearWorkspace}
              className="text-sm text-gray-200 underline mb-4"
            >
              Reset workspace
            </button>
          </div>

          {/* Progress Steps */}
          <div className="flex justify-center mb-8">
            <div className="flex items-center space-x-4">
              {[1, 2, 3, 4].map((step) => (
                <div key={step} className="flex items-center">
                  <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold ${
                      currentStep >= step
                        ? "bg-white text-green-600"
                        : "bg-green-500 text-white"
                    }`}
                  >
                    {currentStep > step ? (
                      <CheckCircle className="w-5 h-5" />
                    ) : (
                      step
                    )}
                  </div>
                  {step < 4 && (
                    <div
                      className={`w-16 h-1 ${
                        currentStep > step ? "bg-white" : "bg-green-500"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Step 1: Upload */}
          {currentStep >= 1 && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                <Upload className="inline w-6 h-6 mr-2" />
                Step 1: Upload Schedule Image
              </h2>

              <div
                onDragOver={onDragOver}
                onDragEnter={onDragEnter}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                role="button"
                tabIndex={0}
                className={[
                  "rounded-lg p-8 text-center border-2 border-dashed transition-colors",
                  dragActive
                    ? "border-green-600 bg-green-50"
                    : "border-green-300",
                ].join(" ")}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="image-upload"
                />
                <label htmlFor="image-upload" className="cursor-pointer">
                  <div className="text-6xl mb-4">📷</div>
                  <p className="text-lg text-gray-600 mb-2">
                    Click or drag & drop your Starbucks schedule
                  </p>
                  <p className="text-sm text-gray-500">
                    Supports JPG, PNG, WebP
                  </p>
                </label>
                {selectedImage && (
                  <div className="mt-4 text-green-600 font-semibold">
                    ✓ Image selected: {selectedImage.name}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Step 2: OCR */}
          {currentStep >= 2 && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Step 2: Extract Text from Image
              </h2>
              {isProcessing ? (
                <div className="text-center py-8">
                  <div className="animate-spin w-12 h-12 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4" />
                  <p className="text-gray-600">Processing your image...</p>
                </div>
              ) : (
                <div>
                  <div className="bg-black rounded-lg p-4 mb-4 max-h-48 overflow-y-auto">
                    <pre className="whitespace-pre-wrap text-sm">
                      {extractedText}
                    </pre>
                  </div>
                  <button
                    onClick={parseSchedule}
                    className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
                  >
                    Parse Schedule
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Review */}
          {currentStep >= 3 && shifts.length > 0 && (
            <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Step 3: Review Parsed Shifts
              </h2>
              <div className="space-y-4">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="border rounded-lg p-4 bg-gray-50"
                  >
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Date
                        </label>
                        <input
                          type="date"
                          value={shift.date}
                          onChange={(e) =>
                            updateShift(shift.id, { date: e.target.value })
                          }
                          className="mt-1 block w-full border border-gray-300 text-gray-900 rounded-md px-3 py-2"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Start Time
                        </label>
                        <input
                          type="time"
                          value={shift.startTime}
                          onChange={(e) =>
                            updateShift(shift.id, { startTime: e.target.value })
                          }
                          className="text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          End Time
                        </label>
                        <input
                          type="time"
                          value={shift.endTime}
                          onChange={(e) =>
                            updateShift(shift.id, { endTime: e.target.value })
                          }
                          className="text-gray-900"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700">
                          Position
                        </label>
                        <input
                          type="text"
                          value={shift.position}
                          onChange={(e) =>
                            updateShift(shift.id, { position: e.target.value })
                          }
                          className="text-gray-900"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Step 4: Calendar */}
          {currentStep >= 4 && (
            <div className="bg-white rounded-lg shadow-lg p-6">
              <h2 className="text-2xl font-bold text-gray-800 mb-4">
                Step 4: Calendar Integration
              </h2>

              {!session && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
                  <div className="flex items-start">
                    <AlertCircle className="w-5 h-5 text-blue-500 mt-0.5 mr-3" />
                    <div>
                      <p className="text-blue-800 font-medium">
                        Google Calendar Integration Required
                      </p>
                      <p className="text-blue-600 text-sm mt-1">
                        Connect your Google account to create events in your
                        calendar.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="space-y-2 mb-4">
                {shifts.map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center p-3 bg-green-50 rounded-lg"
                  >
                    <CheckCircle className="w-5 h-5 text-green-500 mr-3" />
                    <span className="text-green-800">
                      {session ? "Ready to create:" : "Would create:"}{" "}
                      {shift.location} shift on {shift.date} from{" "}
                      {shift.startTime} to {shift.endTime}
                    </span>
                  </div>
                ))}
              </div>

              <button
                onClick={addToCalendar}
                disabled={!session}
                className={`mt-2 px-6 py-3 rounded-lg transition-colors ${
                  session
                    ? "bg-green-600 hover:bg-green-700 text-white"
                    : "bg-gray-300 text-gray-600 cursor-not-allowed"
                }`}
                title={session ? "" : "Connect Google first"}
              >
                <Calendar className="inline w-5 h-5 mr-2" />
                Send Shifts to Google Calendar
              </button>
            </div>
          )}
        </div>
      </div>
    </RequireGoogle>
  );
}
