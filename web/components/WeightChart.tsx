// Gráfico de peso del prototipo: puntos diarios + media móvil de 7 días + meta.
export function WeightChart({ weights, goal, start, showTrend = true }: { weights: number[]; goal: number; start: Date; showTrend?: boolean }) {
  const x0 = 36, x1 = 632, y0 = 12, y1 = 192;
  const lo = Math.min(goal, ...weights) - 0.5;
  const hi = Math.ceil(Math.max(...weights));
  const X = (i: number) => x0 + (i / (weights.length - 1)) * (x1 - x0);
  const Y = (v: number) => y0 + ((hi - v) / (hi - lo)) * (y1 - y0);
  const trend = weights.map((_, i) => {
    const s = weights.slice(Math.max(0, i - 6), i + 1);
    return s.reduce((a, b) => a + b, 0) / s.length;
  });
  const path = trend.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)} ${Y(v).toFixed(1)}`).join(" ");
  const grid = [];
  for (let v = Math.ceil(lo); v <= hi; v++) grid.push(v);
  const last = weights.length - 1;
  const ticks = [0, 7, 14, 21, last].filter((i) => i <= last);
  const fmt = new Intl.DateTimeFormat("es-ES", { day: "numeric", month: "short", timeZone: "UTC" });

  return (
    <svg viewBox="0 0 640 220" style={{ width: "100%", height: "auto", display: "block", overflow: "visible" }} role="img" aria-label="Peso de los últimos días">
      {grid.map((v) => (
        <g key={v}>
          <line x1={36} x2={632} y1={Y(v)} y2={Y(v)} stroke="#e3e4e8" strokeWidth={1} />
          <text x={28} y={Y(v) + 3} fill="#8e909b" fontSize={10} textAnchor="end">
            {v}
          </text>
        </g>
      ))}
      <line x1={36} x2={632} y1={Y(goal)} y2={Y(goal)} stroke="#8e909b" strokeDasharray="4 4" strokeWidth={1} />
      {weights.map((v, i) => (
        <circle key={i} cx={X(i)} cy={Y(v)} r={2.8} fill="#8e909b" />
      ))}
      {showTrend && (
        <>
          <path d={path} fill="none" stroke="#d9692b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(217,105,43,.3))" }} />
          <circle cx={X(last)} cy={Y(trend[last])} r={4} fill="#fbfbfa" stroke="#d9692b" strokeWidth={2} />
        </>
      )}
      {ticks.map((i) => {
        const d = new Date(start);
        d.setUTCDate(d.getUTCDate() + i);
        return (
          <text key={i} x={X(i)} y={214} fill="#8e909b" fontSize={10} textAnchor="middle">
            {fmt.format(d).replace(".", "")}
          </text>
        );
      })}
    </svg>
  );
}
