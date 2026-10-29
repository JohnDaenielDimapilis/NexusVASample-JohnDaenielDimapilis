import { brand } from "./brand-config";

export default function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className={`brand-lockup ${compact ? "compact" : ""}`}>
      <img src={brand.logo} alt="Nexus" width={48} height={48} />
      {!compact && (
        <span className="brand-lockup-name">
          <strong>Virtual Executives</strong>
          <small>Client & executive portal</small>
        </span>
      )}
    </span>
  );
}
