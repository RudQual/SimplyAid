import {
  LayoutDashboard, Bell, AlertTriangle, FilePlus2, ClipboardCheck, Stethoscope, ScanLine, Boxes, Package, CalendarClock,
  ArrowLeftRight, ShieldCheck, SearchCheck, FileBarChart, LineChart, Users, Building2, History, Settings, QrCode, UserRound
} from 'lucide-react';

/**
 * Sidebar navigation. `roles` limits visibility (omit = everyone).
 * The server enforces the same permissions on every endpoint.
 */
export const NAV_SECTIONS = [
  {
    title: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/notifications', label: 'Notifications', icon: Bell, badge: 'notifications' }
    ]
  },
  {
    title: 'Operations',
    items: [
      { to: '/incidents/new', label: 'Report incident', icon: FilePlus2, roles: ['employee', 'manager'] },
      { to: '/incidents', label: 'Incidents', icon: AlertTriangle, end: true },
      { to: '/reviews', label: 'Review queue', icon: ClipboardCheck, roles: ['doctor', 'manager', 'admin'] },
      { to: '/treatments', label: 'Treatments', icon: Stethoscope, roles: ['doctor', 'admin'] },
      { to: '/qr-scan', label: 'QR scan', icon: ScanLine }
    ]
  },
  {
    title: 'Inventory',
    items: [
      { to: '/kits', label: 'First aid kits', icon: Boxes, roles: ['admin', 'doctor', 'manager'] },
      { to: '/inventory', label: 'Inventory', icon: Package, roles: ['admin', 'doctor', 'manager'] },
      { to: '/expiry', label: 'Expiry tracking', icon: CalendarClock, roles: ['admin', 'doctor', 'manager'] },
      { to: '/stock-movements', label: 'Stock movements', icon: ArrowLeftRight, roles: ['admin', 'doctor', 'manager'] }
    ]
  },
  {
    title: 'Compliance',
    items: [
      { to: '/compliance', label: 'Compliance', icon: ShieldCheck, roles: ['admin', 'doctor', 'manager'] },
      { to: '/inspections', label: 'Inspections', icon: SearchCheck, roles: ['admin', 'doctor', 'manager'] },
      { to: '/reports', label: 'Reports', icon: FileBarChart, roles: ['admin', 'doctor', 'manager'] },
      { to: '/analytics', label: 'Analytics', icon: LineChart, roles: ['admin', 'doctor', 'manager'] }
    ]
  },
  {
    title: 'Administration',
    items: [
      { to: '/employees', label: 'People', icon: Users, roles: ['admin', 'doctor', 'manager'] },
      { to: '/departments', label: 'Departments', icon: Building2, roles: ['admin', 'doctor'] },
      { to: '/scan-history', label: 'Scan history', icon: QrCode, roles: ['admin', 'doctor', 'manager'] },
      { to: '/activity', label: 'Activity log', icon: History, roles: ['admin', 'doctor'] }
    ]
  },
  {
    title: 'Account',
    items: [
      { to: '/profile', label: 'My profile', icon: UserRound },
      { to: '/settings', label: 'Settings', icon: Settings }
    ]
  }
];

export const visibleSections = (role) => NAV_SECTIONS
  .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || i.roles.includes(role)) }))
  .filter((s) => s.items.length);
