import jsPDF from "jspdf";
import type { Joint, RotationAxis } from "../types/robot";
import { computeDHMatrix, getEffectiveDHParams } from "../../math/dhTransform";
import { multiplyMatrices, rotationAroundAxis } from "../../math/matrixOps";
import {
  computeStandardDHTable,
  type StandardDHRow,
} from "../../math/dhStandardParams";
import type { Matrix4x4 } from "../types/matrix";

export interface DHReportOptions {
  elements: Joint[];
  revoluteAroundZOnly: boolean;
  revoluteFrameAxis: RotationAxis;
  useCommonNormalConvention: boolean;
}

const RAD_TO_DEG = 180 / Math.PI;

function formatNumber(value: number, digits: number = 4): string {
  const normalized = Math.abs(value) < 1e-10 ? 0 : value;
  return normalized.toFixed(digits);
}

function formatPiAngle(value: number): string {
  const normalized = Math.abs(value) < 1e-10 ? 0 : value;
  if (normalized === 0) return "0";
  const ratio = normalized / Math.PI;
  const targets: Array<{ ratio: number; label: string }> = [
    { ratio: 1, label: "pi" },
    { ratio: -1, label: "-pi" },
    { ratio: 0.5, label: "pi/2" },
    { ratio: -0.5, label: "-pi/2" },
    { ratio: 0.25, label: "pi/4" },
    { ratio: -0.25, label: "-pi/4" },
  ];
  const found = targets.find((target) => Math.abs(ratio - target.ratio) < 1e-4);
  if (found) return found.label;
  return formatNumber(normalized);
}

function formatSigned(value: number, digits: number = 5): string {
  const normalized = Math.abs(value) < 1e-10 ? 0 : value;
  const sign = normalized >= 0 ? "+" : "";
  return `${sign}${normalized.toFixed(digits)}`;
}

function computeElementMatrix(element: Joint) {
  const effectiveParams = getEffectiveDHParams(element);
  const baseMatrix = computeDHMatrix(effectiveParams, element.rotationAxis);
  if (Math.abs(element.frameAngle) <= 1e-10) {
    return baseMatrix;
  }
  return multiplyMatrices(
    baseMatrix,
    rotationAroundAxis(element.rotationAxis, element.frameAngle),
  );
}

function addFooter(
  doc: jsPDF,
  pageIndex: number,
  pageCount: number,
  marginLeft: number,
  pageHeight: number,
): void {
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.setTextColor(120, 130, 150);
  doc.text(`Page ${pageIndex} / ${pageCount}`, marginLeft, pageHeight - 18);
}

// ---- Mathematical expression rendering ----
// Renders strings containing "theta", "alpha", "pi", subscripts ("_N"),
// and length labels ("L1") with proper Symbol-font Greek letters and
// subscript positioning.

interface MathToken {
  text: string;
  symbol: boolean; // true = render in PDF Symbol font
  italic: boolean; // italic style (base font only, Symbol ignores this)
  sub: boolean;    // subscript (smaller + shifted down)
}

const SUB_SCALE = 0.68;
const SUB_SHIFT = 0.22; // fraction of baseSize

function symTok(char: string, sub = false): MathToken {
  return { text: char, symbol: true, italic: false, sub };
}

function txtTok(text: string, italic = false, sub = false): MathToken {
  return { text, symbol: false, italic, sub };
}

