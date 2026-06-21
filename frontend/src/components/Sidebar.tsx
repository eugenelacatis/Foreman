import { useEffect, useRef, useState } from "react";
import {
  ChevronUp,
  LayoutDashboard,
  LogOut,
  Users,
  CheckSquare,
  Settings,
  User,
  Wrench,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

/* ============================================================
   Seam: currentUser
   Swap this object for real auth data (e.g. from a context or
   a useAuth() hook) when authentication is wired up.
   ============================================================ */
const currentUser = {
  name: "Ray Alvarez",
  business: "R&K HVAC",
  email: "ray@rkhvacservices.com",
  initials: "RA",
};

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
  onClick?: () => void;
}

function NavItem({ icon: Icon, label, active, badge, collapsed, onClick }: NavItemProps) {
  return (
    <a
      href="#"
      onClick={(e) => { e.preventDefault(); onClick?.(); }}
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
      {badge != null && badge > 0 ? (
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

/* ============================================================
   AccountChip + popover
   ============================================================ */
interface AccountChipProps {
  collapsed: boolean;
  onLogout: () => void;
}

function AccountChip({ collapsed, onLogout }: AccountChipProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={ref} className="relative px-2 pb-4 pt-2">
      {/* Popover — opens upward */}
      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-[210px] overflow-hidden rounded-[10px] border border-[var(--color-hairline)] bg-white">
          <div className="px-3 py-3">
            <p className="text-[13px] font-semibold text-[var(--color-ink)]">{currentUser.name}</p>
            <p className="text-[12px] text-[var(--color-ink-3)]">{currentUser.business}</p>
            <p className="num mt-0.5 text-[11.5px] text-[var(--color-ink-3)]">{currentUser.email}</p>
          </div>
          <div className="border-t border-[var(--color-hairline)]" />
          <div className="flex flex-col p-1">
            <button
              type="button"
              className="flex items-center gap-2 rounded-[6px] px-2.5 py-2 text-[13px] text-[var(--color-ink-2)] transition-colors hover:bg-[#f7f8fa] hover:text-[var(--color-ink)]"
            >
              <User size={13} strokeWidth={1.75} />
              Account settings
            </button>
            <button
              type="button"
              onClick={() => { setOpen(false); onLogout(); }}
              className="flex items-center gap-2 rounded-[6px] px-2.5 py-2 text-[13px] text-[var(--color-ink-2)] transition-colors hover:bg-[#fef3f2] hover:text-[#b91c1c]"
            >
              <LogOut size={13} strokeWidth={1.75} />
              Log out
            </button>
          </div>
        </div>
      )}

      {/* Chip */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        title={collapsed ? currentUser.name : undefined}
        className={
          "flex w-full items-center rounded-[8px] border border-[var(--color-hairline)] bg-white transition-colors hover:bg-[#fafbfd] " +
          (collapsed ? "justify-center p-1.5" : "gap-2.5 px-2 py-1.5")
        }
      >
        <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-[var(--color-accent-tint)] text-[11.5px] font-semibold text-[var(--color-accent)]">
          {currentUser.initials}
        </span>
        {!collapsed && (
          <>
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-[12.5px] font-medium text-[var(--color-ink)]">
                {currentUser.name}
              </p>
              <p className="truncate text-[11px] text-[var(--color-ink-3)]">
                {currentUser.business}
              </p>
            </div>
            <ChevronUp
              size={12}
              strokeWidth={2}
              className={"shrink-0 text-[var(--color-ink-3)] transition-transform " + (open ? "rotate-180" : "")}
            />
          </>
        )}
      </button>
    </div>
  );
}

interface SidebarProps {
  activeKey?: string;
  onNav?: (key: string) => void;
  onLogout?: () => void;
  approvalsCount?: number;
}

export default function Sidebar({ activeKey, onNav, onLogout, approvalsCount }: SidebarProps) {
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
        {navTop.map(({ key, active, badge, ...item }) => (
          <NavItem
            key={key}
            {...item}
            badge={key === "approvals" && approvalsCount != null ? approvalsCount : badge}
            active={activeKey != null ? activeKey === key : active}
            onClick={() => onNav?.(key)}
            collapsed={collapsed}
          />
        ))}
      </nav>

      <div className="flex-1" />

      <nav className="flex flex-col gap-0.5 px-2 pb-3">
        <NavItem icon={Settings} label="Settings" collapsed={collapsed} />
      </nav>

      <div className="mx-3 border-t border-[var(--color-hairline)]" />

      <AccountChip collapsed={collapsed} onLogout={onLogout ?? (() => {})} />
    </aside>
  )
}
