export default function GaugeCircle({ value, max, unit, label, color = '#00daf3', size = 120 }) {
  const r = 44;
  const cx = 60;
  const cy = 60;
  const circumference = 2 * Math.PI * r;
  const pct = Math.min(1, Math.max(0, value / max));
  const offset = circumference * (1 - pct * 0.75);
  const startAngle = 135;
  const isHigh = pct > 0.9;
  const strokeColor = isHigh ? '#ffb4ab' : (pct > 0.75 ? '#ffba38' : color);
  const glowColor = isHigh ? 'rgba(255,180,171,0.3)' : 'rgba(0,218,243,0.2)';
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox="0 0 120 120"
          style={{ filter: isHigh ? `drop-shadow(0 0 8px ${glowColor})` : `drop-shadow(0 0 4px ${glowColor})` }}>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke="#31353c" strokeWidth="8"
            strokeDasharray={`${circumference * 0.75} ${circumference * 0.25}`}
            strokeDashoffset={0} strokeLinecap="round"
            transform={`rotate(${startAngle} ${cx} ${cy})`}/>
          <circle cx={cx} cy={cy} r={r} fill="none" stroke={strokeColor} strokeWidth="8"
            strokeDasharray={`${circumference}`} strokeDashoffset={offset}
            strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.3s ease' }}
            transform={`rotate(${startAngle} ${cx} ${cy})`}/>
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={`text-xl font-black font-headline ${isHigh ? 'text-[#ffb4ab] flash-alert' : 'text-[#c3f5ff]'}`}>
            {typeof value === 'number' ? value.toFixed(1) : value}
          </span>
          <span className="text-[9px] text-[#849396] uppercase tracking-wider">{unit}</span>
        </div>
      </div>
      <div className="text-[10px] uppercase tracking-[0.15em] text-[#bac9cc] text-center">{label}</div>
    </div>
  );
}
