import type { Matrix4x4 } from "../../core/types/matrix";
import { formatMatrixElement } from "../../math/matrixOps";

interface MatrixDisplayProps {
  matrix: Matrix4x4;
  label?: string;
  highlight?: boolean;
}

export default function MatrixDisplay({ matrix, label, highlight }: MatrixDisplayProps) {
  return (
    <div className="space-y-1">
      {label && (
        <div className={`text-[11px] font-medium font-mono ${highlight ? "text-indigo-400" : "text-gray-500"}`}>
          {label}
        </div>
      )}
      <div className={`rounded-md p-2 font-mono text-[11px] ${highlight ? "bg-indigo-500/8 border border-indigo-500/20" : "bg-gray-800/40"}`}>
        <div className="flex items-center gap-1">
          <span className="text-gray-600 text-base leading-none select-none">&#91;</span>
          <div className="grid grid-cols-4 gap-x-2 gap-y-0.5 flex-1">
            {matrix.map((row, i) =>
              row.map((val, j) => (
                <span
                  key={`${i}-${j}`}
                  className={`text-right tabular-nums ${
                    j === 3 && i < 3
                      ? "text-emerald-400"
                      : i === 3
                        ? "text-gray-700"
                        : "text-gray-300"
                  }`}
                >
                  {formatMatrixElement(val)}
                </span>
              )),
            )}
          </div>
          <span className="text-gray-600 text-base leading-none select-none">&#93;</span>
        </div>
      </div>
    </div>
  );
}
