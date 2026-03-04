# Ralph Dashboard - Design System

## Design File
- Pencil file: `pencil-ralph.pen`
- Screens: 3 total (Dashboard Main, Detail Drawer - Detail Tab, Detail Drawer - Logs Tab)

## Design Philosophy — Claude-Inspired Light Theme

Warm, approachable aesthetic inspired by Claude.ai's design language:
- Cream/beige backgrounds instead of clinical white
- Terracotta accent (#C15F3C) for warmth and brand identity
- Serif headings (Cormorant Garamond) for editorial refinement
- Subtle shadows and soft borders for depth without harshness
- White cards on warm canvas for clear content hierarchy

## Color System (Light Mode)

| Token | Hex | Usage |
|-------|-----|-------|
| `bg-page` | #F5F5F0 | Page background (warm cream) |
| `bg-sidebar` | #EDEDEA | Sidebar, inset surfaces |
| `bg-card` | #FFFFFF | Cards, drawer, white surfaces |
| `bg-hover` | #ECEAE5 | Hover states |
| `border` | #E0DDD5 | Default borders (warm gray) |
| `border-accent` | #C15F3C | Active/focus borders |
| `accent` | #C15F3C | Primary accent (terracotta) - active states, running indicators, CTAs |
| `accent-dim` | #D4835F | Dimmed accent for subtle accents |
| `accent-light` | #FEF0E8 | Accent background tint (badges, highlights) |
| `text-primary` | #1A1A18 | Headlines, primary content (warm near-black) |
| `text-secondary` | #666666 | Descriptions, secondary text |
| `text-tertiary` | #999999 | Labels, section headers |
| `text-muted` | #B1ADA1 | Placeholders, inactive elements (cloudy) |
| `success` | #22C55E | Completed states, positive indicators |
| `success-light` | #ECFDF5 | Success background tint |
| `warning` | #F59E0B | In-progress warnings |
| `warning-light` | #FFFBEB | Warning background tint |
| `error` | #EF4444 | Failed states, errors |
| `error-light` | #FEF2F2 | Error background tint |

## Typography

| Role | Font | Weight | Size |
|------|------|--------|------|
| Page Title / Drawer Title | Cormorant Garamond | 600-700 | 18-20px |
| Start Node Title | Cormorant Garamond | 600 | 16px |
| Body / UI | Inter | 400-600 | 12-13px |
| Section Labels | Inter | 600 | 11px (letter-spacing: 1px) |
| Code / Monospace | JetBrains Mono | 400-500 | 10-11px |
| Badges / Tags | JetBrains Mono | 500-600 | 10-11px |
| Story IDs | JetBrains Mono | 600-700 | 10-13px |

### Google Fonts Import
```css
@import url('https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600;700&family=Inter:wght@300;400;500;600;700&display=swap');
```

## Spacing

| Context | Value |
|---------|-------|
| Page padding | 0 (sidebar flush) |
| Header height | 56px |
| Sidebar width | 64px (icon rail) |
| Flow canvas padding | 40px |
| Card padding | 12-20px |
| Drawer width | ~40% viewport (560px at 1440) |
| Section gap | 20px |
| Element gap | 8-12px |
| Micro gap | 2-4px |

## Corner Radius

| Element | Radius |
|---------|--------|
| Story Nodes | 12px |
| Start node icon / Panels | 12px |
| Cards (large) | 16px |
| Small buttons / inputs | 8px |
| Badges / Pills | 100px (full round) |
| Logo | 10px |
| Checkboxes | 4px |

## Shadows

| Element | Shadow |
|---------|--------|
| Story nodes (default) | `0 2px 12px rgba(0,0,0,0.03)` |
| Pending nodes | `0 1px 4px rgba(0,0,0,0.02)` |
| Running node | `0 0 16px 2px rgba(193,95,60,0.15)` (accent glow) |
| Drawer | `-8px 0 24px rgba(0,0,0,0.04)` |

## Component Patterns

### Story Node States
- **Completed**: green border (#22C55E33, 1.5px), check icon in success-light circle, green story ID
- **Running**: accent border (#C15F3C, 1.5px), warm terracotta glow shadow, loader icon in accent-light circle, accent story ID, elapsed time
- **Pending**: default border (#E0DDD5, 1px), muted dot in bg-page circle, muted story ID and title
- **Failed**: red border (#EF444433), x icon in error-light circle, red story ID

### Sidebar (Icon Rail)
- Width: 64px, vertical layout, bg-sidebar (#EDEDEA)
- Right border: 1px #E0DDD5
- Top: Logo (40x40, accent bg #C15F3C, white "R" in Cormorant Garamond), separator, nav icons (44x44)
- Bottom: Settings icon, status dot (10x10, green)
- Active nav: accent fill bg (#C15F3C), white icon
- Inactive nav: transparent bg, tertiary icon (#999999)

### Header Bar
- Height: 56px, white bg (#FFFFFF), bottom border 1px #E0DDD5
- Left: Project name (Cormorant Garamond 18px 600), branch badge (pill, bg-page, mono 11px)
- Right: Status badge (success-light bg, pill), iteration badge (pill), archive switcher (border button with icon)

### Detail Drawer
- Right-side sheet, 560px width, white bg
- Left border: 1px #E0DDD5, soft left shadow
- Header: Story ID (accent mono #C15F3C 13px 700), status badge (accent-light bg, pill), close button, title (Cormorant Garamond 20px 600)
- 4 Tabs: 详情, 日志, Git, 时间线
- Active tab: accent text + icon (#C15F3C), accent bottom border (2px)
- Inactive tab: muted text + icon (#B1ADA1)

### Log Output Area
- Background: #FAFAF7 (warm off-white, lighter than page)
- Font: JetBrains Mono 11px, lineHeight 1.6
- Color coding: muted (#B1ADA1) = commands, secondary (#666666) = info, accent (#C15F3C) = story picks, green (#22C55E) = additions, yellow (#F59E0B) = warnings
- Live indicator: accent colored cursor block + accent dot

## Icon System
- Library: Lucide (outline, consistent stroke)
- Nav: layout-dashboard, settings
- Status: check (done), loader (running), pause
- Actions: x (close), pencil (edit), chevron-down
- Git: git-branch
- Files: file-text, terminal, archive, flag, play, timer

## Animation Guidelines
- Running nodes: warm glow pulse effect (CSS `animation: pulse 2s infinite`, terracotta shadow)
- Tab transitions: 200ms ease
- Drawer slide: 300ms ease-out
- Status dot: subtle pulse for running state
- Respect `prefers-reduced-motion`
