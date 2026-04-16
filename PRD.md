# Planning Guide

HypnoSleep is a mobile-first progressive web app designed to help users access sleep-focused audio content and track their sleep journey.

**Experience Qualities**: 
1. **Calm** - The interface should feel serene and relaxing, preparing users for sleep through gentle interactions and soothing visuals
2. **Intuitive** - Navigation should be effortless with a familiar bottom tab bar pattern that requires minimal cognitive load
3. **Immersive** - Dark theme reduces eye strain and creates a cocoon-like environment perfect for evening/bedtime use

**Complexity Level**: Light Application (multiple features with basic state)
This is a shell application with multiple navigation sections and basic state management for tab navigation, onboarding flow, and splash screen, establishing the foundation for future sleep content features.

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

**Slide-Up Modal**
- Functionality: Reusable bottom sheet modal with drag-to-dismiss capability
- Purpose: Presents secondary content and forms without leaving current context
- Trigger: User taps button to open modal or completes an action requiring input
- Progression: Button tap → Backdrop blur appears → Modal slides up with spring animation → User interacts → Drag down or tap backdrop → Modal dismisses
- Success criteria: Spring animation feels natural, backdrop blur creates depth, drag gesture is responsive

**Toast Notification System**
- Functionality: Non-blocking pill-shaped notifications at top-center with auto-dismiss
- Purpose: Provides instant feedback for actions without disrupting user flow
- Trigger: Success/error/info event occurs in the app
- Progression: Event fires → Toast springs in from top → Displays for 3 seconds → Auto-dismisses with fade → Stacks up to 3 toasts vertically
- Success criteria: Toasts are noticeable but don't block content, variants are clearly distinguishable, multiple toasts stack gracefully

**Onboarding Carousel**
- Functionality: 3-step swipeable welcome carousel introducing app features with animated visuals
- Purpose: Educates first-time users about key app benefits and value proposition
- Trigger: First app launch after splash screen (tracked via persistent storage)
- Progression: Splash dismisses → Carousel appears → User swipes or taps dots to navigate slides → Final slide shows "Get Started" button → Tap button → Carousel dismisses → Main app appears → Preference saved to skip on future launches
- Success criteria: Smooth spring animations between slides, drag gestures feel responsive, animations are engaging without being distracting, only shows once per user

## Edge Case Handling

- **Rapid Tab Switching**: Debounce or queue transitions to prevent animation overlap/jank
- **Deep Link Navigation**: App handles direct URLs to specific tabs and sets correct active state
- **Orientation Change**: Layout adapts gracefully between portrait and landscape modes
- **Small Screens**: Tab bar remains accessible on very small devices (320px width)
- **Modal Scroll Overflow**: Long modal content scrolls internally while handle remains accessible
- **Toast Stacking**: Maximum of 3 toasts displayed, oldest is removed when limit exceeded
- **Background Interaction**: Modal backdrop prevents interaction with underlying content
- **Onboarding Persistence**: User preference stored in KV to prevent repeated onboarding on subsequent launches
- **Swipe Gesture Conflicts**: Onboarding carousel drag gestures don't interfere with browser navigation swipes

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

Animations should enhance the calming atmosphere - slow fades for transitions (250ms ease-in-out), gentle glows for active states with subtle pulse, smooth scaling on touch interactions. All animations serve functional purposes: confirming interactions, guiding attention, and maintaining spatial continuity. The onboarding carousel features playful icon animations (brain with sparkles, rotating moon with stars, ascending graph) that are engaging without being overwhelming, using spring physics for natural-feeling slide transitions.

## Component Selection

- **Components**: 
  - Custom bottom tab bar (no direct shadcn equivalent) with TouchableOpacity-style feedback
  - SlideUpModal component with framer-motion spring animations and drag gestures
  - ToastProvider context with AnimatePresence for toast management
  - OnboardingCarousel component with framer-motion drag gestures and spring transitions
  - Layout wrappers using flex/grid for responsive structure
  
- **Customizations**: 
  - Custom TabBar component with glow effect using box-shadow and CSS filters
  - Custom page transition wrapper using framer-motion AnimatePresence
  - SlideUpModal with backdrop blur overlay (backdrop-filter) and drag handle
  - Toast pills with variant-specific colors (green success, red error, purple info)
  - OnboardingCarousel with swipeable slides, animated icons (Brain, Moon, TrendUp from Phosphor), and clickable dot indicators
  - Tab icons sized at 24px for main tabs, 32px for center Create button
  
- **States**: 
  - Tab buttons: default (muted gray), hover (lighter gray), active (purple with glow), pressed (slight scale down)
  - Transitions: 250ms opacity fade for page content
  - Active glow: soft purple shadow with subtle animated pulse
  - Modal: slide-up animation with spring physics (damping: 30, stiffness: 300)
  - Toast: spring entrance animation with auto-dismiss fade after 3s
  - Backdrop: blur(12px) with semi-transparent overlay
  - Carousel slides: spring animation (stiffness: 300, damping: 30), drag-responsive with elastic constraints
  - Carousel dots: width animates from 8px (inactive) to 32px (active) with color change
  
- **Icon Selection**: 
  - Home: Moon (representing sleep/night)
  - Library: BookOpen or Books (content collection)
  - Create: PlusCircle (emphasized center action)
  - Progress: ChartBar or TrendUp (tracking/analytics)
  - Profile: User (personal settings)
  - Onboarding: Brain (AI-powered), Moon (sleep), TrendUp (transformation), Sparkle (magic/AI), Star (night/quality)
  
- **Spacing**: 
  - Tab bar: h-16 (64px) with safe-area-inset-bottom for notched devices
  - Icon spacing: gap-1 (4px) between icon and label
  - Tab bar padding: px-2 (8px) horizontal, pb-safe
  - Content area: p-4 (16px) on mobile, p-6 (24px) on tablet+
  - Carousel: px-8 (32px) horizontal padding for slide content, pb-16 (64px) for dots area
  
- **Mobile**: 
  - Bottom tab bar is mobile-first, always visible and fixed
  - Tab bar uses 100% width with equal distribution via flex
  - Content area has bottom padding equal to tab bar height to prevent overlap
  - Touch targets minimum 48px (using p-3 around 24px icons)
  - Landscape mode: tab bar remains bottom-fixed, content scrolls
  - Carousel: full-screen overlay with swipe gestures optimized for touch, elastic drag constraints prevent over-scrolling
