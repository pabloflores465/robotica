import type { Matrix4x4 } from "../../core/types/matrix";
import { formatMatrixElement } from "../../math/matrixOps";

interface MatrixDisplayProps {
  matrix: Matrix4x4;
  label?: string;
}

export default function MatrixDisplay({ matrix, label }: MatrixDisplayProps) {
  return (
    <div className="space-y-1">
      {label && (
        <div className="text-xs text-gray-400 font-medium">{label}</div>
      )}
      <div className="bg-gray-800/50 rounded p-2 font-mono text-xs">
        <div className="flex items-center gap-1">
          <span className="text-gray-500 text-lg leading-none">&#91;</span>
          <div className="grid grid-cols-4 gap-x-2 gap-y-0.5">
            {matrix.map((row, i) =>
              row.map((val, j) => (
                <span
                  key={`${i}-${j}`}
                  className={`text-right tabular-nums ${
                    j === 3 && i < 3
                      ? "text-emerald-400"
                      : i === 3
                        ? "text-gray-600"
                        : "text-gray-200"
                  }`}
                >
                  {formatMatrixElement(val)}
                </span>
              )),
            )}
          </div>
          <span className="text-gray-500 text-lg leading-none">&#93;</span>
        </div>
      </div>
    </div>
  );
}
