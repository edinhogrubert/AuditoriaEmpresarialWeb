import React, { useEffect, useRef, useState } from 'react';
import JsBarcode from 'jsbarcode';

interface BarcodeRendererProps {
  id?: string;
  value: string;
  format?: string; // CODE128, EAN13, EAN8, CODE39, ITF14, etc.
  width?: number;  // Bar width in px
  height?: number; // Bar height in px
  fontSize?: number;
  displayValue?: boolean;
  background?: string;
  lineColor?: string;
  className?: string;
}

// Code128 pattern table for pure SVG fallback
const CODE128_PATTERNS: string[] = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '302123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313111', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '801242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112'
];

// Clean Code128 pattern lookup fix
const getPattern = (index: number) => {
  const p = CODE128_PATTERNS[index];
  if (!p) return '211214';
  if (index === 30) return '212123';
  if (index === 80) return '111242';
  return p;
};

// Pure React/SVG Code128 Fallback Generator
function encodeCode128(text: string): boolean[] {
  const cleaned = text.trim();
  if (!cleaned) return [];

  const values: number[] = [104]; // Start B

  for (let i = 0; i < cleaned.length; i++) {
    const code = cleaned.charCodeAt(i);
    let val = code - 32;
    if (val < 0 || val > 95) val = 0; // fallback space
    values.push(val);
  }

  // Checksum
  let sum = values[0];
  for (let i = 1; i < values.length; i++) {
    sum += i * values[i];
  }
  const checksum = sum % 103;
  values.push(checksum);
  values.push(106); // Stop pattern

  // Convert values to bar/space boolean array
  const bars: boolean[] = [];
  values.forEach((val) => {
    const pattern = getPattern(val);
    let isBar = true;
    for (let char of pattern) {
      const width = parseInt(char, 10);
      for (let w = 0; w < width; w++) {
        bars.push(isBar);
      }
      isBar = !isBar;
    }
  });

  return bars;
}

export const BarcodeRenderer: React.FC<BarcodeRendererProps> = ({
  id,
  value,
  format = 'CODE128',
  width = 2,
  height = 80,
  fontSize = 16,
  displayValue = true,
  background = '#ffffff',
  lineColor = '#000000',
  className = '',
}) => {
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!svgRef.current || !value) return;

    try {
      setError(null);
      // CJS / ESM interop handler for JsBarcode
      const renderFn = typeof JsBarcode === 'function' ? JsBarcode : (JsBarcode as any)?.default;

      if (typeof renderFn === 'function') {
        renderFn(svgRef.current, value.trim(), {
          format: format || 'CODE128',
          width: width,
          height: height,
          displayValue: displayValue,
          fontOptions: 'bold',
          fontSize: fontSize,
          margin: 10,
          background: background,
          lineColor: lineColor,
          valid: (valid) => {
            if (!valid) {
              setUseFallback(true);
            }
          },
        });
      } else {
        setUseFallback(true);
      }
    } catch (err: any) {
      setUseFallback(true);
    }
  }, [value, format, width, height, fontSize, displayValue, background, lineColor]);

  // If JsBarcode encounters an issue or isn't installed locally, render pure SVG Code128!
  if (useFallback) {
    const bars = encodeCode128(value);
    const quietZone = 20;
    const totalWidth = bars.length * width + quietZone * 2;
    const totalHeight = height + (displayValue ? fontSize + 16 : 20);

    return (
      <svg
        id={id}
        ref={svgRef}
        viewBox={`0 0 ${totalWidth} ${totalHeight}`}
        className={`max-w-full h-auto mx-auto rounded-xl ${className}`}
        style={{ background }}
      >
        <g transform={`translate(${quietZone}, 10)`}>
          {bars.map((isBar, idx) => {
            if (!isBar) return null;
            return (
              <rect
                key={idx}
                x={idx * width}
                y={0}
                width={width}
                height={height}
                fill={lineColor}
              />
            );
          })}
        </g>
        {displayValue && (
          <text
            x={totalWidth / 2}
            y={height + fontSize + 10}
            textAnchor="middle"
            fill={lineColor}
            fontSize={fontSize}
            fontWeight="bold"
            fontFamily="monospace"
          >
            {value}
          </text>
        )}
      </svg>
    );
  }

  return (
    <svg
      id={id}
      ref={svgRef}
      className={`max-w-full h-auto mx-auto rounded-xl ${className}`}
    />
  );
};
