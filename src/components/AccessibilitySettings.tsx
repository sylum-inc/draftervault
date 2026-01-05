import { useState, useEffect } from 'react';
import { Accessibility, Eye, Volume2, VolumeX, Keyboard, Moon, Sun, Contrast } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { prefersReducedMotion, prefersHighContrast } from '@/utils/accessibility';

interface AccessibilityPreferences {
  reducedMotion: boolean;
  highContrast: boolean;
  largeText: boolean;
  screenReaderAnnouncements: boolean;
  soundEnabled: boolean;
  fontSize: number;
  colorBlindMode: 'none' | 'protanopia' | 'deuteranopia' | 'tritanopia';
  keyboardShortcutsEnabled: boolean;
}

const DEFAULT_PREFERENCES: AccessibilityPreferences = {
  reducedMotion: false,
  highContrast: false,
  largeText: false,
  screenReaderAnnouncements: true,
  soundEnabled: true,
  fontSize: 100,
  colorBlindMode: 'none',
  keyboardShortcutsEnabled: true,
};

interface AccessibilitySettingsProps {
  onPreferencesChange?: (preferences: AccessibilityPreferences) => void;
}

export const AccessibilitySettings = ({ onPreferencesChange }: AccessibilitySettingsProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [preferences, setPreferences] = useState<AccessibilityPreferences>(() => {
    const saved = localStorage.getItem('draft-vault-a11y');
    if (saved) {
      return JSON.parse(saved);
    }
    return {
      ...DEFAULT_PREFERENCES,
      reducedMotion: prefersReducedMotion(),
      highContrast: prefersHighContrast(),
    };
  });

  useEffect(() => {
    localStorage.setItem('draft-vault-a11y', JSON.stringify(preferences));
    onPreferencesChange?.(preferences);
    applyPreferences(preferences);
  }, [preferences, onPreferencesChange]);

  const applyPreferences = (prefs: AccessibilityPreferences) => {
    const root = document.documentElement;

    // Reduced motion
    if (prefs.reducedMotion) {
      root.style.setProperty('--animation-duration', '0s');
      root.classList.add('reduce-motion');
    } else {
      root.style.removeProperty('--animation-duration');
      root.classList.remove('reduce-motion');
    }

    // High contrast
    if (prefs.highContrast) {
      root.classList.add('high-contrast');
    } else {
      root.classList.remove('high-contrast');
    }

    // Large text
    if (prefs.largeText) {
      root.classList.add('large-text');
    } else {
      root.classList.remove('large-text');
    }

    // Font size
    root.style.setProperty('--font-scale', `${prefs.fontSize / 100}`);

    // Color blind mode
    root.dataset.colorBlindMode = prefs.colorBlindMode;
  };

  const updatePreference = <K extends keyof AccessibilityPreferences>(
    key: K,
    value: AccessibilityPreferences[K]
  ) => {
    setPreferences(prev => ({ ...prev, [key]: value }));
  };

  const resetToDefaults = () => {
    setPreferences({
      ...DEFAULT_PREFERENCES,
      reducedMotion: prefersReducedMotion(),
      highContrast: prefersHighContrast(),
    });
  };

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Accessibility settings"
          title="Accessibility settings"
        >
          <Accessibility className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="modal-content max-w-lg">
        <DialogHeader>
          <DialogTitle className="gradient-text text-2xl flex items-center gap-2">
            <Accessibility className="w-6 h-6" />
            Accessibility Settings
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          {/* Visual Settings */}
          <Card className="glass-card">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Eye className="w-4 h-4" />
                Visual
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Reduced Motion */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Reduce Motion</Label>
                  <p className="text-xs text-muted-foreground">
                    Minimize animations and transitions
                  </p>
                </div>
                <Switch
                  checked={preferences.reducedMotion}
                  onCheckedChange={(value) => updatePreference('reducedMotion', value)}
                  aria-describedby="reduced-motion-desc"
                />
              </div>

              {/* High Contrast */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>High Contrast</Label>
                  <p className="text-xs text-muted-foreground">
                    Increase contrast for better visibility
                  </p>
                </div>
                <Switch
                  checked={preferences.highContrast}
                  onCheckedChange={(value) => updatePreference('highContrast', value)}
                />
              </div>

              {/* Large Text */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Large Text</Label>
                  <p className="text-xs text-muted-foreground">
                    Increase default text size
                  </p>
                </div>
                <Switch
                  checked={preferences.largeText}
                  onCheckedChange={(value) => updatePreference('largeText', value)}
                />
              </div>

              {/* Font Size Slider */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Text Size</Label>
                  <span className="text-sm text-muted-foreground">{preferences.fontSize}%</span>
                </div>
                <Slider
                  value={[preferences.fontSize]}
                  min={75}
                  max={150}
                  step={5}
                  onValueChange={([value]) => updatePreference('fontSize', value)}
                  aria-label="Text size"
                />
              </div>

              {/* Color Blind Mode */}
              <div className="space-y-2">
                <Label>Color Vision</Label>
                <Select
                  value={preferences.colorBlindMode}
                  onValueChange={(value) =>
                    updatePreference('colorBlindMode', value as AccessibilityPreferences['colorBlindMode'])
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Standard</SelectItem>
                    <SelectItem value="protanopia">Protanopia (Red-Blind)</SelectItem>
                    <SelectItem value="deuteranopia">Deuteranopia (Green-Blind)</SelectItem>
                    <SelectItem value="tritanopia">Tritanopia (Blue-Blind)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Audio Settings */}
          <Card className="glass-card">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                {preferences.soundEnabled ? (
                  <Volume2 className="w-4 h-4" />
                ) : (
                  <VolumeX className="w-4 h-4" />
                )}
                Audio
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Sound Effects */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Sound Effects</Label>
                  <p className="text-xs text-muted-foreground">
                    Play sounds for draft events
                  </p>
                </div>
                <Switch
                  checked={preferences.soundEnabled}
                  onCheckedChange={(value) => updatePreference('soundEnabled', value)}
                />
              </div>

              {/* Screen Reader Announcements */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Screen Reader Announcements</Label>
                  <p className="text-xs text-muted-foreground">
                    Announce draft picks and bids
                  </p>
                </div>
                <Switch
                  checked={preferences.screenReaderAnnouncements}
                  onCheckedChange={(value) => updatePreference('screenReaderAnnouncements', value)}
                />
              </div>
            </CardContent>
          </Card>

          {/* Keyboard Settings */}
          <Card className="glass-card">
            <CardHeader className="py-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Keyboard className="w-4 h-4" />
                Keyboard
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Keyboard Shortcuts */}
              <div className="flex items-center justify-between">
                <div>
                  <Label>Keyboard Shortcuts</Label>
                  <p className="text-xs text-muted-foreground">
                    Enable keyboard navigation shortcuts
                  </p>
                </div>
                <Switch
                  checked={preferences.keyboardShortcutsEnabled}
                  onCheckedChange={(value) => updatePreference('keyboardShortcutsEnabled', value)}
                />
              </div>

              {preferences.keyboardShortcutsEnabled && (
                <div className="p-3 rounded-lg bg-secondary/30 text-xs space-y-1">
                  <p className="font-medium mb-2">Available Shortcuts:</p>
                  <div className="grid grid-cols-2 gap-2">
                    <span className="text-muted-foreground">? - Help</span>
                    <span className="text-muted-foreground">B - Place bid</span>
                    <span className="text-muted-foreground">N - Nominate</span>
                    <span className="text-muted-foreground">Esc - Cancel</span>
                    <span className="text-muted-foreground">/ - Search</span>
                    <span className="text-muted-foreground">Tab - Navigate</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Reset Button */}
          <Button variant="outline" onClick={resetToDefaults} className="w-full">
            Reset to System Defaults
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AccessibilitySettings;