function tokenizeMath(expr: string): MathToken[] {
  const tokens: MathToken[] = [];
  let pos = 0;

  while (pos < expr.length) {
    // Greek: theta
    if (expr.startsWith("theta", pos)) {
      tokens.push(symTok("q"));
      pos += 5;
      continue;
    }
    // Greek: alpha
    if (expr.startsWith("alpha", pos)) {
      tokens.push(symTok("a"));
      pos += 5;
      continue;
    }
    // Greek: pi (not followed by a letter, to avoid matching "pixel" etc.)
    if (expr.startsWith("pi", pos)) {
      const next = expr[pos + 2];
      if (!next || !/[a-zA-Z]/.test(next)) {
        tokens.push(symTok("p"));
        pos += 2;
        continue;
      }
    }
    // Subscript containing Greek: _theta
    if (expr.startsWith("_theta", pos)) {
      tokens.push(symTok("q", true));
      pos += 6;
      continue;
    }
    // Subscript: _<digits> or _<single letter>
    if (expr[pos] === "_") {
      const m = expr.slice(pos).match(/^_(\d+|[a-z])/);
      if (m) {
        const isLetter = /^[a-z]$/.test(m[1]!);
        tokens.push(txtTok(m[1]!, isLetter, true));
        pos += m[0].length;
        continue;
      }
    }
    // Length label: L<digits>
    if (expr[pos] === "L" && pos + 1 < expr.length && /\d/.test(expr[pos + 1]!)) {
      tokens.push(txtTok("L", true));
      const dm = expr.slice(pos + 1).match(/^\d+/);
      if (dm) {
        tokens.push(txtTok(dm[0], false, true));
        pos += 1 + dm[0].length;
      } else {
        pos += 1;
      }
      continue;
    }
    // Variable letters before subscript: d_, r_, a_, A_, q_
    if (
      pos + 1 < expr.length &&
      expr[pos + 1] === "_" &&
      /^[draAq]$/.test(expr[pos]!)
    ) {
      tokens.push(txtTok(expr[pos]!, true));
      pos += 1;
      continue;
    }
    // Regular character
    tokens.push(txtTok(expr[pos]!));
    pos += 1;
  }

  return tokens;
}

function measureMathTokens(
  doc: jsPDF,
  tokens: MathToken[],
  baseSize: number,
  baseFont: string,
  baseStyle: string,
): number {
  let w = 0;
  for (const t of tokens) {
    if (t.symbol) {
      doc.setFont("symbol", "normal");
    } else {
      doc.setFont(baseFont, t.italic ? "italic" : baseStyle);
    }
    doc.setFontSize(t.sub ? baseSize * SUB_SCALE : baseSize);
    w += doc.getTextWidth(t.text);
  }
  return w;
}

function renderMathTokens(
  doc: jsPDF,
  tokens: MathToken[],
  x: number,
  y: number,
  baseSize: number,
  baseFont: string,
  baseStyle: string,
): number {
  let cx = x;
  for (const t of tokens) {
    if (t.symbol) {
      doc.setFont("symbol", "normal");
    } else {
      doc.setFont(baseFont, t.italic ? "italic" : baseStyle);
    }
    const size = t.sub ? baseSize * SUB_SCALE : baseSize;
    doc.setFontSize(size);
    const dy = t.sub ? baseSize * SUB_SHIFT : 0;
    doc.text(t.text, cx, y + dy);
    cx += doc.getTextWidth(t.text);
  }
  return cx - x;
}

function renderMathCentered(
  doc: jsPDF,
  expr: string,
  centerX: number,
  y: number,
  baseSize: number,
  baseFont: string = "times",
  baseStyle: string = "normal",
): void {
  const tokens = tokenizeMath(expr);
  const w = measureMathTokens(doc, tokens, baseSize, baseFont, baseStyle);
  renderMathTokens(doc, tokens, centerX - w / 2, y, baseSize, baseFont, baseStyle);
}

function renderMathLeft(
  doc: jsPDF,
  expr: string,
  startX: number,
  y: number,
  baseSize: number,
  baseFont: string = "times",
  baseStyle: string = "normal",
): number {
  const tokens = tokenizeMath(expr);
  return renderMathTokens(doc, tokens, startX, y, baseSize, baseFont, baseStyle);
}

// ---- DH row formatting ----

interface DHRowFormatted {
  i: string;
  theta: string;
  alpha: string;
  r: string;
  d: string;
}

