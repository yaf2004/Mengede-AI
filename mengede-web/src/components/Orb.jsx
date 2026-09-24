export default function Orb({ size = 'md', thinking = false, className = '' }) {
  return (
    <div className={`orb orb-${size} ${thinking ? 'thinking' : ''} ${className}`}>
      <div className="orb-blob" />
      <div className="orb-shine" />
    </div>
  );
}
