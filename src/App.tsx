import React, { useRef, useEffect, useState } from "react";
import Webcam from "react-webcam";
import axios from "axios";
import { Box, Typography, Button, Dialog, DialogTitle, DialogContent, TextField, DialogActions } from "@mui/material";

const DEFAULT_PROMPT = "You are a multiple-choice answering assistant. Read the following question and options, and answer with only the correct option letter (e.g., A, B, C, or D).";
const DEFAULT_INTERVAL = 40; // seconds

function App() {
  const webcamRef = useRef<Webcam>(null);
  const [capturing, setCapturing] = useState(false);
  const [dotColor, setDotColor] = useState("red");
  const [answer, setAnswer] = useState<string>("");
  const [status, setStatus] = useState<string>("Idle");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Settings state
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [openAiKey, setOpenAiKey] = useState(localStorage.getItem("openaiKey") || "");
  const [ocrKey, setOcrKey] = useState(localStorage.getItem("ocrKey") || "");
  const [prompt, setPrompt] = useState(localStorage.getItem("customPrompt") || DEFAULT_PROMPT);
  const [interval, setIntervalState] = useState(Number(localStorage.getItem("interval") || DEFAULT_INTERVAL));

  // Camera constraints
  const videoConstraints = { facingMode: "environment", width: 640, height: 480 };

  useEffect(() => {
    if (capturing) {
      setDotColor("green");
      captureAndProcess();
      timerRef.current = setInterval(captureAndProcess, interval * 1000);
      return () => { if (timerRef.current) clearInterval(timerRef.current); };
    } else {
      setDotColor("red");
      if (timerRef.current) clearInterval(timerRef.current);
      setStatus("Idle");
    }
  // eslint-disable-next-line
  }, [capturing, interval, openAiKey, ocrKey, prompt]);

  const captureAndProcess = async () => {
    if (!openAiKey || !ocrKey) {
      setStatus("Enter API keys in settings");
      setCapturing(false);
      return;
    }
    setStatus("Capturing...");
    if (webcamRef.current) {
      const imageSrc = webcamRef.current.getScreenshot();
      if (imageSrc) {
        setStatus("Extracting text...");
        const text = await doOcr(imageSrc);
        if (!text) {
          setStatus("No text found.");
          setAnswer("");
          return;
        }
        setStatus("Getting answer...");
        const aiAnswer = await askOpenAI(text);
        setStatus("Complete");
        setAnswer(aiAnswer);
      } else {
        setStatus("Camera failed.");
      }
    }
  };

  // Send image (base64) to OCR.Space
  async function doOcr(imageBase64: string): Promise<string> {
    try {
      const formData = new FormData();
      formData.append("base64Image", imageBase64);
      formData.append("apikey", ocrKey);
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

  // Send OCR result to ChatGPT API with your prompt
  async function askOpenAI(question: string): Promise<string> {
    try {
      const res = await axios.post(
        "https://api.openai.com/v1/chat/completions",
        {
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: prompt },
            { role: "user", content: question }
          ],
          max_tokens: 5,
        },
        { headers: { Authorization: `Bearer ${openAiKey}` } }
      );
      return res.data.choices?.[0]?.message?.content?.trim() || "";
    } catch (e) {
      setStatus("OpenAI failed");
      return "API Error";
    }
  }

  // Settings dialog handlers
  const openSettings = () => setSettingsOpen(true);

  const saveSettings = () => {
    localStorage.setItem("openaiKey", openAiKey.trim());
    localStorage.setItem("ocrKey", ocrKey.trim());
    localStorage.setItem("customPrompt", prompt);
    localStorage.setItem("interval", interval.toString());
    setSettingsOpen(false);
  };

  return (
    <Box minHeight="100vh" display="flex" flexDirection="column" alignItems="center" justifyContent="center" bgcolor="#f6fbf9">
      {/* Invisible webcam */}
      <div style={{ position: "absolute", width: 1, height: 1, overflow: "hidden", pointerEvents: "none" }}>
        <Webcam
          ref={webcamRef}
          audio={false}
          screenshotFormat="image/png"
          videoConstraints={videoConstraints}
          width={1}
          height={1}
        />
      </div>
      {/* Settings button */}
      <Button
        sx={{ position: "absolute", top: 16, right: 16 }}
        variant="outlined"
        onClick={openSettings}
      >Settings</Button>

      {/* Status Dot */}
      <Box
        sx={{
          width: 22, height: 22, borderRadius: "50%", background: dotColor,
          border: "2px solid #eee", mb: 2, mt: -10
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

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onClose={() => setSettingsOpen(false)}>
        <DialogTitle>Settings</DialogTitle>
        <DialogContent sx={{ display: "flex", flexDirection: "column", gap: 2, mt: 1 }}>
          <TextField
            label="OpenAI API Key"
            value={openAiKey}
            onChange={e => setOpenAiKey(e.target.value)}
            type="password"
            autoComplete="off"
            fullWidth
          />
          <TextField
            label="OCR.Space API Key"
            value={ocrKey}
            onChange={e => setOcrKey(e.target.value)}
            type="password"
            autoComplete="off"
            fullWidth
          />
          <TextField
            label="Prompt"
            value={prompt}
            onChange={e => setPrompt(e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />
          <TextField
            label="Scan Interval (seconds)"
            value={interval}
            onChange={e => setIntervalState(Number(e.target.value))}
            type="number"
            fullWidth
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={saveSettings} variant="contained">Save</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

export default App;
