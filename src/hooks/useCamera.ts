import { useRef, useState, useCallback, useEffect } from "react";

export type CameraStatus = "idle" | "requesting" | "active" | "denied" | "error";

export function useCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const [facingMode, setFacingMode] = useState<"user" | "environment">("environment");

  const start = useCallback(async (facing?: "user" | "environment") => {
    const mode = facing ?? facingMode;
    setStatus("requesting");
    setErrorMsg("");
    try {
      // Stop any existing stream
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: mode, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false,
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setFacingMode(mode);
      setStatus("active");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setStatus("denied");
        setErrorMsg("Camera access was denied. Please allow camera permissions.");
      } else {
        setStatus("error");
        setErrorMsg(err.message || "Could not access camera");
      }
    }
  }, [facingMode]);

  const stop = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setStatus("idle");
  }, []);

  const flipCamera = useCallback(() => {
    const next = facingMode === "user" ? "environment" : "user";
    start(next);
  }, [facingMode, start]);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  return { videoRef, status, errorMsg, start, stop, flipCamera, facingMode };
}
