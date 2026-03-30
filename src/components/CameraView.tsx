import { useRef, useEffect, useCallback, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { detectProducts, drawProductDetections, type DetectedProduct } from "@/lib/productDetector";
import { Camera, CameraOff, RotateCcw, Eye, EyeOff, Loader2, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SCAN_INTERVAL_MS = 3000;
const IDENTIFYING_DURATION_MS = 4000; // Show "Tanımlanıyor" for 4s after detection

const CameraView = () => {
  const { videoRef, status, errorMsg, start, stop, flipCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [products, setProducts] = useState<DetectedProduct[]>([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "identifying">("idle");
  const lastScanRef = useRef(0);
  const scanningRef = useRef(false);
  const identifyTimeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const { toast } = useToast();

  const captureAndDetect = useCallback(async () => {
    const video = videoRef.current;
    if (!video || video.readyState < 2 || scanningRef.current) return;

    scanningRef.current = true;
    setScanState("scanning");

    const tempCanvas = document.createElement("canvas");
    tempCanvas.width = video.videoWidth;
    tempCanvas.height = video.videoHeight;
    const tempCtx = tempCanvas.getContext("2d");
    if (!tempCtx) {
      scanningRef.current = false;
      setScanState("idle");
      return;
    }
    tempCtx.drawImage(video, 0, 0);

    try {
      const detected = await detectProducts(tempCanvas);
      setProducts(detected);

      if (detected.length > 0) {
        // Switch to "identifying" state and keep it visible
        setScanState("identifying");
        if (identifyTimeoutRef.current) clearTimeout(identifyTimeoutRef.current);
        identifyTimeoutRef.current = setTimeout(() => {
          setScanState("idle");
        }, IDENTIFYING_DURATION_MS);
      } else {
        setScanState("idle");
      }
    } catch (err: any) {
      console.error("Detection failed:", err);
      toast({
        title: "Algılama hatası",
        description: err.message || "Ürün algılama başarısız oldu",
        variant: "destructive",
      });
      setScanState("idle");
    } finally {
      scanningRef.current = false;
    }
  }, [videoRef, toast]);

  const processFrame = useCallback(() => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) {
      animRef.current = requestAnimationFrame(processFrame);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    if (showOverlay && products.length > 0) {
      drawProductDetections(ctx, products, canvas.width, canvas.height);
    }

    // Scan line effect
    if (showOverlay) {
      const now = Date.now();
      const scanY = ((now % 3000) / 3000) * canvas.height;
      const isActive = scanState !== "idle";
      ctx.strokeStyle = isActive
        ? "hsla(50, 80%, 50%, 0.3)"
        : "hsla(145, 80%, 50%, 0.15)";
      ctx.lineWidth = isActive ? 2 : 1;
      ctx.beginPath();
      ctx.moveTo(0, scanY);
      ctx.lineTo(canvas.width, scanY);
      ctx.stroke();
    }

    // Trigger API detection periodically
    const now = Date.now();
    if (now - lastScanRef.current >= SCAN_INTERVAL_MS) {
      lastScanRef.current = now;
      captureAndDetect();
    }

    animRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, products, showOverlay, scanState, captureAndDetect]);

  useEffect(() => {
    if (status === "active") {
      lastScanRef.current = Date.now() - SCAN_INTERVAL_MS + 500;
      animRef.current = requestAnimationFrame(processFrame);
    }
    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [status, processFrame]);

  useEffect(() => {
    return () => {
      if (identifyTimeoutRef.current) clearTimeout(identifyTimeoutRef.current);
    };
  }, []);

  const scanLabel = scanState === "scanning" ? "Taranıyor..." : scanState === "identifying" ? "Tanımlanıyor..." : null;

  return (
    <div className="flex flex-col items-center w-full max-w-4xl mx-auto gap-4 p-4">
      {/* Header */}
      <div className="w-full flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className={`w-2 h-2 rounded-full ${
              status === "active"
                ? "bg-primary animate-pulse"
                : "bg-muted-foreground"
            }`}
          />
          <span className="font-mono text-sm text-muted-foreground uppercase tracking-widest">
            {status === "active"
              ? "Canlı"
              : status === "requesting"
              ? "Bağlanıyor..."
              : "Çevrimdışı"}
          </span>
        </div>
        {status === "active" && (
          <div className="flex items-center gap-2">
            {scanState !== "idle" && (
              <Loader2 className="w-3 h-3 text-accent animate-spin" />
            )}
            <span className="font-mono text-xs text-muted-foreground">
              {products.length} ürün algılandı
            </span>
          </div>
        )}
      </div>

      {/* Video / Canvas Area */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden hud-border neon-glow bg-card">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            display:
              status === "active" && showOverlay
                ? "none"
                : status === "active"
                ? "block"
                : "none",
          }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{
            display: status === "active" && showOverlay ? "block" : "none",
          }}
        />

        {status === "active" && (
          <div className="absolute inset-0 scan-line pointer-events-none" />
        )}

        {/* Idle / Error states */}
        {status !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card">
            {status === "denied" || status === "error" ? (
              <>
                <CameraOff className="w-12 h-12 text-destructive" />
                <p className="text-destructive font-mono text-sm text-center max-w-xs">
                  {errorMsg}
                </p>
                <button
                  onClick={() => start()}
                  className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-mono text-sm hover:bg-muted transition"
                >
                  Tekrar Dene
                </button>
              </>
            ) : (
              <>
                <Camera className="w-12 h-12 text-muted-foreground" />
                <p className="text-muted-foreground font-mono text-sm">
                  {status === "requesting"
                    ? "Kamera erişimi isteniyor..."
                    : "Kamera kapalı"}
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

        {/* Scanning/Identifying indicator */}
        {status === "active" && scanLabel && (
          <div className={`absolute top-3 right-3 flex items-center gap-1.5 px-2 py-1 rounded backdrop-blur-sm ${
            scanState === "identifying" ? "bg-primary/20" : "bg-accent/20"
          }`}>
            {scanState === "scanning" ? (
              <Loader2 className="w-3 h-3 text-accent animate-spin" />
            ) : (
              <Search className="w-3 h-3 text-primary animate-pulse" />
            )}
            <span className={`font-mono text-[10px] ${
              scanState === "identifying" ? "text-primary" : "text-accent"
            }`}>
              {scanLabel}
            </span>
          </div>
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
            Kamerayı Başlat
          </button>
        ) : (
          <>
            <button
              onClick={stop}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground font-mono text-sm hover:opacity-90 transition"
            >
              <CameraOff className="w-4 h-4" />
              Durdur
            </button>
            <button
              onClick={flipCamera}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-mono text-sm hover:opacity-90 transition"
            >
              <RotateCcw className="w-4 h-4" />
              Çevir
            </button>
            <button
              onClick={() => setShowOverlay((v) => !v)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-secondary text-secondary-foreground font-mono text-sm hover:opacity-90 transition"
            >
              {showOverlay ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              {showOverlay ? "AI Gizle" : "AI Göster"}
            </button>
            <button
              onClick={captureAndDetect}
              disabled={scanState === "scanning"}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-accent-foreground font-mono text-sm hover:opacity-90 transition disabled:opacity-50"
            >
              {scanState === "scanning" ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
              Tara
            </button>
          </>
        )}
      </div>

      {/* Product List */}
      {status === "active" && products.length > 0 && (
        <div className="w-full grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2">
          {products.map((product, i) => (
            <div
              key={i}
              className={`flex flex-col gap-1 px-3 py-2 rounded-md bg-secondary hud-border transition-all duration-500 ${
                scanState === "identifying" ? "ring-1 ring-primary/50 shadow-[0_0_8px_hsl(var(--primary)/0.3)]" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-sm flex-shrink-0"
                  style={{
                    backgroundColor: product.color.replace("0.25", "0.7"),
                  }}
                />
                <span className="font-mono text-xs text-secondary-foreground truncate font-semibold">
                  {product.name}
                </span>
                <span className="font-mono text-xs text-muted-foreground ml-auto">
                  {(product.confidence * 100).toFixed(0)}%
                </span>
              </div>
              <div className="flex items-center gap-2 pl-5">
                {product.brand && (
                  <span className="font-mono text-[10px] text-accent">
                    {product.brand}
                  </span>
                )}
                <span className="font-mono text-[10px] text-muted-foreground">
                  {product.category}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CameraView;
