import type { Pledge } from "./types";

export interface ReceiptPdfData {
  receiptNumber: string;
  donorName: string;
  pledges: Pledge[];
}

export type ReceiptPdfAction = "download" | "print";

const pageWidth = 794;
const pageHeight = 1123;
const padding = 58;
const contentWidth = pageWidth - padding * 2;

const paymentMethodLabel = (method?: Pledge["paymentMethod"]) => {
  if (method === "paybox") return "PayBox";
  if (method === "bank") return "העברה בנקאית";
  return "מזומן";
};

const formatAmount = (amount: number) => `${new Intl.NumberFormat("he-IL").format(amount)} ₪`;

const receiptDate = (pledges: Pledge[]) => {
  const value = pledges[0]?.approvedAt || pledges[0]?.paidAt || pledges[0]?.date || new Date().toISOString();
  return new Intl.DateTimeFormat("he-IL").format(new Date(value));
};

const loadLogo = async () => {
  try {
    const response = await fetch("/logo-no-text.jpeg", { cache: "force-cache" });
    if (!response.ok) return null;
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    try {
      return await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image();
        image.onload = () => resolve(image);
        image.onerror = () => reject(new Error("logo"));
        image.src = url;
      });
    } finally {
      URL.revokeObjectURL(url);
    }
  } catch {
    return null;
  }
};

const makeCanvas = () => {
  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = pageWidth * scale;
  canvas.height = pageHeight * scale;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("לא ניתן להכין את אישור התשלום");
  context.scale(scale, scale);
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, pageWidth, pageHeight);
  return { canvas, context };
};

const setTextStyle = (context: CanvasRenderingContext2D, size: number, weight = 400, color = "#0f172a") => {
  context.font = `${weight} ${size}px "Noto Sans Hebrew", "Segoe UI", Arial, sans-serif`;
  context.fillStyle = color;
  context.textBaseline = "middle";
};

const drawRtl = (context: CanvasRenderingContext2D, text: string, x: number, y: number) => {
  context.direction = "rtl";
  context.textAlign = "right";
  context.fillText(text, x, y);
};

const drawLtr = (context: CanvasRenderingContext2D, text: string, x: number, y: number) => {
  context.direction = "ltr";
  context.textAlign = "left";
  context.fillText(text, x, y);
};

const drawRtlLeft = (context: CanvasRenderingContext2D, text: string, x: number, y: number) => {
  context.direction = "rtl";
  context.textAlign = "left";
  context.fillText(text, x, y);
};

const wrapRtl = (context: CanvasRenderingContext2D, text: string, maxWidth: number) => {
  const words = text.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];
  const lines: string[] = [];
  let line = "";
  words.forEach((word) => {
    const candidate = line ? `${line} ${word}` : word;
    if (line && context.measureText(candidate).width > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  });
  lines.push(line);
  return lines;
};

type ReceiptPage = { canvas: HTMLCanvasElement; context: CanvasRenderingContext2D; y: number };

