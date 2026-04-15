# Planning Guide

HypnoSleep is a mobile-first progressive web app designed to help users access sleep-focused audio content and track their sleep journey.

**Experience Qualities**: 
1. **Calm** - The interface should feel serene and relaxing, preparing users for sleep through gentle interactions and soothing visuals
2. **Intuitive** - Navigation should be effortless with a familiar bottom tab bar pattern that requires minimal cognitive load
3. **Immersive** - Dark theme reduces eye strain and creates a cocoon-like environment perfect for evening/bedtime use

**Complexity Level**: Light Application (multiple features with basic state)
This is a shell application with multiple navigation sections and basic state management for tab navigation, establishing the foundation for future sleep content features.

## Essential Features

**Tab Navigation System**
- Functionality: Bottom-mounted tab bar with 5 sections (Home, Library, Create, Progress, Profile)
- Purpose: Provides quick access to all major app sections with thumb-friendly mobile navigation
- Trigger: User taps any tab icon
- Progression: Tap tab → Visual feedback (purple glow) → Smooth fade transition → New view renders
- Success criteria: All tabs respond instantly, active state is visually clear, transitions feel fluid

**Visual State Feedback**
- Functionality: Active tab displays purple glow effect
- Purpose: Provides clear wayfinding so users always know their current location
- Trigger: Tab becomes active (initial load or user navigation)
- Progression: Tab activation → Glow animation applies → Icon/label color shifts to accent purple
- Success criteria: Active state is immediately obvious, glow effect is visible but not harsh

**Page Transitions**
- Functionality: Smooth fade animations between different tab views
- Purpose: Creates continuity and polish, reducing jarring context switches
- Trigger: Tab navigation occurs
- Progression: Tab tap → Current view fades out → New view fades in → Content ready
- Success criteria: Transitions feel smooth and quick (200-300ms), no layout shift or flash

## Edge Case Handling

- **Rapid Tab Switching**: Debounce or queue transitions to prevent animation overlap/jank
- **Deep Link Navigation**: App handles direct URLs to specific tabs and sets correct active state
- **Orientation Change**: Layout adapts gracefully between portrait and landscape modes
- **Small Screens**: Tab bar remains accessible on very small devices (320px width)

## Design Direction

The design should evoke a sense of nighttime tranquility and cosmic serenity - imagine stargazing on a clear night or the deep calm before sleep. Visual elements should feel soft, gentle, and hypnotic without being overly mystical.

## Color Selection

Deep space darkness with vibrant purple accents creates a sleep-optimized interface that reduces blue light while maintaining visual interest.

- **Primary Color**: Deep Purple (#7c5cfc / oklch(0.58 0.18 285)) - Represents the hypnotic, calming energy and serves as the main brand accent for interactive elements
- **Secondary Colors**: 
  - Deep Navy Background (#0a0a1a / oklch(0.08 0.02 285)) - Primary surface creating maximum contrast reduction
  - Card/Surface (#12122a / oklch(0.12 0.03 285)) - Slightly elevated surfaces for content cards
- **Accent Color**: Vibrant Purple (#7c5cfc) - Used for active states, CTAs, and glow effects
- **Foreground/Background Pairings**: 
  - Background (#0a0a1a): Light text (#f5f5ff / oklch(0.97 0.01 285)) - Ratio 14.2:1 ✓
  - Card (#12122a): Light text (#f5f5ff) - Ratio 12.8:1 ✓
  - Accent Purple (#7c5cfc): White (#ffffff) - Ratio 5.1:1 ✓

## Font Selection

Typography should feel modern and calming with excellent readability in low-light conditions, using a clean sans-serif with slightly relaxed spacing.

- **Typographic Hierarchy**: 
  - H1 (Screen Titles): Inter SemiBold / 24px / -0.02em letter spacing
  - H2 (Section Headers): Inter Medium / 18px / -0.01em letter spacing  
  - Body: Inter Regular / 15px / 1.6 line height / normal letter spacing
  - Tab Labels: Inter Medium / 11px / 0.02em letter spacing (slightly expanded for clarity)

## Animations

Animations should enhance the calming atmosphere - slow fades for transitions (250ms ease-in-out), gentle glows for active states with subtle pulse, smooth scaling on touch interactions. All animations serve functional purposes: confirming interactions, guiding attention, and maintaining spatial continuity.

## Component Selection

- **Components**: 
  - Custom bottom tab bar (no direct shadcn equivalent) with TouchableOpacity-style feedback
  - Layout wrappers using flex/grid for responsive structure
  - No dialogs or heavy components needed for initial shell
  
- **Customizations**: 
  - Custom TabBar component with glow effect using box-shadow and CSS filters
  - Custom page transition wrapper using framer-motion AnimatePresence
  - Tab icons sized at 24px for main tabs, 32px for center Create button
  
- **States**: 
  - Tab buttons: default (muted gray), hover (lighter gray), active (purple with glow), pressed (slight scale down)
  - Transitions: 250ms opacity fade for page content
  - Active glow: soft purple shadow with subtle animated pulse
  
- **Icon Selection**: 
  - Home: Moon (representing sleep/night)
  - Library: BookOpen or Books (content collection)
  - Create: PlusCircle (emphasized center action)
  - Progress: ChartBar or TrendUp (tracking/analytics)
  - Profile: User (personal settings)
  
- **Spacing**: 
  - Tab bar: h-16 (64px) with safe-area-inset-bottom for notched devices
  - Icon spacing: gap-1 (4px) between icon and label
  - Tab bar padding: px-2 (8px) horizontal, pb-safe
  - Content area: p-4 (16px) on mobile, p-6 (24px) on tablet+
  
- **Mobile**: 
  - Bottom tab bar is mobile-first, always visible and fixed
  - Tab bar uses 100% width with equal distribution via flex
  - Content area has bottom padding equal to tab bar height to prevent overlap
  - Touch targets minimum 48px (using p-3 around 24px icons)
  - Landscape mode: tab bar remains bottom-fixed, content scrolls
