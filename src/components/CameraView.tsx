import { useRef, useEffect, useCallback, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { detectObjects, drawDetections, type DetectedObject } from "@/lib/heuristicDetector";
import { Camera, CameraOff, RotateCcw, Eye, EyeOff } from "lucide-react";

const CameraView = () => {
  const { videoRef, status, errorMsg, start, stop, flipCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [detections, setDetections] = useState<DetectedObject[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [fps, setFps] = useState(0);
  const frameCountRef = useRef(0);
  const lastFpsTime = useRef(Date.now());

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    ctx.drawImage(video, 0, 0);

    // FPS counter
    frameCountRef.current++;
    const now = Date.now();
    if (now - lastFpsTime.current >= 1000) {
      setFps(frameCountRef.current);
      frameCountRef.current = 0;
      lastFpsTime.current = now;
    }

    // Run detection every 3rd frame for performance
    if (frameCountRef.current % 3 === 0) {
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const dets = detectObjects(imageData, canvas.width, canvas.height);
      setDetections(dets);
    }

    if (showOverlay && detections.length > 0) {
      drawDetections(ctx, detections);
    }

    // HUD scan line effect
    if (showOverlay) {
      const scanY = (now % 3000) / 3000 * canvas.height;
      ctx.strokeStyle = "hsla(145, 80%, 50%, 0.15)";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(canvas.width, scanY);
      ctx.stroke();
    }

    animRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, detections, showOverlay]);

  useEffect(() => {
    if (status === "active") {
      animRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [status, processFrame]);

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto gap-4 p-4">
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${status === "active" ? "bg-primary animate-pulse" : "bg-muted-foreground"}`} />
          <span className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
            {status === "active" ? "Live" : status === "requesting" ? "Connecting..." : "Offline"}
          </span>
        </div>
        {status === "active" && (
          <span className="font-mono text-xs text-muted-foreground">
            {fps} FPS · {detections.length} objects
          </span>
        )}
      </div>

      {/* Video / Canvas Area */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden hud-border neon-glow bg-card">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: status === "active" && showOverlay ? "none" : status === "active" ? "block" : "none" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: status === "active" && showOverlay ? "block" : "none" }}
        />

        {/* Scan line overlay */}
        {status === "active" && <div className="absolute inset-0 scan-line pointer-events-none" />}

        {/* Idle / Error states */}
        {status !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card">
            {(status === "denied" || status === "error") ? (
              <>
                <CameraOff className="w-12 h-12 text-destructive" />
                <p className="text-destructive font-mono text-sm text-center max-w-xs">{errorMsg}</p>
                <button
                  onClick={() => start()}
                  className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-mono text-sm hover:bg-muted transition"
                >
                  Retry
                </button>
              </>
            ) : (
              <>
                <Camera className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground font-mono text-sm">
                  {status === "requesting" ? "Requesting camera access..." : "Camera inactive"}
                </p>
              </>
            )}
          </div>
        )}

        {/* HUD corners */}
        {status === "active" && (
          <>
            <div className="absolute top-2 left-2 w-6 h-6 border-t-2 border-l-2 border-primary opacity-60" />
            <div className="absolute top-2 right-2 w-6 h-6 border-t-2 border-r-2 border-primary opacity-60" />
            <div className="absolute bottom-2 left-2 w-6 h-6 border-b-2 border-l-2 border-primary opacity-60" />
            <div className="absolute bottom-2 right-2 w-6 h-6 border-b-2 border-r-2 border-primary opacity-60" />
          </>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-3">
        {status !== "active" ? (
          <button
            onClick={() => start()}
            disabled={status === "requesting"}
            className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-semibold hover:opacity-90 transition disabled:opacity-50 neon-glow"
          >
            <Camera className="w-4 h-4" />
            Start Camera
          </button>
        ) : (
          <>
            <button
              onClick={stop}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-mono text-sm hover:opacity-90 transition"
            >
              <CameraOff className="w-4 h-4" />
              Stop
            </button>
            <button
              onClick={flipCamera}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-mono text-sm hover:opacity-90 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Flip
            </button>
            <button
              onClick={() => setShowOverlay((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-mono text-sm hover:opacity-90 transition"
            >
              {showOverlay ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              {showOverlay ? "Hide AI" : "Show AI"}
            </button>
          </>
        )}
      </div>

      {/* Detection List */}
      {status === "active" && detections.length > 0 && (
        <div className="w-full grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
          {detections.slice(0, 8).map((det, i) => (
            <div
              key={i}
              className="flex items-center gap-2 px-3 py-2 rounded-md bg-secondary hud-border"
            >
              <div
                className="w-3 h-3 rounded-sm"
                style={{ backgroundColor: det.color.replace("0.25", "0.7") }}
              />
              <span className="font-mono text-xs text-secondary-foreground truncate">
                {det.label}
              </span>
              <span className="font-mono text-xs text-muted-foreground ml-auto">
                {(det.confidence * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CameraView;
