import type { SVGProps, ReactNode } from "react";

type IconProps = Omit<SVGProps<SVGSVGElement>, "name"> & { size?: number | string; fill?: string };
type IconName = "activity"|"app-window"|"arrow-down"|"arrow-up"|"braces"|"check"|"chevron-down"|"circle-help"|"clock"|"archive"|"eye"|"download"|"refresh"|"code"|"cookie"|"copy"|"file-plus"|"folder-open"|"globe"|"grip"|"layers"|"pointer"|"play"|"plus"|"save"|"settings"|"shield-check"|"square"|"terminal"|"trash"|"zap"|"search"|"file-text"|"book"|"sun"|"moon"|"mouse-pointer";

const drawings: Record<IconName, ReactNode> = {
  activity: <path d="M3 12h4l3-8 4 16 3-8h4" />,
  "app-window": <><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M3 9h18M7 6.5h.01M10 6.5h.01"/></>,
  "arrow-down": <path d="M12 4v16m-7-7 7 7 7-7" />,
  "arrow-up": <path d="M12 20V4m-7 7 7-7 7 7" />,
  braces: <path d="M8 4H6a2 2 0 0 0-2 2v3a3 3 0 0 1-2 3 3 3 0 0 1 2 3v3a2 2 0 0 0 2 2h2m8-16h2a2 2 0 0 1 2 2v3a3 3 0 0 0 2 3 3 3 0 0 0-2 3v3a2 2 0 0 1-2 2h-2" />,
  check: <path d="m5 12 4 4L19 6" />,
  "chevron-down": <path d="m6 9 6 6 6-6" />,
  "circle-help": <><circle cx="12" cy="12" r="9"/><path d="M9.6 9a2.5 2.5 0 1 1 4.3 1.7c-1.2 1.1-1.9 1.3-1.9 3M12 17h.01"/></>,
  clock: <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>,
  archive: <><path d="M4 7h16v13H4zM3 4h18v3H3zM9 11h6"/></>,
  eye: <><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z"/><circle cx="12" cy="12" r="2.5"/></>,
  download: <><path d="M12 3v12m-5-5 5 5 5-5"/><path d="M4 17v3h16v-3"/></>,
  refresh: <><path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.5 9a7 7 0 0 1 12-2L20 12M4 12l2.5 5a7 7 0 0 0 12-2"/></>,
  code: <path d="m8 8-4 4 4 4m8-8 4 4-4 4m-3-11-2 14" />,
  cookie: <><path d="M20 13a8 8 0 1 1-9-9 3 3 0 0 0 4 4 3 3 0 0 0 5 5Z"/><path d="M8 12h.01M12 16h.01M8 8h.01"/></>,
  copy: <><rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"/></>,
  "file-plus": <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M12 12v6m-3-3h6"/></>,
  "folder-open": <><path d="M3 6a2 2 0 0 1 2-2h5l2 2h7a2 2 0 0 1 2 2v2H5l-2 9z"/><path d="M3 19h16l2-9H5z"/></>,
  globe: <><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18"/></>,
  grip: <><path d="M9 5h.01M15 5h.01M9 12h.01M15 12h.01M9 19h.01M15 19h.01" strokeWidth="3"/></>,
  layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 12 9 5 9-5M3 16l9 5 9-5"/></>,
  pointer: <path d="m5 3 14 10-7 1-3 7z" />,
  play: <path d="m7 4 13 8-13 8z" fill="currentColor" stroke="currentColor" />,
  plus: <path d="M12 5v14M5 12h14" />,
  save: <><path d="M5 3h12l4 4v14H3V3z"/><path d="M7 3v6h10V3M7 21v-8h10v8"/></>,
  settings: <><path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="m19.4 15 .1.1 1.2 1-1.5 2.6-1.5-.5a8 8 0 0 1-1.8 1l-.3 1.6h-3l-.3-1.6a8 8 0 0 1-1.8-1l-1.5.5-1.5-2.6 1.2-1a8 8 0 0 1 0-2l-1.2-1 1.5-2.6 1.5.5a8 8 0 0 1 1.8-1l.3-1.6h3l.3 1.6a8 8 0 0 1 1.8 1l1.5-.5 1.5 2.6-1.2 1a8 8 0 0 1 0 2Z"/></>,
  "shield-check": <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z"/><path d="m9 12 2 2 4-4"/></>,
  square: <rect x="4" y="4" width="16" height="16" rx="2" />,
  terminal: <><path d="m4 5 6 6-6 6M12 19h8"/></>,
  trash: <><path d="M3 6h18M8 6V4h8v2m3 0-1 14H6L5 6"/><path d="M10 10v6m4-6v6"/></>,
  zap: <path d="m13 2-3 8h7L9 22l2-9H5z" fill="currentColor" stroke="currentColor" />,
  search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
  "file-text": <><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><path d="M13 2v7h7M8 13h8M8 17h8"/></>,
  book: <><path d="M4 4a3 3 0 0 1 3-3h13v19H7a3 3 0 0 1-3-3z"/><path d="M4 17a3 3 0 0 1 3-3h13"/></>,
  sun: <><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></>,
  moon: <path d="M20.5 14A8.5 8.5 0 0 1 10 3.5 8.5 8.5 0 1 0 20.5 14Z" />,
  "mouse-pointer": <path d="m5 3 14 10-7 1-3 7z" />
};

