import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { Box, Typography } from "@mui/material";

const OCR_API_KEY = ""; // input this in your settings modal, not here!
const CAPTURE_INTERVAL = 40 * 1000;

const PROMPT = "You are a multiple-choice answering assistant. Read the following question and options, and answer with only the correct option letter (e.g., A, B, C, or D).";

function App() {
  const webcamRef = useRef<Webcam>(null);
  const [capturing, setCapturing] = useState(false);
  const [dotColor, setDotColor] = useState("red");
  const [answer, setAnswer] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");
  const [borderColor, setBorderColor] = useState("rgba(0,0,0,0.15)");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Show preview only when capturing
  const previewSize = capturing ? { width: 120, height: 90 } : { width: 0, height: 0 };

  useEffect(() => {
    if (capturing) {
      setDotColor("green");
      setStatus("Starting...");
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
    setStatus("Capturing image...");
    flashPreview();
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setStatus("Extracting text...");
        const text = await doOcr(imageSrc);
        if (!text.trim()) {
          setStatus("No text found.");
          setAnswer("");
          return;
        }
        setStatus("Getting answer...");
        const aiAnswer = await askOpenAI(text);
        setStatus("Done");
        setAnswer(aiAnswer);
      } else {
        setStatus("Camera failed.");
      }
    }
  };

  // Highlight border when snapshot taken
  const flashPreview = () => {
    setBorderColor("yellow");
    setTimeout(() => setBorderColor("rgba(0,0,0,0.15)"), 400);
  };

  async function doOcr(imageBase64: string): Promise<string> {
    // (Same as before, uses OCR.Space)
    try {
      const formData = new FormData();
      formData.append("base64Image", imageBase64);
      formData.append("apikey", OCR_API_KEY);
      formData.append("language", "eng");
      formData.append("isTable", "false");
      const response = await axios.post("https://api.ocr.space/parse/image", formData);
      const parsedText = response.data?.ParsedResults?.[0]?.ParsedText;
      return parsedText || "";
    } catch (e) {
      setStatus("OCR failed");
      return "";
    }
  }

  async function askOpenAI(question: string): Promise<string> {
    // (You should pass OpenAI API key via settings/input, not hardcoded!)
    try {
      const OPENAI_API_KEY = ""; // <- Get from user input/settings modal
      if (!OPENAI_API_KEY) return "No API key!";
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
        { headers: { Authorization: `Bearer ${OPENAI_API_KEY}` } }
      );
      return res.data.choices?.[0]?.message?.content?.trim() || "";
    } catch (e) {
      setStatus("OpenAI failed");
      return "API Error";
    }
  }

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column" alignItems="center" justifyContent="center" bgcolor="#f6fbf9">
      {/* Webcam Preview */}
      <Box
        sx={{
          border: `2px solid ${borderColor}`,
          borderRadius: 3,
          overflow: "hidden",
          mb: 2,
          width: previewSize.width,
          height: previewSize.height,
          transition: "border 0.2s"
        }}
      >
        {capturing && (
          <Webcam
            ref={webcamRef}
            audio={false}
            screenshotFormat="image/png"
            videoConstraints={{ facingMode: "environment", width: 640, height: 480 }}
            width={120}
            height={90}
            style={{ background: "#222" }}
          />
        )}
      </Box>
      {/* Status Dot */}
      <Box
        sx={{
          width: 22, height: 22, borderRadius: "50%", background: dotColor,
          border: "2px solid #eee", mb: 2
        }}
      />
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
      </Box>
      {/* Status and Answer */}
      <Typography variant="body1" sx={{ mb: 1 }}>{status}</Typography>
      <Typography variant="h5" color="primary">{answer}</Typography>
    </Box>
  );
}

export default App;
