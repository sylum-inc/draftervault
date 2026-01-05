# Draft Vault Mobile Architecture

## Overview

This document outlines the architecture for rebuilding Draft Vault as a native mobile application using React Native. The mobile app will be a complete rebuild, not a wrapper around the existing web application.

## Technology Stack

### Core Framework

- **React Native** 0.73+ (latest stable)
- **TypeScript** 5.x for type safety
- **Expo** (managed workflow for faster development, can eject if needed)

### Navigation

- **React Navigation** 6.x
  - Native Stack Navigator for screen navigation
  - Bottom Tab Navigator for main app navigation
  - Drawer Navigator for settings/profile

### State Management

- **Zustand** - Lightweight state management (already familiar patterns)
- **React Query / TanStack Query** - Server state, caching, and sync

### UI Framework

- **React Native Paper** or **Tamagui** - Material Design / Cross-platform styling
- **NativeWind** - Tailwind CSS for React Native (familiar styling approach)
- **React Native Reanimated** - Smooth animations
- **React Native Gesture Handler** - Touch interactions

### Data & Storage

- **AsyncStorage** - Simple key-value storage
- **MMKV** - Fast, encrypted storage for sensitive data (API keys)
- **WatermelonDB** or **Realm** - Local database for player data

### AI Integration

- Reuse existing AI service architecture from web
- Same Anthropic/OpenAI integration
- Secure API key storage with MMKV

## Project Structure

```
draft-vault-mobile/
├── app/                          # Expo Router (file-based routing)
│   ├── (tabs)/                   # Tab-based navigation
│   │   ├── index.tsx             # Home/Dashboard
│   │   ├── draft.tsx             # Draft Room
│   │   ├── rankings.tsx          # Player Rankings
│   │   ├── roster.tsx            # My Roster
│   │   └── ai.tsx                # AI Assistant
│   ├── player/[id].tsx           # Player Details
│   ├── settings/                 # Settings screens
│   └── _layout.tsx               # Root layout
├── src/
│   ├── components/
│   │   ├── ui/                   # Base UI components
│   │   │   ├── Button.tsx
│   │   │   ├── Card.tsx
│   │   │   ├── Badge.tsx
│   │   │   └── ...
│   │   ├── player/               # Player-related components
│   │   │   ├── PlayerCard.tsx
│   │   │   ├── PlayerRow.tsx
│   │   │   ├── PlayerStats.tsx
│   │   │   └── PlayerComparison.tsx
│   │   ├── draft/                # Draft components
│   │   │   ├── DraftBoard.tsx
│   │   │   ├── DraftPick.tsx
│   │   │   ├── DraftTimer.tsx
│   │   │   └── DraftQueue.tsx
│   │   ├── ai/                   # AI components
│   │   │   ├── AIChat.tsx
│   │   │   ├── AIRecommendations.tsx
│   │   │   └── AIPlayerAnalysis.tsx
│   │   └── charts/               # Data visualization
│   │       ├── SpiderChart.tsx
│   │       ├── ProjectionChart.tsx
│   │       └── TrendChart.tsx
│   ├── services/
│   │   ├── ai/                   # AI Service (shared with web)
│   │   │   ├── types.ts
│   │   │   ├── aiService.ts
│   │   │   └── index.ts
│   │   ├── api/                  # API services
│   │   ├── storage/              # Local storage services
│   │   └── sync/                 # Data sync services
│   ├── hooks/
│   │   ├── useAI.ts              # AI hook (shared logic)
│   │   ├── useDraft.ts
│   │   ├── usePlayer.ts
│   │   └── useRoster.ts
│   ├── store/                    # Zustand stores
│   │   ├── draftStore.ts
│   │   ├── settingsStore.ts
│   │   └── userStore.ts
│   ├── data/                     # Player database (shared with web)
│   │   ├── playerDatabase/
│   │   └── types.ts
│   ├── styles/
│   │   ├── tokens.ts             # Design tokens
│   │   ├── theme.ts              # Theme configuration
│   │   └── bloomberg-sleeper.ts  # Bloomberg/Sleeper theme
│   └── utils/
│       ├── formatting.ts
│       ├── calculations.ts
│       └── constants.ts
├── assets/
│   ├── images/
│   ├── fonts/
│   └── icons/
├── app.json                      # Expo configuration
├── eas.json                      # EAS Build configuration
├── tailwind.config.js            # NativeWind config
└── tsconfig.json
```

