"use client";

import { useId, useMemo } from "react";

type TaskPieChartProps = {
  dueToday: number;
  pendente: number;
  emAndamento: number;
  concluido: number;
};

function clampCount(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.floor(value));
}

export function TaskPieChart({ dueToday, pendente, emAndamento, concluido }: TaskPieChartProps) {
  const rid = useId().replace(/:/g, "");
  const glowId = `ejTaskDonutGlow_${rid}`;

  const r = 40;
  const c = 2 * Math.PI * r;

  const segments = useMemo(() => {
    const a = clampCount(dueToday);
    const b = clampCount(pendente);
    const d = clampCount(emAndamento);
    const e = clampCount(concluido);
    const total = a + b + d + e;

    if (total <= 0) {
      const q = c * 0.25;
      return { total: 0, len: [q, q, q, q] as const };
    }

    const lenA = (a / total) * c;
    const lenB = (b / total) * c;
    const lenC = (d / total) * c;
    const lenD = Math.max(0, c - (lenA + lenB + lenC));
    return { total, len: [lenA, lenB, lenC, lenD] as const };
  }, [concluido, dueToday, emAndamento, pendente, c]);

  const [segRed, segOrange, segYellow, segGreen] = segments.len;
  const baseStroke = "rgb(var(--border) / 0.10)";
  const innerA = "rgb(var(--background) / 0.25)";
  const innerB = "rgb(var(--card) / 0.55)";

  // Tailwind reference colors:
  // - red-500:    #EF4444
  // - orange-500: #F97316
  // - yellow-400: #FACC15
  // - green-500:  #22C55E
  const colors = {
    red: "#EF4444",
    orange: "#F97316",
    yellow: "#FACC15",
    green: "#22C55E"
  } as const;

  return (
    <svg viewBox="0 0 120 120" className="h-28 w-28 drop-shadow-sm" role="img" aria-label="Gráfico de pizza (tarefas)">
      <defs>
        <radialGradient id={glowId} cx="50%" cy="35%" r="70%">
          <stop offset="0%" stopColor="rgba(35, 64, 102, 0.35)" />
          <stop offset="100%" stopColor="rgba(35, 64, 102, 0)" />
        </radialGradient>
      </defs>

      {/* soft glow */}
      <circle cx="60" cy="60" r="52" fill={`url(#${glowId})`} />

      {/* base ring */}
      <circle cx="60" cy="60" r={r} fill="none" stroke={baseStroke} strokeWidth="18" />

      {/* segments */}
      <g transform="rotate(-90 60 60)">
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={colors.red}
          strokeWidth="18"
          strokeDasharray={`${segRed} ${c}`}
          strokeDashoffset={0}
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={colors.orange}
          strokeWidth="18"
          strokeDasharray={`${segOrange} ${c}`}
          strokeDashoffset={-segRed}
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={colors.yellow}
          strokeWidth="18"
          strokeDasharray={`${segYellow} ${c}`}
          strokeDashoffset={-(segRed + segOrange)}
        />
        <circle
          cx="60"
          cy="60"
          r={r}
          fill="none"
          stroke={colors.green}
          strokeWidth="18"
          strokeDasharray={`${segGreen} ${c}`}
          strokeDashoffset={-(segRed + segOrange + segYellow)}
        />
      </g>

      {/* inner hole */}
      <circle cx="60" cy="60" r="24" fill={innerA} />
      <circle cx="60" cy="60" r="23" fill={innerB} />
    </svg>
  );
}

