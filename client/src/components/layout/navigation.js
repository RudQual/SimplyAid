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
    title: 'Overview', tkey: 'nav.overview',
    items: [
      { to: '/', label: 'Dashboard', tkey: 'nav.dashboard', icon: LayoutDashboard, end: true },
      { to: '/notifications', label: 'Notifications', tkey: 'nav.notifications', icon: Bell, badge: 'notifications' }
    ]
  },
  {
    title: 'Operations', tkey: 'nav.operations',
    items: [
      { to: '/incidents/new', label: 'Report incident', tkey: 'nav.reportIncident', icon: FilePlus2, roles: ['employee', 'manager'] },
      { to: '/incidents', label: 'Incidents', tkey: 'nav.incidents', icon: AlertTriangle, end: true },
      { to: '/reviews', label: 'Review queue', tkey: 'nav.reviews', icon: ClipboardCheck, roles: ['doctor', 'manager', 'admin'] },
      { to: '/treatments', label: 'Treatments', tkey: 'nav.treatments', icon: Stethoscope, roles: ['doctor', 'admin'] },
      { to: '/qr-scan', label: 'QR scan', tkey: 'nav.qrScan', icon: ScanLine }
    ]
  },
  {
    title: 'Inventory', tkey: 'nav.inventoryGroup',
    items: [
      { to: '/kits', label: 'First aid kits', tkey: 'nav.kits', icon: Boxes, roles: ['admin', 'doctor', 'manager'] },
      { to: '/inventory', label: 'Inventory', tkey: 'nav.inventory', icon: Package, roles: ['admin', 'doctor', 'manager'] },
      { to: '/expiry', label: 'Expiry tracking', tkey: 'nav.expiry', icon: CalendarClock, roles: ['admin', 'doctor', 'manager'] },
      { to: '/stock-movements', label: 'Stock movements', tkey: 'nav.stockMovements', icon: ArrowLeftRight, roles: ['admin', 'doctor', 'manager'] }
    ]
  },
  {
    title: 'Compliance', tkey: 'nav.complianceGroup',
    items: [
      { to: '/compliance', label: 'Compliance', tkey: 'nav.compliance', icon: ShieldCheck, roles: ['admin', 'doctor', 'manager'] },
      { to: '/inspections', label: 'Inspections', tkey: 'nav.inspections', icon: SearchCheck, roles: ['admin', 'doctor', 'manager'] },
      { to: '/reports', label: 'Reports', tkey: 'nav.reports', icon: FileBarChart, roles: ['admin', 'doctor', 'manager'] },
      { to: '/analytics', label: 'Analytics', tkey: 'nav.analytics', icon: LineChart, roles: ['admin', 'doctor', 'manager'] }
    ]
  },
  {
    title: 'Administration', tkey: 'nav.administration',
    items: [
      { to: '/employees', label: 'People', tkey: 'nav.people', icon: Users, roles: ['admin', 'doctor', 'manager'] },
      { to: '/departments', label: 'Departments', tkey: 'nav.departments', icon: Building2, roles: ['admin', 'doctor'] },
      { to: '/scan-history', label: 'Scan history', tkey: 'nav.scanHistory', icon: QrCode, roles: ['admin', 'doctor', 'manager'] },
      { to: '/activity', label: 'Activity log', tkey: 'nav.activity', icon: History, roles: ['admin', 'doctor'] }
    ]
  },
  {
    title: 'Account', tkey: 'nav.account',
    items: [
      { to: '/profile', label: 'My profile', tkey: 'nav.profile', icon: UserRound },
      { to: '/settings', label: 'Settings', tkey: 'nav.settings', icon: Settings }
    ]
  }
];

export const visibleSections = (role) => NAV_SECTIONS
  .map((s) => ({ ...s, items: s.items.filter((i) => !i.roles || i.roles.includes(role)) }))
  .filter((s) => s.items.length);