## Design System - Bloomberg Terminal + Sleeper Hybrid

### Color Tokens

```typescript
// src/styles/tokens.ts
export const colors = {
  // Bloomberg Terminal
  bloomberg: {
    black: '#050505',
    dark: '#0d0f12',
    panel: '#14171c',
    border: '#262b33',
    orange: '#ff8c00',
    amber: '#ffb400',
    text: '#d9d9d9',
    textMuted: '#8c8c8c',
  },
  // Sleeper Fantasy
  sleeper: {
    bg: '#161a22',
    card: '#1e222a',
    primary: '#7c5cff',
    accent: '#00d4ff',
    success: '#2ecc71',
    warning: '#f1c40f',
    error: '#e74c3c',
  },
  // Position Colors
  position: {
    qb: '#ff8c00',
    rb: '#2ecc71',
    wr: '#3498db',
    te: '#9b59b6',
    k: '#f1c40f',
    dst: '#e74c3c',
    flex: '#8e44ad',
  },
  // Data Colors
  data: {
    positive: '#2ecc71',
    negative: '#e74c3c',
    neutral: '#f1c40f',
  },
};

export const typography = {
  terminal: {
    fontFamily: 'JetBrainsMono',
    fontSize: 12,
    lineHeight: 18,
  },
  heading: {
    fontFamily: 'Inter-Bold',
    fontSize: 24,
    lineHeight: 32,
  },
  body: {
    fontFamily: 'Inter-Regular',
    fontSize: 14,
    lineHeight: 20,
  },
};
```

### Component Examples

#### Player Card (Terminal Style)

```tsx
// src/components/player/PlayerCard.tsx
import { View, Text, Pressable } from 'react-native';
import { styled } from 'nativewind';

interface PlayerCardProps {
  player: Player;
  onPress: () => void;
  variant?: 'terminal' | 'sleeper';
}

export function PlayerCard({ player, onPress, variant = 'terminal' }: PlayerCardProps) {
  return (
    <Pressable
      onPress={onPress}
      className="bg-bloomberg-panel border-bloomberg-border rounded-lg border p-3"
    >
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-3">
          <View className={`rounded px-2 py-1 ${getPositionColor(player.position)}`}>
            <Text className="font-terminal text-xs font-bold text-white">{player.position}</Text>
          </View>
          <View>
            <Text className="font-terminal text-bloomberg-text text-sm font-medium">
              {player.name}
            </Text>
            <Text className="font-terminal text-bloomberg-textMuted text-xs">
              {player.team} • ADP {player.adp}
            </Text>
          </View>
        </View>
        <View className="items-end">
          <Text className="font-terminal-data text-bloomberg-amber text-lg font-bold">
            {player.projectedPoints}
          </Text>
          <Text className="font-terminal text-bloomberg-textMuted text-xs">PROJ</Text>
        </View>
      </View>
    </Pressable>
  );
}
```

## Screen Designs

### 1. Dashboard / Home

- Quick stats overview (draft position, roster status)
- AI recommendations preview
- Recent activity feed
- Quick actions (Start Draft, View Rankings, AI Chat)

### 2. Draft Room

- Live draft board with Bloomberg terminal grid styling
- Real-time pick tracking
- AI recommendations panel (collapsible)
- My Picks summary
- Quick player search

### 3. Player Rankings

- Sortable/filterable player list
- Position filters (QB, RB, WR, TE, K, DST)
- Terminal-style data display
- Tap for player details modal

### 4. Player Details