function buildRawDHRows(
  jointElements: Joint[],
  nextLengthLabel: (value: number) => string,
): DHRowFormatted[] {
  return jointElements.map((element, index) => {
    const rowIndex = index + 1;
    const isPrismatic = element.type === "prismatic";

    const thetaOffset = element.dhParams.theta;
    let theta: string;
    if (isPrismatic) {
      // For prismatic joints, theta is a constant
      theta = Math.abs(thetaOffset) < 1e-10 ? "0" : formatPiAngle(thetaOffset);
    } else {
      // For revolute joints, theta is the variable
      const thetaBase = `theta_${rowIndex}`;
      theta =
        Math.abs(thetaOffset) < 1e-10
          ? thetaBase
          : `${thetaBase} ${thetaOffset >= 0 ? "+" : "-"} ${formatPiAngle(Math.abs(thetaOffset))}`;
    }

    // Assign d label before r so that length indices follow the physical
    // chain order (d_i gets a lower L-number than r_i for the same row),
    // matching the standard DH convention labeling.
    const dConst = element.dhParams.d;
    const dBase = `d_${rowIndex}`;
    const d = isPrismatic
      ? Math.abs(dConst) < 1e-10
        ? dBase
        : `${dBase} ${dConst >= 0 ? "+" : "-"} ${formatNumber(Math.abs(dConst))}`
      : Math.abs(dConst) < 1e-10
        ? "0"
        : nextLengthLabel(dConst);

    const rConst = element.dhParams.a;
    const r = Math.abs(rConst) < 1e-10 ? "0" : nextLengthLabel(rConst);

    return {
      i: String(rowIndex),
      theta,
      alpha: formatPiAngle(element.dhParams.alpha),
      r,
      d,
    };
  });
}

function buildRemappedDHRows(
  standardRows: StandardDHRow[],
  nextLengthLabel: (value: number) => string,
): DHRowFormatted[] {
  return standardRows.map((row) => {
    let theta: string;
    if (row.isPrismatic) {
      // For prismatic joints, theta is a constant
      theta = Math.abs(row.thetaOffset) < 1e-10 ? "0" : formatPiAngle(row.thetaOffset);
    } else {
      // For revolute joints, theta is the variable
      const thetaBase = `theta_${row.index}`;
      theta =
        Math.abs(row.thetaOffset) < 1e-10
          ? thetaBase
          : `${thetaBase} ${row.thetaOffset >= 0 ? "+" : "-"} ${formatPiAngle(Math.abs(row.thetaOffset))}`;
    }

    // Assign d label before r to preserve physical chain ordering
    const dBase = `d_${row.index}`;
    const d = row.isPrismatic
      ? Math.abs(row.d) < 1e-10
        ? dBase
        : `${dBase} ${row.d >= 0 ? "+" : "-"} ${formatNumber(Math.abs(row.d))}`
      : Math.abs(row.d) < 1e-10
        ? "0"
        : nextLengthLabel(row.d);

    const r = Math.abs(row.a) < 1e-10 ? "0" : nextLengthLabel(row.a);

    return {
      i: String(row.index),
      theta,
      alpha: formatPiAngle(row.alpha),
      r,
      d,
    };
  });
}

// ---- PDF generation ----

