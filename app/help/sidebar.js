export default function Sidebar({ links }) {
  return (
    <div className="arena-surface arena-column-bg overflow-hidden p-4">
      <p className="arena-kicker px-2">Guide Sections</p>
      <div className="mt-4 space-y-2">
        {links.map((link, index) => (
          <a
            key={index}
            href={link.href}
            className="arena-surface-soft flex items-center justify-between px-4 py-3 text-sm text-white/80 transition hover:border-white/20 hover:text-white"
          >
            <span>{link.label}</span>
            <span className="text-white/35">{String(index + 1).padStart(2, "0")}</span>
          </a>
        ))}
      </div>
    </div>
  );
}
