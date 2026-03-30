import { supabase } from "@/integrations/supabase/client";

export interface DetectedProduct {
  name: string;
  category: string;
  brand?: string;
  confidence: number;
  position: { x: number; y: number; width: number; height: number };
  color: string;
}

const PRODUCT_COLORS = [
  "hsla(145, 80%, 50%, 0.25)",
  "hsla(175, 70%, 50%, 0.25)",
  "hsla(200, 70%, 50%, 0.25)",
  "hsla(50, 80%, 50%, 0.25)",
  "hsla(280, 60%, 50%, 0.25)",
  "hsla(330, 60%, 50%, 0.25)",
];

const PRODUCT_BORDER_COLORS = [
  "hsla(145, 80%, 50%, 0.8)",
  "hsla(175, 70%, 50%, 0.8)",
  "hsla(200, 70%, 50%, 0.8)",
  "hsla(50, 80%, 50%, 0.8)",
  "hsla(280, 60%, 50%, 0.8)",
  "hsla(330, 60%, 50%, 0.8)",
];

export async function detectProducts(
  canvas: HTMLCanvasElement
): Promise<DetectedProduct[]> {
  // Convert canvas to base64 JPEG (smaller than PNG)
  const dataUrl = canvas.toDataURL("image/jpeg", 0.6);

  const { data, error } = await supabase.functions.invoke("detect-products", {
    body: { image: dataUrl },
  });

  if (error) {
    console.error("Detection API error:", error);
    return [];
  }

  if (!data?.products) return [];

  return data.products.map((p: any, i: number) => ({
    name: p.name,
    category: p.category,
    brand: p.brand || undefined,
    confidence: p.confidence,
    position: p.position,
    color: PRODUCT_COLORS[i % PRODUCT_COLORS.length],
  }));
}

export function drawProductDetections(
  ctx: CanvasRenderingContext2D,
  products: DetectedProduct[],
  canvasWidth: number,
  canvasHeight: number
) {
  products.forEach((product, i) => {
    const colorIdx = i % PRODUCT_COLORS.length;
    // Convert percentage positions to pixel positions
    const x = (product.position.x / 100) * canvasWidth;
    const y = (product.position.y / 100) * canvasHeight;
    const w = (product.position.width / 100) * canvasWidth;
    const h = (product.position.height / 100) * canvasHeight;

    // Fill
    ctx.fillStyle = product.color;
    ctx.fillRect(x, y, w, h);

    // Border
    ctx.strokeStyle = PRODUCT_BORDER_COLORS[colorIdx];
    ctx.lineWidth = 2;
    ctx.strokeRect(x, y, w, h);

    // Corner brackets
    const bracketLen = Math.min(14, w / 3, h / 3);
    ctx.strokeStyle = PRODUCT_BORDER_COLORS[colorIdx];
    ctx.lineWidth = 2.5;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(x, y + bracketLen);
    ctx.lineTo(x, y);
    ctx.lineTo(x + bracketLen, y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(x + w - bracketLen, y);
    ctx.lineTo(x + w, y);
    ctx.lineTo(x + w, y + bracketLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(x, y + h - bracketLen);
    ctx.lineTo(x, y + h);
    ctx.lineTo(x + bracketLen, y + h);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(x + w - bracketLen, y + h);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x + w, y + h - bracketLen);
    ctx.stroke();

    // Label background
    const label = product.brand
      ? `${product.brand} - ${product.name}`
      : product.name;
    const confLabel = `${(product.confidence * 100).toFixed(0)}%`;
    const fullLabel = `${label} ${confLabel}`;

    ctx.font = "bold 12px 'JetBrains Mono', monospace";
    const textMetrics = ctx.measureText(fullLabel);
    const textH = 18;
    const textX = x;
    const textY = y - 4;

    ctx.fillStyle = "hsla(220, 20%, 7%, 0.85)";
    ctx.fillRect(textX, textY - textH, textMetrics.width + 10, textH + 2);

    ctx.fillStyle = PRODUCT_BORDER_COLORS[colorIdx];
    ctx.fillText(fullLabel, textX + 5, textY - 4);

    // Category tag below the label
    ctx.font = "500 10px 'JetBrains Mono', monospace";
    const catMetrics = ctx.measureText(product.category);
    ctx.fillStyle = "hsla(220, 20%, 7%, 0.7)";
    ctx.fillRect(textX, textY + 1, catMetrics.width + 10, 14);
    ctx.fillStyle = "hsla(160, 60%, 70%, 0.9)";
    ctx.fillText(product.category, textX + 5, textY + 12);
  });
}