function Icon({ name, size = 16, fill, className, ...props }: IconProps & { name: IconName }) {
  return <svg className={`animated-icon animated-icon--${name}${className ? ` ${className}` : ""}`} data-icon={name} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false" {...props}>
    {fill && name !== "play" && name !== "zap" ? <g fill={fill}>{drawings[name]}</g> : drawings[name]}
  </svg>;
}

export const Activity = (p: IconProps) => <Icon name="activity" {...p}/>;
export const AppWindow = (p: IconProps) => <Icon name="app-window" {...p}/>;
export const ArrowDown = (p: IconProps) => <Icon name="arrow-down" {...p}/>;
export const ArrowUp = (p: IconProps) => <Icon name="arrow-up" {...p}/>;
export const Braces = (p: IconProps) => <Icon name="braces" {...p}/>;
export const Check = (p: IconProps) => <Icon name="check" {...p}/>;
export const ChevronDown = (p: IconProps) => <Icon name="chevron-down" {...p}/>;
export const CircleHelp = (p: IconProps) => <Icon name="circle-help" {...p}/>;
export const Clock3 = (p: IconProps) => <Icon name="clock" {...p}/>;
export const Archive = (p: IconProps) => <Icon name="archive" {...p}/>;
export const Eye = (p: IconProps) => <Icon name="eye" {...p}/>;
export const Download = (p: IconProps) => <Icon name="download" {...p}/>;
export const RefreshCw = (p: IconProps) => <Icon name="refresh" {...p}/>;
export const Code2 = (p: IconProps) => <Icon name="code" {...p}/>;
export const Cookie = (p: IconProps) => <Icon name="cookie" {...p}/>;
export const Copy = (p: IconProps) => <Icon name="copy" {...p}/>;
export const FilePlus2 = (p: IconProps) => <Icon name="file-plus" {...p}/>;
export const FolderOpen = (p: IconProps) => <Icon name="folder-open" {...p}/>;
export const Globe2 = (p: IconProps) => <Icon name="globe" {...p}/>;
export const GripVertical = (p: IconProps) => <Icon name="grip" {...p}/>;
export const Layers3 = (p: IconProps) => <Icon name="layers" {...p}/>;
export const MousePointer2 = (p: IconProps) => <Icon name="pointer" {...p}/>;
export const Play = (p: IconProps) => <Icon name="play" {...p}/>;
export const Plus = (p: IconProps) => <Icon name="plus" {...p}/>;
export const Save = (p: IconProps) => <Icon name="save" {...p}/>;
export const Settings2 = (p: IconProps) => <Icon name="settings" {...p}/>;
export const ShieldCheck = (p: IconProps) => <Icon name="shield-check" {...p}/>;
export const Square = (p: IconProps) => <Icon name="square" {...p}/>;
export const Terminal = (p: IconProps) => <Icon name="terminal" {...p}/>;
export const Trash2 = (p: IconProps) => <Icon name="trash" {...p}/>;
export const Zap = (p: IconProps) => <Icon name="zap" {...p}/>;
export const Search = (p: IconProps) => <Icon name="search" {...p}/>;
export const FileText = (p: IconProps) => <Icon name="file-text" {...p}/>;
export const BookTemplate = (p: IconProps) => <Icon name="book" {...p}/>;
export const Sun = (p: IconProps) => <Icon name="sun" {...p}/>;
export const Moon = (p: IconProps) => <Icon name="moon" {...p}/>;