// Canvas text uses the browser's native BiDi renderer. Unlike the former SVG
// foreignObject route it stays origin-clean, so jsPDF can export it reliably.
export async function downloadReceiptPdf({ receiptNumber, donorName, pledges }: ReceiptPdfData, action: ReceiptPdfAction = "download") {
  if (!receiptNumber || pledges.length === 0) throw new Error("אישור התשלום אינו זמין להורדה");

  // Open the browser window while the user click is still active. This keeps
  // popup blockers from preventing the subsequent PDF print action.
  const printWindow = action === "print" ? window.open("", "_blank", "width=900,height=900") : null;

  const [{ jsPDF }, logo] = await Promise.all([import("jspdf"), loadLogo(), document.fonts?.ready]);
  const pages: ReceiptPage[] = [];
  const newPage = () => {
    const { canvas, context } = makeCanvas();
    const page = { canvas, context, y: padding };
    pages.push(page);
    return page;
  };
  let page = newPage();
  const total = pledges.reduce((sum, pledge) => sum + pledge.amount, 0);

  const divider = (y: number) => {
    page.context.strokeStyle = "#dbe3ef";
    page.context.lineWidth = 1;
    page.context.beginPath();
    page.context.moveTo(padding, y);
    page.context.lineTo(pageWidth - padding, y);
    page.context.stroke();
  };

  const ensureSpace = (height: number) => {
    if (page.y + height <= pageHeight - padding) return;
    page = newPage();
    setTextStyle(page.context, 16, 700, "#475569");
    drawRtl(page.context, `אישור תשלום ${receiptNumber} — המשך`, pageWidth - padding, page.y + 14);
    page.y += 38;
    divider(page.y);
    page.y += 10;
  };

  if (logo) page.context.drawImage(logo, padding, padding, 72, 72);
  setTextStyle(page.context, 32, 700, "#1d4ed8");
  drawRtl(page.context, "אחוות מנחם", pageWidth - padding, padding + 24);
  setTextStyle(page.context, 17, 400, "#475569");
  drawRtl(page.context, "אישור תשלום / אישור תרומה", pageWidth - padding, padding + 54);
  page.y += 96;
  divider(page.y);
  page.y += 8;

  const drawInfoLine = (label: string, value: string, valueDirection: "rtl" | "ltr" = "rtl", emphasis = false) => {
    const height = emphasis ? 58 : 48;
    ensureSpace(height);
    const center = page.y + height / 2;
    setTextStyle(page.context, emphasis ? 21 : 16, emphasis ? 700 : 400, emphasis ? "#0f172a" : "#64748b");
    drawRtl(page.context, label, pageWidth - padding, center);
    setTextStyle(page.context, emphasis ? 21 : 17, emphasis ? 700 : 600, "#0f172a");
    if (valueDirection === "ltr") drawLtr(page.context, value, padding, center);
    else drawRtlLeft(page.context, value, padding, center);
    page.y += height;
    divider(page.y);
  };

  drawInfoLine("מספר אישור תשלום:", receiptNumber, "ltr");
  drawInfoLine("שם התורם:", donorName);
  drawInfoLine("תאריך:", receiptDate(pledges), "ltr");
  drawInfoLine("אמצעי תשלום:", paymentMethodLabel(pledges[0].paymentMethod), pledges[0].paymentMethod === "paybox" ? "ltr" : "rtl");

  ensureSpace(48);
  page.y += 22;
  setTextStyle(page.context, 17, 700, "#475569");
  drawRtl(page.context, "התחייבויות ששולמו:", pageWidth - padding, page.y);
  page.y += 23;
  divider(page.y);

  pledges.forEach((pledge) => {
    setTextStyle(page.context, 16, 600);
    const lines = wrapRtl(page.context, pledge.type, contentWidth - 190);
    const height = Math.max(40, lines.length * 23 + 16);
    ensureSpace(height);
    const firstLineY = page.y + (height - (lines.length - 1) * 23) / 2;
    lines.forEach((line, index) => drawRtl(page.context, line, pageWidth - padding, firstLineY + index * 23));
    setTextStyle(page.context, 16, 600);
    drawLtr(page.context, formatAmount(pledge.amount), padding, page.y + height / 2);
    page.y += height;
    divider(page.y);
  });

  drawInfoLine("סכום ששולם:", formatAmount(total), "ltr", true);
  ensureSpace(100);
  page.y += 28;
  page.context.setLineDash([5, 4]);
  divider(page.y);
  page.context.setLineDash([]);
  page.y += 26;
  setTextStyle(page.context, 17, 700, "#334155");
  drawRtl(page.context, "תודה רבה על תרומתך!", pageWidth - padding, page.y);
  page.y += 27;
  setTextStyle(page.context, 15, 400, "#64748b");
  drawRtl(page.context, "אישור זה מהווה אישור על התשלום שבוצע.", pageWidth - padding, page.y);

  const pdf = new jsPDF({ orientation: "portrait", unit: "pt", format: "a4", compress: true });
  const pdfWidth = pdf.internal.pageSize.getWidth();
  const pdfHeight = pdf.internal.pageSize.getHeight();
  const margin = 34;
  const imageWidth = pdfWidth - margin * 2;
  const imageHeight = pdfHeight - margin * 2;
  pages.forEach((receiptPage, index) => {
    if (index > 0) pdf.addPage();
    pdf.addImage(receiptPage.canvas.toDataURL("image/jpeg", 0.98), "JPEG", margin, margin, imageWidth, imageHeight, undefined, "FAST");
  });
  pdf.setProperties({ title: `אישור תשלום ${receiptNumber}`, subject: "אישור תשלום אחוות מנחם" });
  if (action === "print") {
    pdf.autoPrint();
    const pdfUrl = pdf.output("bloburl");
    if (printWindow) {
      printWindow.location.replace(pdfUrl);
      return;
    }
    window.open(pdfUrl, "_blank");
    return;
  }
  pdf.save(`אישור תשלום-${receiptNumber}.pdf`);
}
