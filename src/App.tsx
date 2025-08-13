import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { Box, Typography } from "@mui/material";

// --- NO KEYS IN CODE! ---
// const OCR_API_KEY = "..."; // remove from code, prompt for it!
const CAPTURE_INTERVAL = 40 * 1000;
const PROMPT =
  "You are a multiple-choice answering assistant. Read the following question and options, and answer with only the correct option letter (e.g., A, B, C, or D).";

function App() {
  const webcamRef = useRef<Webcam>(null);
  const [capturing, setCapturing] = useState(false);
  const [dotColor, setDotColor] = useState("red");
  const [answer, setAnswer] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");
  const [ocrKey, setOcrKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const videoConstraints = { facingMode: "environment", width: 640, height: 480 };

  useEffect(() => {
    if (capturing) {
      setDotColor("green");
      captureAndProcess();
      timerRef.current = setInterval(captureAndProcess, CAPTURE_INTERVAL);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setDotColor("red");
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus("Idle");
    }
    // eslint-disable-next-line
  }, [capturing]);

  const captureAndProcess = async () => {
    setStatus("Capturing...");
    let imageSrc: string | null = null;
    try {
      imageSrc = webcamRef.current?.getScreenshot() || null;
      if (!imageSrc) {
        setStatus("Camera not ready or failed to capture image.");
        setAnswer("");
        return;
      }
      setStatus("Extracting text...");
      const text = await doOcr(imageSrc);
      if (!text.trim()) {
        setStatus("No text found.");
        setAnswer("");
        return;
      }
      setStatus("Getting answer...");
      const aiAnswer = await askOpenAI(text);
      setStatus("Complete");
      setAnswer(aiAnswer);
    } catch (err) {
      setStatus("Error: " + (err as Error).message);
      setAnswer("");
    }
  };

  // Send image (base64) to OCR.Space
  async function doOcr(imageBase64: string): Promise<string> {
    if (!ocrKey) {
      setStatus("OCR key not set.");
      return "";
    }
    try {
      const formData = new FormData();
      formData.append("base64Image", imageBase64); // Full data URL
      formData.append("apikey", ocrKey);
      formData.append("language", "eng");
      formData.append("isTable", "false");

      const response = await axios.post("https://api.ocr.space/parse/image", formData);
      // DEBUG: Log the OCR API raw response if you want:
      // console.log("OCR API response", response.data);
      const parsedText = response.data?.ParsedResults?.[0]?.ParsedText;
      return parsedText || "";
    } catch (e) {
      setStatus("OCR failed: " + (e as Error).message);
      return "";
    }
  }

  // Send OCR result to ChatGPT API with your prompt
  async function askOpenAI(question: string): Promise<string> {
    if (!openaiKey) {
      setStatus("OpenAI key not set.");
      return "";
    }
    try {
      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: PROMPT },
            { role: "user", content: question }
          ],
          max_tokens: 5,
        },
        { headers: { Authorization: `Bearer ${openaiKey}` } }
      );
      return res.data.choices?.[0]?.message?.content?.trim() || "";
    } catch (e) {
      setStatus("OpenAI failed: " + (e as Error).message);
      return "API Error";
    }
  }

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column" alignItems="center" justifyContent="center" bgcolor="#f6fbf9">
      <div style={{ position: "relative", width: 320, height: 240, marginBottom: 8 }}>
        {/* Webcam Preview */}
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/png"
          videoConstraints={videoConstraints}
          width={320}
          height={240}
          style={{ borderRadius: 8, border: "2px solid #ccc" }}
        />
        {/* Status Dot */}
        <Box
          sx={{
            position: "absolute",
            top: 10, right: 10,
            width: 22, height: 22, borderRadius: "50%", background: dotColor,
            border: "2px solid #eee", zIndex: 5
          }}
        />
      </div>

      {/* Controls */}
      <Box mb={2}>
        <button
          style={{ background: "#43a047", color: "white", padding: "8px 18px", border: 0, borderRadius: 8, fontSize: 16, marginRight: 10, cursor: "pointer" }}
          onClick={() => setCapturing(true)}
          disabled={capturing}
        >Start</button>
        <button
          style={{ background: "#e53935", color: "white", padding: "8px 18px", border: 0, borderRadius: 8, fontSize: 16, cursor: "pointer" }}
          onClick={() => setCapturing(false)}
          disabled={!capturing}
        >Stop</button>
        <button
          style={{ marginLeft: 16, background: "#1565c0", color: "white", padding: "8px 12px", border: 0, borderRadius: 8, fontSize: 16 }}
          onClick={() => setShowSettings(v => !v)}
        >Settings</button>
      </Box>

      {/* Settings */}
      {showSettings && (
        <Box mb={2} p={2} bgcolor="#fff" borderRadius={2} boxShadow={2} width={320}>
          <Typography variant="subtitle2" mb={1}>API Keys & Config</Typography>
          <input
            type="text"
            placeholder="OCR.Space API Key"
            value={ocrKey}
            onChange={e => setOcrKey(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <input
            type="text"
            placeholder="OpenAI API Key"
            value={openaiKey}
            onChange={e => setOpenaiKey(e.target.value)}
            style={{ width: "100%", marginBottom: 8 }}
          />
          <button
            style={{ width: "100%", background: "#43a047", color: "#fff", border: 0, borderRadius: 8, padding: 8, marginTop: 8 }}
            onClick={() => setShowSettings(false)}
          >Save & Close</button>
        </Box>
      )}

      {/* Status and Answer */}
      <Typography variant="body1" sx={{ mb: 1 }}>{status}</Typography>
      <Typography variant="h5" color="primary">{answer}</Typography>
    </Box>
  );
}

export default App;
