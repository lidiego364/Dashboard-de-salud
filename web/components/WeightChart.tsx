import { daysBetween, shortDate, addDays } from "@/lib/dates";

type Point = { date: string; kg: number };

// Gráfico de peso: pesajes como puntos, media de 7 días como línea y la meta
// punteada. El eje X es por fecha, así los días sin pesaje quedan como huecos.
export function WeightChart({ start, days, points, trend, goal }: { start: string; days: number; points: Point[]; trend: Point[]; goal: number }) {
  const x0 = 36, x1 = 632, y0 = 12, y1 = 192;
  const all = [...points.map((p) => p.kg), ...trend.map((p) => p.kg), goal];
  const lo = Math.floor(Math.min(...all) - 0.3);
  const hi = Math.ceil(Math.max(...all) + 0.1);
  const X = (date: string) => x0 + (daysBetween(start, date) / (days - 1)) * (x1 - x0);
  const Y = (v: number) => y0 + ((hi - v) / (hi - lo)) * (y1 - y0);
  const path = trend.map((p, i) => `${i ? "L" : "M"}${X(p.date).toFixed(1)} ${Y(p.kg).toFixed(1)}`).join(" ");
  const grid: number[] = [];
  for (let v = lo; v <= hi; v++) grid.push(v);
  const ticks = [0, 7, 14, 21, days - 1].map((n) => addDays(start, n));
  const lastTrend = trend.at(-1);

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
      {points.map((p) => (
        <circle key={p.date} cx={X(p.date)} cy={Y(p.kg)} r={2.8} fill="#8e909b">
          <title>{`${shortDate(p.date)} · ${p.kg.toFixed(1)} kg`}</title>
        </circle>
      ))}
      {trend.length > 1 && (
        <path d={path} fill="none" stroke="#d9692b" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" style={{ filter: "drop-shadow(0 0 6px rgba(217,105,43,.3))" }} />
      )}
      {lastTrend && <circle cx={X(lastTrend.date)} cy={Y(lastTrend.kg)} r={4} fill="#fbfbfa" stroke="#d9692b" strokeWidth={2} />}
      {ticks.map((d) => (
        <text key={d} x={X(d)} y={214} fill="#8e909b" fontSize={10} textAnchor="middle">
          {shortDate(d)}
        </text>
      ))}
    </svg>
  );
}
