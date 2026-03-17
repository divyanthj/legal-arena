export default function Sidebar({ links }) {
  return (
    <ul className="menu menu-lg w-80 rounded-box bg-base-200">
      {links.map((link, index) => (
        <li key={index}>
          <a href={link.href}>{link.label}</a>
        </li>
      ))}
    </ul>
  );
}
