'use client';

type Props = {
  values: number[];
  tone?: 'green' | 'amber' | 'blue' | 'red';
  className?: string;
};

const TONE_STROKE: Record<NonNullable<Props['tone']>, string> = {
  green: 'oklch(0.48 0.12 155)',
  amber: 'oklch(0.62 0.14 75)',
  blue: 'oklch(0.45 0.1 240)',
  red: 'oklch(0.55 0.18 25)',
};

export function AssistantSparkline({ values, tone = 'green', className }: Props) {
  if (!values.length) return null;

  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const range = max - min || 1;
  const w = 56;
  const h = 18;
  const pad = 2;

  const points = values
    .map((v, i) => {
      const x = pad + (i / Math.max(values.length - 1, 1)) * (w - pad * 2);
      const y = h - pad - ((v - min) / range) * (h - pad * 2);
      return `${x},${y}`;
    })
    .join(' ');

  const last = values[values.length - 1] ?? 0;
  const lastX = pad + ((values.length - 1) / Math.max(values.length - 1, 1)) * (w - pad * 2);
  const lastY = h - pad - ((last - min) / range) * (h - pad * 2);

  return (
    <svg
      className={className}
      viewBox={`0 0 ${w} ${h}`}
      width={w}
      height={h}
      aria-hidden
    >
      <polyline
        fill="none"
        stroke={TONE_STROKE[tone]}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={points}
        opacity={0.85}
      />
      <circle cx={lastX} cy={lastY} r="2" fill={TONE_STROKE[tone]} />
    </svg>
  );
}
