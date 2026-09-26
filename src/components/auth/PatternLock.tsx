import React, { useState, useRef, useEffect, useCallback } from 'react';

interface Point {
  x: number;
  y: number;
}

interface PatternLockProps {
  onComplete: (pattern: number[]) => void;
  disabled?: boolean;
  isError?: boolean;
  isSuccess?: boolean;
  size?: number; // Size in px, default 280
}

export const PatternLock: React.FC<PatternLockProps> = ({
  onComplete,
  disabled = false,
  isError = false,
  isSuccess = false,
  size = 280,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDots, setSelectedDots] = useState<number[]>([]);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentPos, setCurrentPos] = useState<Point | null>(null);

  // Compute 3x3 dot positions relative to container
  const padding = size * 0.16;
  const gridSpan = size - padding * 2;
  const step = gridSpan / 2;

  const dotPositions: Point[] = [];
  for (let row = 0; row < 3; row++) {
    for (let col = 0; col < 3; col++) {
      dotPositions.push({
        x: padding + col * step,
        y: padding + row * step,
      });
    }
  }

  const getPointerPos = (e: React.PointerEvent | PointerEvent): Point | null => {
    if (!containerRef.current) return null;
    const rect = containerRef.current.getBoundingClientRect();
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const getNearestDot = (pos: Point): number | null => {
    const hitRadius = step * 0.38;
    for (let i = 0; i < dotPositions.length; i++) {
      const dot = dotPositions[i];
      const dist = Math.hypot(dot.x - pos.x, dot.y - pos.y);
      if (dist <= hitRadius) {
        return i;
      }
    }
    return null;
  };

  const addDotIfNew = useCallback(
    (dotIdx: number) => {
      setSelectedDots((prev) => {
        if (!prev.includes(dotIdx)) {
          if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
            try {
              navigator.vibrate(15);
            } catch {
              // ignore
            }
          }
          return [...prev, dotIdx];
        }
        return prev;
      });
    },
    []
  );

  const handlePointerDown = (e: React.PointerEvent) => {
    if (disabled) return;
    const pos = getPointerPos(e);
    if (!pos) return;

    // Capture pointer to track outside container cleanly
    try {
      (e.target as HTMLElement).setPointerCapture(e.pointerId);
    } catch {
      // ignore
    }

    setIsDrawing(true);
    setCurrentPos(pos);

    const dot = getNearestDot(pos);
    if (dot !== null) {
      setSelectedDots([dot]);
    } else {
      setSelectedDots([]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDrawing || disabled) return;
    const pos = getPointerPos(e);
    if (!pos) return;
    setCurrentPos(pos);

    const dot = getNearestDot(pos);
    if (dot !== null) {
      addDotIfNew(dot);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || disabled) return;
    setIsDrawing(false);
    setCurrentPos(null);

    if (selectedDots.length > 0) {
      onComplete([...selectedDots]);
    }
  };

  // Reset internal pattern if parent specifies error or reset
  useEffect(() => {
    if (isError) {
      const timer = setTimeout(() => {
        setSelectedDots([]);
      }, 700);
      return () => clearTimeout(timer);
    }
  }, [isError]);

  const lineColor = isError
    ? '#F43F5E' // rose-500
    : isSuccess
    ? '#10B981' // emerald-500
    : '#B8A4D8'; // sanctuary lavender

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{ width: size, height: size }}
      className={`relative mx-auto touch-none select-none rounded-3xl bg-[#101014] border border-[#24242A] shadow-inner transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-crosshair'
      }`}
    >
      {/* SVG Connecting Lines */}
      <svg
        className="absolute inset-0 pointer-events-none"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        {/* Lines between connected dots */}
        {selectedDots.map((dotIdx, idx) => {
          if (idx === 0) return null;
          const prevDot = dotPositions[selectedDots[idx - 1]];
          const currDot = dotPositions[dotIdx];
          return (
            <line
              key={`line-${idx}`}
              x1={prevDot.x}
              y1={prevDot.y}
              x2={currDot.x}
              y2={currDot.y}
              stroke={lineColor}
              strokeWidth={3.5}
              strokeLinecap="round"
              strokeOpacity={0.85}
            />
          );
        })}

        {/* Dynamic line to active cursor position while dragging */}
        {isDrawing && currentPos && selectedDots.length > 0 && (
          <line
            x1={dotPositions[selectedDots[selectedDots.length - 1]].x}
            y1={dotPositions[selectedDots[selectedDots.length - 1]].y}
            x2={currentPos.x}
            y2={currentPos.y}
            stroke={lineColor}
            strokeWidth={2.5}
            strokeDasharray="4 4"
            strokeLinecap="round"
            strokeOpacity={0.6}
          />
        )}
      </svg>

      {/* 3x3 Dots Matrix */}
      {dotPositions.map((pos, idx) => {
        const isSelected = selectedDots.includes(idx);
        return (
          <div
            key={idx}
            style={{
              left: pos.x,
              top: pos.y,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute flex items-center justify-center pointer-events-none"
          >
            {/* Outer Ring when selected */}
            <div
              className={`rounded-full transition-all duration-200 flex items-center justify-center ${
                isSelected
                  ? isError
                    ? 'w-11 h-11 bg-rose-500/20 border-2 border-rose-500 scale-105'
                    : isSuccess
                    ? 'w-11 h-11 bg-emerald-500/20 border-2 border-emerald-500 scale-105'
                    : 'w-11 h-11 bg-[#B8A4D8]/20 border-2 border-[#B8A4D8] scale-105 shadow-[0_0_12px_rgba(184,164,216,0.5)]'
                  : 'w-7 h-7 bg-transparent border border-transparent'
              }`}
            >
              {/* Inner Center Dot */}
              <div
                className={`rounded-full transition-all duration-200 ${
                  isSelected
                    ? isError
                      ? 'w-3.5 h-3.5 bg-rose-400'
                      : isSuccess
                      ? 'w-3.5 h-3.5 bg-emerald-400'
                      : 'w-3.5 h-3.5 bg-[#B8A4D8] scale-110'
                    : 'w-3 h-3 bg-[#44424D] border border-[#2B2B32]'
                }`}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
};
