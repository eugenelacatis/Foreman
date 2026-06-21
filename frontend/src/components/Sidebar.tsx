import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  CheckSquare,
  Settings,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface NavEntry {
  key: string;
  label: string;
  icon: LucideIcon;
  active?: boolean;
  badge?: number;
}

const navTop: NavEntry[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, active: true },
  { key: "clients", label: "Clients", icon: Users },
  { key: "approvals", label: "Approvals", icon: CheckSquare, badge: 3 },
];

interface NavItemProps {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  badge?: number;
  collapsed: boolean;
}

function NavItem({ icon: Icon, label, active, badge, collapsed }: NavItemProps) {
  return (
    <a
      href="#"
      title={collapsed ? label : undefined}
      className={
        'group relative flex items-center gap-2.5 rounded-[8px] text-[13.5px] transition-colors ' +
        (collapsed ? 'justify-center px-0 py-2' : 'px-2.5 py-2') +
        ' ' +
        (active
          ? 'bg-[var(--color-accent-tint)] text-[var(--color-accent)] font-medium'
          : 'text-[var(--color-ink-2)] hover:text-[var(--color-ink)] hover:bg-[#f7f8fa]')
      }
    >
      <Icon size={16} strokeWidth={active ? 2.25 : 1.75} />
      {!collapsed && <span className="flex-1 truncate">{label}</span>}
      {badge != null ? (
        <span
          className={
            'num inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[var(--color-accent)] px-1.5 text-[11px] font-medium leading-none text-white ' +
            (collapsed ? 'absolute -top-0.5 right-1' : '')
          }
        >
          {badge}
        </span>
      ) : null}
    </a>
  )
}

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside
      className={
        'sticky top-0 hidden md:flex h-screen shrink-0 flex-col border-r border-[var(--color-hairline)] bg-white transition-[width] duration-200 ease-out ' +
        (collapsed ? 'w-[60px]' : 'w-[172px]')
      }
    >
      {/* Wordmark + collapse */}
      <div
        className={
          'flex items-center pt-5 pb-6 ' +
          (collapsed ? 'flex-col gap-3 px-2' : 'gap-1.5 px-4')
        }
      >
        {!collapsed && (
          <>
            <span className="grid h-6 w-6 place-items-center rounded-[6px] bg-[var(--color-accent-tint)] text-[var(--color-accent)]">
              <Wrench size={13} strokeWidth={2.25} />
            </span>
            <span className="font-display flex-1 text-[15px] font-semibold tracking-tight text-[var(--color-ink)]">
              ForemanAI
            </span>
          </>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((v) => !v)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="grid h-7 w-7 place-items-center rounded-[8px] text-[var(--color-ink-2)] hover:bg-[#f7f8fa] hover:text-[var(--color-ink)]"
        >
          {collapsed ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
        </button>
      </div>

      {/* Nav */}
      <nav className={'flex flex-col gap-0.5 ' + (collapsed ? 'px-2' : 'px-2')}>
        {navTop.map(({ key, ...item }) => (
          <NavItem key={key} {...item} collapsed={collapsed} />
        ))}
      </nav>

      <div className="flex-1" />

      <nav className="flex flex-col gap-0.5 px-2 pb-5">
        <NavItem icon={Settings} label="Settings" collapsed={collapsed} />
      </nav>
    </aside>
  )
}
