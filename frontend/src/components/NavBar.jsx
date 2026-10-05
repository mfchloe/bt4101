import { BarChart3, ClipboardCheck, FolderOpen, Sparkles } from "lucide-react";
import logo from "../assets/coteach-logo.png";

const TABS = [
  { id: "library", label: "File library", icon: FolderOpen },
  { id: "generator", label: "Content generator", icon: Sparkles },
  { id: "marking", label: "Essay marking", icon: ClipboardCheck },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function NavBar({ active, onChange }) {
  return (
    <header className="flex h-16 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
      <button
        onClick={() => onChange("library")}
        aria-label="CoTeach home"
        className="shrink-0"
      >
        <img src={logo} alt="CoTeach" className="h-8 w-auto sm:h-9" />
      </button>

      <nav className="flex h-full items-stretch gap-1 overflow-x-auto">
        {TABS.map(({ id, label, icon: Icon }) => {
          const isActive = active === id;
          return (
            <button
              key={id}
              onClick={() => onChange(id)}
              aria-current={isActive ? "page" : undefined}
              aria-label={label}
              title={label}
              className={`relative flex items-center gap-2 whitespace-nowrap px-3 text-sm font-medium transition-colors ${
                isActive ? "text-teal-700" : "text-slate-500 hover:text-slate-900"
              }`}
            >
              <Icon size={17} strokeWidth={isActive ? 2.25 : 1.75} />
              {/* Icons only on narrow screens */}
              <span className="hidden md:inline">{label}</span>
              {/* Active indicator sits on the bottom edge of the bar */}
              <span
                className={`absolute inset-x-3 bottom-0 h-0.5 rounded-full transition-colors ${
                  isActive ? "bg-teal-600" : "bg-transparent"
                }`}
              />
            </button>
          );
        })}
      </nav>
    </header>
  );
}
