import { useRef, useEffect, useCallback, useState } from "react";
import { useCamera } from "@/hooks/useCamera";
import { detectProducts, drawProductDetections, type DetectedProduct } from "@/lib/productDetector";
import { Camera, CameraOff, RotateCcw, Loader2, Search, CloudUpload } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const SCAN_INTERVAL_MS = 3000;
const IDENTIFYING_DURATION_MS = 4000;

const CameraView = () => {
  const { videoRef, status, errorMsg, start, stop, flipCamera } = useCamera();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const [products, setProducts] = useState<DetectedProduct[]>([]);
  const [scanState, setScanState] = useState<"idle" | "scanning" | "identifying">("idle");
  const [accepted, setAccepted] = useState(false);
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

    if (products.length > 0) {
      drawProductDetections(ctx, products, canvas.width, canvas.height);
    }

    const now = Date.now();
    if (now - lastScanRef.current >= SCAN_INTERVAL_MS) {
      lastScanRef.current = now;
      captureAndDetect();
    }

    animRef.current = requestAnimationFrame(processFrame);
  }, [videoRef, products, captureAndDetect]);

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

  // Cloud warning screen
  if (!accepted) {
    return (
      <div className="flex flex-col items-center justify-center w-full max-w-md mx-auto gap-6 p-6 text-center">
        <CloudUpload className="w-12 h-12 text-accent" />
        <h2 className="font-mono text-base font-bold text-foreground">
          Bulut Tabanlı Görüntü Analizi
        </h2>
        <p className="font-mono text-sm text-muted-foreground leading-relaxed">
          Bu uygulama, ürünleri tanımlamak için kamera görüntülerini geçici olarak buluta yükler. 
          Görüntüler yalnızca analiz amacıyla kullanılır ve <span className="text-accent">işlem sonrası otomatik olarak silinir.</span>
        </p>
        <button
          onClick={() => setAccepted(true)}
          className="flex items-center gap-2 px-6 py-3 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-semibold hover:opacity-90 transition"
        >
          <Camera className="w-4 h-4" />
          Anladım, Devam Et
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center w-full max-w-2xl mx-auto gap-3 p-4">
      {/* Video / Canvas Area */}
      <div className="relative w-full aspect-video rounded-lg overflow-hidden border border-border bg-card">
        <video
          ref={videoRef}
          playsInline
          muted
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: status === "active" ? "none" : "none" }}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ display: status === "active" ? "block" : "none" }}
        />

        {/* Idle / Error states */}
        {status !== "active" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-card">
            {status === "denied" || status === "error" ? (
              <>
                <CameraOff className="w-10 h-10 text-destructive" />
                <p className="text-destructive font-mono text-xs text-center max-w-xs">
                  {errorMsg}
                </p>
                <button
                  onClick={() => start()}
                  className="px-4 py-2 rounded-md bg-secondary text-secondary-foreground font-mono text-xs hover:bg-muted transition"
                >
                  Tekrar Dene
                </button>
              </>
            ) : (
              <>
                <Camera className="w-10 h-10 text-muted-foreground" />
                <p className="text-muted-foreground font-mono text-xs">
                  {status === "requesting" ? "Kamera erişimi isteniyor..." : "Kamera kapalı"}
                </p>
              </>
            )}
          </div>
        )}

        {/* Scanning/Identifying indicator */}
        {status === "active" && scanLabel && (
          <div className={`absolute top-2 right-2 flex items-center gap-1.5 px-2 py-1 rounded backdrop-blur-sm ${
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

        {/* Product count */}
        {status === "active" && products.length > 0 && (
          <div className="absolute bottom-2 left-2 px-2 py-1 rounded backdrop-blur-sm bg-card/70">
            <span className="font-mono text-[10px] text-muted-foreground">
              {products.length} ürün algılandı
            </span>
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex items-center gap-2">
        {status !== "active" ? (
          <button
            onClick={() => start()}
            disabled={status === "requesting"}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-primary text-primary-foreground font-mono text-sm font-semibold hover:opacity-90 transition disabled:opacity-50"
          >
            <Camera className="w-4 h-4" />
            Kamerayı Başlat
          </button>
        ) : (
          <>
            <button
              onClick={stop}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive text-destructive-foreground font-mono text-xs hover:opacity-90 transition"
            >
              <CameraOff className="w-3.5 h-3.5" />
              Durdur
            </button>
            <button
              onClick={flipCamera}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary text-secondary-foreground font-mono text-xs hover:opacity-90 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Çevir
            </button>
          </>
        )}
      </div>

      {/* Product List */}
      {status === "active" && products.length > 0 && (
        <div className="w-full space-y-1.5">
          {products.map((product, i) => (
            <div
              key={i}
              className={`flex items-center gap-2 px-3 py-2 rounded-md bg-secondary transition-all duration-300 ${
                scanState === "identifying" ? "ring-1 ring-primary/40" : ""
              }`}
            >
              <div
                className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                style={{ backgroundColor: product.color.replace("0.25", "0.7") }}
              />
              <span className="font-mono text-xs text-secondary-foreground truncate font-semibold">
                {product.name}
              </span>
              {product.brand && (
                <span className="font-mono text-[10px] text-accent">{product.brand}</span>
              )}
              <span className="font-mono text-[10px] text-muted-foreground ml-auto">
                {(product.confidence * 100).toFixed(0)}%
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default CameraView;
