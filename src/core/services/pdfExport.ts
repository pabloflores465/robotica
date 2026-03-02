import jsPDF from "jspdf";
import type { Joint, RotationAxis } from "../types/robot";
import { computeDHMatrix, getEffectiveDHParams } from "../../math/dhTransform";
import { multiplyMatrices, rotationAroundAxis } from "../../math/matrixOps";
import { computeStandardDHTable } from "../../math/dhStandardParams";

export interface DHReportOptions {
  elements: Joint[];
  revoluteAroundZOnly: boolean;
  revoluteFrameAxis: RotationAxis;
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

interface DHRowFormatted {
  i: string;
  theta: string;
  alpha: string;
  r: string;
  d: string;
}

function buildRawDHRows(
  jointElements: Joint[],
  assignConstantDLabel: (value: number) => string,
  nextLengthLabel: (value: number) => string,
): DHRowFormatted[] {
  return jointElements.map((element, index) => {
    const rowIndex = index + 1;
    const isPrismatic = element.type === "prismatic";

    const thetaOffset = element.dhParams.theta;
    const thetaBase = `theta_${rowIndex}`;
    const theta =
      Math.abs(thetaOffset) < 1e-10
        ? thetaBase
        : `${thetaBase} ${thetaOffset >= 0 ? "+" : "-"} ${formatPiAngle(Math.abs(thetaOffset))}`;

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
        : assignConstantDLabel(dConst);

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
  elements: Joint[],
  referenceAxis: RotationAxis,
  assignConstantDLabel: (value: number) => string,
  nextLengthLabel: (value: number) => string,
): DHRowFormatted[] {
  const standardRows = computeStandardDHTable(elements, referenceAxis);
  return standardRows.map((row) => {
    const thetaBase = `theta_${row.index}`;
    const theta =
      Math.abs(row.thetaOffset) < 1e-10
        ? thetaBase
        : `${thetaBase} ${row.thetaOffset >= 0 ? "+" : "-"} ${formatPiAngle(Math.abs(row.thetaOffset))}`;

    // Assign d label before r to preserve physical chain ordering
    const dBase = `d_${row.index}`;
    const d = row.isPrismatic
      ? Math.abs(row.d) < 1e-10
        ? dBase
        : `${dBase} ${row.d >= 0 ? "+" : "-"} ${formatNumber(Math.abs(row.d))}`
      : Math.abs(row.d) < 1e-10
        ? "0"
        : assignConstantDLabel(row.d);

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

export function downloadDhReportPdf(options: DHReportOptions): void {
  const { elements, revoluteAroundZOnly, revoluteFrameAxis } = options;
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
    `Frame remap mode: ${revoluteAroundZOnly ? "ON" : "OFF"} | Selected frame axis: ${revoluteFrameAxis.toUpperCase()}`,
    marginLeft,
    y,
  );
  y += 18;

  doc.setDrawColor(210, 215, 225);
  doc.line(marginLeft, y, marginLeft + usableWidth, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 35, 45);
  doc.text("DH matrix (theta, alpha, r, d)", marginLeft, y);
  y += 12;

  const lengthLegend: Array<{ label: string; value: number }> = [];
  let lengthIndex = 1;
  let baseDWasAssigned = false;

  const nextLengthLabel = (value: number): string => {
    const label = `L${lengthIndex++}`;
    lengthLegend.push({ label, value: Math.abs(value) });
    return value < 0 ? `-${label}` : label;
  };

  const assignConstantDLabel = (value: number): string => {
    if (!baseDWasAssigned) {
      baseDWasAssigned = true;
      lengthLegend.push({ label: "d", value: Math.abs(value) });
      return value < 0 ? "-d" : "d";
    }
    return nextLengthLabel(value);
  };

  // Only joints appear in the DH parameter table (links are encoded
  // in the a/d parameters of their adjacent joints).
  const jointElements = elements.filter((el) => el.elementKind === "joint");

  const dhRows = revoluteAroundZOnly
    ? buildRemappedDHRows(elements, revoluteFrameAxis, assignConstantDLabel, nextLengthLabel)
    : buildRawDHRows(jointElements, assignConstantDLabel, nextLengthLabel);

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

    doc.setFont("times", "italic");
    doc.setFontSize(16);
    doc.setTextColor(245, 245, 245);
    headers.forEach((header, idx) => {
      const cellLeft = colLefts[idx]!;
      const cellWidth = colWidths[idx]!;
      doc.text(header, cellLeft + cellWidth / 2, headerY, { align: "center" });
    });

    doc.setFont("times", "normal");
    doc.setFontSize(13);
    rowsInPage.forEach((row, localIdx) => {
      const rowY = y + headerHeight + 16 + localIdx * rowHeight;
      const values = [row.i, row.theta, row.alpha, row.r, row.d];
      values.forEach((value, idx) => {
        const cellLeft = colLefts[idx]!;
        const cellWidth = colWidths[idx]!;
        doc.text(value, cellLeft + cellWidth / 2, rowY, { align: "center" });
      });
    });

    rowIndex += rowsInPage.length;
    y += panelHeight + 16;
  }

  if (lengthLegend.length > 0) {
    ensureSpace(14);
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(70, 80, 95);
    const legendText = lengthLegend.map((entry) => `${entry.label}=${formatNumber(entry.value)}`).join("   ");
    doc.text(`Length parameters: ${legendText}`, marginLeft, y);
    y += 12;
  }

  ensureSpace(22);
  doc.setDrawColor(210, 215, 225);
  doc.line(marginLeft, y, marginLeft + usableWidth, y);
  y += 14;

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(30, 35, 45);
  doc.text("Effective variables and A_i matrix", marginLeft, y);
  y += 14;

  for (let index = 0; index < jointElements.length; index++) {
    const element = jointElements[index]!;
    const isRevolute = element.type === "revolute";
    const isPrismatic = element.type === "prismatic";
    const qTheta = isRevolute ? element.variableValue : 0;
    const qD = isPrismatic ? element.variableValue : 0;
    const thetaEffective = element.dhParams.theta + qTheta;
    const dEffective = element.dhParams.d + qD;
    const matrix = computeElementMatrix(element);

    ensureSpace(106);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(9.5);
    doc.setTextColor(35, 42, 55);
    doc.text(
      `${index + 1}. ${element.name} (axis ${element.rotationAxis.toUpperCase()})`,
      marginLeft,
      y,
    );
    y += 12;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(70, 78, 92);
    doc.text(
      `theta* = theta + q_theta = ${formatNumber(element.dhParams.theta)} + ${formatNumber(qTheta)} = ${formatNumber(thetaEffective)} rad`,
      marginLeft + 4,
      y,
    );
    y += 10;
    doc.text(
      `d* = d + q_d = ${formatNumber(element.dhParams.d)} + ${formatNumber(qD)} = ${formatNumber(dEffective)}`,
      marginLeft + 4,
      y,
    );
    y += 10;
    doc.text(
      `alpha = ${formatNumber(element.dhParams.alpha)} rad (${formatNumber(element.dhParams.alpha * RAD_TO_DEG, 2)} deg), r = ${formatNumber(element.dhParams.a)}`,
      marginLeft + 4,
      y,
    );
    y += 10;

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setTextColor(95, 105, 122);
    doc.text(`A_${index + 1}:`, marginLeft + 4, y);
    y += 10;

    doc.setFont("courier", "normal");
    doc.setFontSize(8);
    doc.setTextColor(45, 52, 65);
    for (const row of matrix) {
      const line = `[ ${row.map((value) => formatSigned(value)).join("  ")} ]`;
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
