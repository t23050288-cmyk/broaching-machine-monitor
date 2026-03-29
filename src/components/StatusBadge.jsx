export default function StatusBadge({ status }) {
  const cfg = {
    new:    { dot: '#00e5ff', border: '#00e5ff', text: 'NEW',    label: 'text-[#00e5ff]' },
    worn:   { dot: '#ffba38', border: '#ffba38', text: 'WORN',   label: 'text-[#ffba38]' },
    failed: { dot: '#ffb4ab', border: '#ffb4ab', text: 'FAILED', label: 'text-[#ffb4ab] flash-alert' },
  };
  const c = cfg[status] || cfg.new;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[10px] font-bold tracking-widest border ${c.label}`}
      style={{ borderColor: `${c.border}40` }}>
      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: c.dot, boxShadow: `0 0 4px ${c.dot}` }}/>
      {c.text}
    </span>
  );
}
