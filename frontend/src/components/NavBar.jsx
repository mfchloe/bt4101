import { Folder, Wand2, CheckSquare, BarChart3 } from "lucide-react";

const TABS = [
  { id: "library", label: "File library", icon: Folder },
  { id: "generator", label: "Content generator", icon: Wand2 },
  { id: "marking", label: "Essay marking", icon: CheckSquare },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
];

export default function NavBar({ active, onChange }) {
  return (
    <div className="flex gap-1 border-b border-slate-200 bg-slate-50 px-4 py-2">
      {TABS.map(({ id, label, icon: Icon }) => {
        const isActive = active === id;
        return (
          <button
            key={id}
            onClick={() => onChange(id)}
            className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm transition-colors ${
              isActive
                ? "bg-indigo-50 text-indigo-700"
                : "text-slate-500 hover:bg-slate-100 hover:text-slate-700"
            }`}
          >
            <Icon size={16} />
            {label}
          </button>
        );
      })}
    </div>
  );
}
