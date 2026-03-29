export interface DetectedObject {
  x: number;
  y: number;
  width: number;
  height: number;
  label: string;
  confidence: number;
  color: string;
}

const LABELS = [
  "Object A", "Object B", "Object C", "Region D", "Item E",
  "Surface", "Shape", "Cluster", "Edge", "Form"
];

const HIGHLIGHT_COLORS = [
  "hsla(145, 80%, 50%, 0.25)",
  "hsla(175, 70%, 50%, 0.25)",
  "hsla(200, 70%, 50%, 0.25)",
  "hsla(50, 80%, 50%, 0.25)",
  "hsla(280, 60%, 50%, 0.25)",
  "hsla(330, 60%, 50%, 0.25)",
];

const BORDER_COLORS = [
  "hsla(145, 80%, 50%, 0.7)",
  "hsla(175, 70%, 50%, 0.7)",
  "hsla(200, 70%, 50%, 0.7)",
  "hsla(50, 80%, 50%, 0.7)",
  "hsla(280, 60%, 50%, 0.7)",
  "hsla(330, 60%, 50%, 0.7)",
];

/**
 * Simple heuristic detection: divides canvas into a grid,
 * analyses contrast and color variance per block,
 * flags blocks with high variance as "detected objects".
 */
export function detectObjects(
  imageData: ImageData,
  canvasWidth: number,
  canvasHeight: number
): DetectedObject[] {
  const { data } = imageData;
  const gridCols = 8;
  const gridRows = 6;
  const cellW = Math.floor(canvasWidth / gridCols);
  const cellH = Math.floor(canvasHeight / gridRows);

  const results: DetectedObject[] = [];

  for (let gy = 0; gy < gridRows; gy++) {
    for (let gx = 0; gx < gridCols; gx++) {
      const x0 = gx * cellW;
      const y0 = gy * cellH;

      let sumR = 0, sumG = 0, sumB = 0;
      let sumR2 = 0, sumG2 = 0, sumB2 = 0;
      let count = 0;

      // Sample every 4th pixel for speed
      for (let py = y0; py < y0 + cellH; py += 4) {
        for (let px = x0; px < x0 + cellW; px += 4) {
          const idx = (py * canvasWidth + px) * 4;
          const r = data[idx], g = data[idx + 1], b = data[idx + 2];
          sumR += r; sumG += g; sumB += b;
          sumR2 += r * r; sumG2 += g * g; sumB2 += b * b;
          count++;
        }
      }

      if (count === 0) continue;

      const varR = sumR2 / count - (sumR / count) ** 2;
      const varG = sumG2 / count - (sumG / count) ** 2;
      const varB = sumB2 / count - (sumB / count) ** 2;
      const totalVar = Math.sqrt(varR + varG + varB);

      // Threshold: high variance = interesting region
      if (totalVar > 45) {
        const confidence = Math.min(totalVar / 120, 1);
        const colorIdx = (gx + gy) % HIGHLIGHT_COLORS.length;
        results.push({
          x: x0,
          y: y0,
          width: cellW,
          height: cellH,
          label: LABELS[(gx * gridRows + gy) % LABELS.length],
          confidence,
          color: HIGHLIGHT_COLORS[colorIdx],
        });
      }
    }
  }

  // Merge adjacent detections into larger regions
  return mergeDetections(results, cellW, cellH);
}

function mergeDetections(
  objs: DetectedObject[],
  cellW: number,
  cellH: number
): DetectedObject[] {
  if (objs.length === 0) return [];

  const used = new Set<number>();
  const merged: DetectedObject[] = [];

  for (let i = 0; i < objs.length; i++) {
    if (used.has(i)) continue;
    let { x, y, width, height, confidence } = objs[i];
    used.add(i);

    // Try to merge with adjacent
    for (let j = i + 1; j < objs.length; j++) {
      if (used.has(j)) continue;
      const o = objs[j];
      if (
        Math.abs(o.x - (x + width)) <= 2 && Math.abs(o.y - y) < cellH ||
        Math.abs(o.y - (y + height)) <= 2 && Math.abs(o.x - x) < cellW
      ) {
        const nx = Math.min(x, o.x);
        const ny = Math.min(y, o.y);
        width = Math.max(x + width, o.x + o.width) - nx;
        height = Math.max(y + height, o.y + o.height) - ny;
        x = nx;
        y = ny;
        confidence = Math.max(confidence, o.confidence);
        used.add(j);
      }
    }

    const colorIdx = merged.length % HIGHLIGHT_COLORS.length;
    merged.push({
      x, y, width, height,
      label: LABELS[merged.length % LABELS.length],
      confidence,
      color: HIGHLIGHT_COLORS[colorIdx],
    });
  }

  return merged;
}

export function drawDetections(
  ctx: CanvasRenderingContext2D,
  detections: DetectedObject[]
) {
  detections.forEach((det, i) => {
    const colorIdx = i % HIGHLIGHT_COLORS.length;
    // Fill
    ctx.fillStyle = det.color;
    ctx.fillRect(det.x, det.y, det.width, det.height);

    // Border
    ctx.strokeStyle = BORDER_COLORS[colorIdx];
    ctx.lineWidth = 2;
    ctx.strokeRect(det.x, det.y, det.width, det.height);

    // Corner brackets for HUD feel
    const bracketLen = Math.min(12, det.width / 3, det.height / 3);
    ctx.strokeStyle = BORDER_COLORS[colorIdx];
    ctx.lineWidth = 2;

    // Top-left
    ctx.beginPath();
    ctx.moveTo(det.x, det.y + bracketLen);
    ctx.lineTo(det.x, det.y);
    ctx.lineTo(det.x + bracketLen, det.y);
    ctx.stroke();

    // Top-right
    ctx.beginPath();
    ctx.moveTo(det.x + det.width - bracketLen, det.y);
    ctx.lineTo(det.x + det.width, det.y);
    ctx.lineTo(det.x + det.width, det.y + bracketLen);
    ctx.stroke();

    // Bottom-left
    ctx.beginPath();
    ctx.moveTo(det.x, det.y + det.height - bracketLen);
    ctx.lineTo(det.x, det.y + det.height);
    ctx.lineTo(det.x + bracketLen, det.y + det.height);
    ctx.stroke();

    // Bottom-right
    ctx.beginPath();
    ctx.moveTo(det.x + det.width - bracketLen, det.y + det.height);
    ctx.lineTo(det.x + det.width, det.y + det.height);
    ctx.lineTo(det.x + det.width, det.y + det.height - bracketLen);
    ctx.stroke();

    // Label
    const label = `${det.label} ${(det.confidence * 100).toFixed(0)}%`;
    ctx.font = "bold 11px 'JetBrains Mono', monospace";
    const textMetrics = ctx.measureText(label);
    const textH = 16;
    const textX = det.x;
    const textY = det.y - 4;

    ctx.fillStyle = "hsla(220, 20%, 7%, 0.8)";
    ctx.fillRect(textX, textY - textH, textMetrics.width + 8, textH + 2);

    ctx.fillStyle = BORDER_COLORS[colorIdx];
    ctx.fillText(label, textX + 4, textY - 3);
  });
}