export function downloadDhReportPdf(options: DHReportOptions): void {
  const { elements, revoluteAroundZOnly, revoluteFrameAxis, useCommonNormalConvention } = options;
  if (elements.length === 0) return;

  const doc = new jsPDF({ unit: "pt", format: "a4" });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const marginLeft = 36;
  const marginRight = 36;
  const marginTop = 34;
  const marginBottom = 30;
  const usableWidth = pageWidth - marginLeft - marginRight;
  let y = marginTop;

  const ensureSpace = (requiredHeight: number) => {
    if (y + requiredHeight > pageHeight - marginBottom) {
      doc.addPage();
      y = marginTop;
    }
  };

  const now = new Date();
  const dateLabel = now.toLocaleString();
  const fileDate = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(25, 30, 40);
  doc.text("DH Parameter Report", marginLeft, y);
  y += 18;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(70, 80, 95);
  doc.text(`Generated: ${dateLabel}`, marginLeft, y);
  y += 12;
  doc.text(
    `Frame remap mode: ${revoluteAroundZOnly ? "ON" : "OFF"} | Selected frame axis: ${revoluteFrameAxis.toUpperCase()} | Common-normal convention: ${useCommonNormalConvention ? "ON" : "OFF"}`,
    marginLeft,
    y,
  );
  y += 18;

  doc.setDrawColor(210, 215, 225);
  doc.line(marginLeft, y, marginLeft + usableWidth, y);
  y += 14;

  doc.setTextColor(30, 35, 45);
  renderMathLeft(doc, "DH matrix (theta, alpha, r, d)", marginLeft, y, 10, "helvetica", "bold");
  y += 12;

  const lengthLegend: Array<{ label: string; value: number }> = [];
  let lengthIndex = 1;

  const nextLengthLabel = (value: number): string => {
    const label = `L${lengthIndex++}`;
    lengthLegend.push({ label, value: Math.abs(value) });
    return value < 0 ? `-${label}` : label;
  };

  // Only joints appear in the DH parameter table (links are encoded
  // in the a/d parameters of their adjacent joints).
  const jointElements = elements.filter((el) => el.elementKind === "joint");

  const standardRows = revoluteAroundZOnly
    ? computeStandardDHTable(elements, revoluteFrameAxis, useCommonNormalConvention)
    : null;

  const dhRows = standardRows
    ? buildRemappedDHRows(standardRows, nextLengthLabel)
    : buildRawDHRows(jointElements, nextLengthLabel);

  const tableX = marginLeft + 18;
  const tableWidth = usableWidth - 36;
  const headerHeight = 28;
  const rowHeight = 22;
  const colWidths = [38, 120, 120, 126, 79];
  const colLefts = [
    tableX,
    tableX + colWidths[0]!,
    tableX + colWidths[0]! + colWidths[1]!,
    tableX + colWidths[0]! + colWidths[1]! + colWidths[2]!,
    tableX + colWidths[0]! + colWidths[1]! + colWidths[2]! + colWidths[3]!,
  ];
  const headers = ["i", "theta_i", "alpha_i", "r_i (=a_i)", "d_i"];
  let rowIndex = 0;

  while (rowIndex < dhRows.length) {
    ensureSpace(headerHeight + rowHeight + 8);
    const available = pageHeight - marginBottom - y;
    const maxRows = Math.max(1, Math.floor((available - headerHeight - 10) / rowHeight));
    const rowsInPage = dhRows.slice(rowIndex, rowIndex + maxRows);
    const panelHeight = headerHeight + rowsInPage.length * rowHeight + 8;
    const headerY = y + 18;

    doc.setFillColor(33, 34, 38);
    doc.roundedRect(tableX, y, tableWidth, panelHeight, 4, 4, "F");
    doc.setDrawColor(210, 210, 210);
    doc.setLineWidth(0.7);
    doc.line(tableX + 8, y + headerHeight, tableX + tableWidth - 8, y + headerHeight);

    doc.setLineWidth(0.5);
    for (let i = 1; i < colWidths.length; i++) {
      const xLine = tableX + colWidths.slice(0, i).reduce((acc, value) => acc + value, 0);
      doc.line(xLine, y + 8, xLine, y + panelHeight - 8);
    }

    // Table headers with math rendering (Greek symbols + subscripts)
    doc.setTextColor(245, 245, 245);
    headers.forEach((header, idx) => {
      const cellLeft = colLefts[idx]!;
      const cellWidth = colWidths[idx]!;
      renderMathCentered(doc, header, cellLeft + cellWidth / 2, headerY, 16, "times", "italic");
    });

    // Table cell values with math rendering
    rowsInPage.forEach((row, localIdx) => {
      const rowY = y + headerHeight + 16 + localIdx * rowHeight;
      const values = [row.i, row.theta, row.alpha, row.r, row.d];
      values.forEach((value, idx) => {
        const cellLeft = colLefts[idx]!;
        const cellWidth = colWidths[idx]!;
        renderMathCentered(doc, value, cellLeft + cellWidth / 2, rowY, 13);
      });
    });

    rowIndex += rowsInPage.length;
    y += panelHeight + 16;
  }

  if (lengthLegend.length > 0) {
    ensureSpace(14);
    doc.setTextColor(70, 80, 95);
    const legendText = lengthLegend.map((entry) => `${entry.label}=${formatNumber(entry.value)}`).join("   ");
    renderMathLeft(doc, `Length parameters: ${legendText}`, marginLeft, y, 8.5, "helvetica", "normal");
    y += 12;
  }

  ensureSpace(22);
  doc.setDrawColor(210, 215, 225);
  doc.line(marginLeft, y, marginLeft + usableWidth, y);
  y += 14;

  doc.setTextColor(30, 35, 45);
  renderMathLeft(doc, "Effective variables and A_i matrix", marginLeft, y, 10, "helvetica", "bold");
  y += 14;

  // Build per-joint matrix entries from either standard DH rows (remap ON) or raw params (OFF).
  // When remap is ON, the A_i matrices use the absorbed d/a and computed alpha from the
  // standard DH table so they match the parameter table displayed above.
  const matrixEntries: Array<{
    index: number;
    isPrismatic: boolean;
    axisLabel: string;
    thetaConst: number;
    qTheta: number;
    dConst: number;
    qD: number;
    alpha: number;
    a: number;
    matrix: Matrix4x4;
  }> = [];

  if (standardRows) {
    for (const dhRow of standardRows) {
      const joint = dhRow.joint;
      const qTheta = dhRow.isRevolute ? joint.variableValue : 0;
      const qD = dhRow.isPrismatic ? joint.variableValue : 0;
      matrixEntries.push({
        index: dhRow.index,
        isPrismatic: dhRow.isPrismatic,
        axisLabel: revoluteFrameAxis.toUpperCase(),
        thetaConst: dhRow.thetaOffset,
        qTheta,
        dConst: dhRow.d,
        qD,
        alpha: dhRow.alpha,
        a: dhRow.a,
        matrix: computeDHMatrix(
          {
            theta: dhRow.thetaOffset + qTheta,
            d: dhRow.d + qD,
            a: dhRow.a,
            alpha: dhRow.alpha,
          },
          revoluteFrameAxis,
        ),
      });
    }
  } else {
    for (let index = 0; index < jointElements.length; index++) {
      const element = jointElements[index]!;
      const qTheta = element.type === "revolute" ? element.variableValue : 0;
      const qD = element.type === "prismatic" ? element.variableValue : 0;
      matrixEntries.push({
        index: index + 1,
        isPrismatic: element.type === "prismatic",
        axisLabel: element.rotationAxis.toUpperCase(),
        thetaConst: element.dhParams.theta,
        qTheta,
        dConst: element.dhParams.d,
        qD,
        alpha: element.dhParams.alpha,
        a: element.dhParams.a,
        matrix: computeElementMatrix(element),
      });
    }
  }

  for (const entry of matrixEntries) {
    const thetaEffective = entry.thetaConst + entry.qTheta;
    const dEffective = entry.dConst + entry.qD;

    ensureSpace(106);

    // Section heading: "N. theta_N (axis Z)" or "N. d_N (axis Z)"
    doc.setTextColor(35, 42, 55);
    const paramLabel = entry.isPrismatic
      ? `d_${entry.index}`
      : `theta_${entry.index}`;
    renderMathLeft(
      doc,
      `${entry.index}. ${paramLabel} (axis ${entry.axisLabel})`,
      marginLeft,
      y,
      9.5,
      "helvetica",
      "bold",
    );
    y += 12;

    // Formula lines with math rendering
    doc.setTextColor(70, 78, 92);
    renderMathLeft(
      doc,
      `theta* = theta + q_theta = ${formatNumber(entry.thetaConst)} + ${formatNumber(entry.qTheta)} = ${formatNumber(thetaEffective)} rad`,
      marginLeft + 4,
      y,
      8.5,
      "helvetica",
      "normal",
    );
    y += 10;
    renderMathLeft(
      doc,
      `d* = d + q_d = ${formatNumber(entry.dConst)} + ${formatNumber(entry.qD)} = ${formatNumber(dEffective)}`,
      marginLeft + 4,
      y,
      8.5,
      "helvetica",
      "normal",
    );
    y += 10;
    renderMathLeft(
      doc,
      `alpha = ${formatNumber(entry.alpha)} rad (${formatNumber(entry.alpha * RAD_TO_DEG, 2)} deg), r = ${formatNumber(entry.a)}`,
      marginLeft + 4,
      y,
      8.5,
      "helvetica",
      "normal",
    );
    y += 10;

    // A_i matrix label
    doc.setTextColor(95, 105, 122);
    renderMathLeft(doc, `A_${entry.index}:`, marginLeft + 4, y, 8, "helvetica", "normal");
    y += 10;

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(45, 52, 65);
    for (const matRow of entry.matrix) {
      const line = `[ ${matRow.map((value) => formatSigned(value)).join("  ")} ]`;
      doc.text(line, marginLeft + 14, y);
      y += 9;
    }

    y += 7;
  }

  const pageCount = doc.getNumberOfPages();
  for (let page = 1; page <= pageCount; page++) {
    doc.setPage(page);
    addFooter(doc, page, pageCount, marginLeft, pageHeight);
  }

  doc.save(`dh-report-${fileDate}.pdf`);
}