- Full-screen player profile
- Stats visualization (charts)
- AI analysis (on-demand)
- Comparison tool
- Add to queue/favorites

### 5. My Roster

- Current roster display
- Projected points
- Roster construction analysis
- Trade analyzer access

### 6. AI Assistant

- Full chat interface
- Context-aware recommendations
- Natural language queries
- Voice input (optional)

### 7. Settings

- AI configuration (API keys)
- League settings
- Scoring format
- Theme preferences
- Data sync options

## Native Features

### Push Notifications

- Draft pick alerts
- Trade offers
- Player news/injuries
- AI insights

### Haptic Feedback

- Button presses
- Draft picks
- Swipe actions

### Offline Support

- Local player database
- Cached rankings
- Offline draft mode (practice)

### Biometric Authentication

- Protect AI API keys
- Premium features access

## Shared Code Strategy

### Code Sharing Between Web and Mobile

1. **AI Service Layer** - 100% shareable
   - `src/services/ai/types.ts`
   - `src/services/ai/aiService.ts`
   - Core business logic

2. **Data Models** - 100% shareable
   - `src/data/playerDatabase/`
   - Type definitions
   - Utility functions

3. **Hooks** - Partially shareable
   - Core hook logic can be shared
   - UI-specific hooks differ

4. **Components** - Not shareable
   - Completely different UI frameworks
   - Platform-specific interactions

### Monorepo Structure (Optional)

```
draft-vault/
├── packages/
│   ├── shared/               # Shared types, utilities, services
│   │   ├── src/
│   │   │   ├── ai/
│   │   │   ├── data/
│   │   │   └── utils/
│   │   └── package.json
│   ├── web/                  # Current React web app
│   │   ├── src/
│   │   └── package.json
│   └── mobile/               # React Native app
│       ├── app/
│       ├── src/
│       └── package.json
├── package.json              # Root workspace
└── turbo.json               # Turborepo config
```

## Build & Deployment

### Development

```bash
# Start development server
npx expo start

# Run on iOS simulator
npx expo run:ios

# Run on Android emulator
npx expo run:android
```

### Production Builds (EAS Build)

```bash
# iOS build
eas build --platform ios --profile production

# Android build
eas build --platform android --profile production
```

### App Store Submission

#### iOS (Apple App Store)

- Apple Developer Account ($99/year)
- App Store Connect configuration
- TestFlight for beta testing
- Review guidelines compliance

#### Android (Google Play Store)

- Google Play Developer Account ($25 one-time)
- Google Play Console configuration
- Internal/Closed/Open testing tracks

## Timeline Estimates

### Phase 1: Foundation (Core Infrastructure)

- Project setup with Expo
- Design system implementation
- Navigation structure
- Base UI components

### Phase 2: Core Features

- Player rankings screen
- Player details modal
- Basic draft board
- Local data storage

### Phase 3: Draft Experience

- Live draft room
- Pick tracking
- Queue management
- Draft results

### Phase 4: AI Integration

- AI service integration
- Chat interface
- Recommendations
- Player analysis

### Phase 5: Polish & Launch

- Performance optimization
- Offline support
- Push notifications
- App Store submission

## Key Considerations

### Performance

- Virtualized lists for large player datasets
- Image caching and optimization
- Minimal re-renders with proper memoization
- Background data sync

### Security

- Encrypted storage for API keys
- No sensitive data in JS bundle
- Certificate pinning for API calls
- Biometric authentication option

### Accessibility

- VoiceOver/TalkBack support
- Dynamic type sizing
- High contrast mode
- Haptic feedback cues

### Testing

- Jest for unit tests
- Detox for E2E tests
- Maestro for UI testing
- Manual device testing

## Next Steps

1. Initialize React Native project with Expo
2. Set up NativeWind for Tailwind styling
3. Implement base UI component library
4. Port AI service layer
5. Build core screens iteratively
6. Integrate AI features
7. Optimize and polish
8. Beta testing
9. App Store submission
