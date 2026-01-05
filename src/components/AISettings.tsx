import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Brain, Key, Check, AlertTriangle, Sparkles, Zap, Shield, Eye, EyeOff } from 'lucide-react';
import type { AIProvider, AIConfig, AIFeatureFlags } from '@/services/ai/types';

interface AISettingsProps {
  isConfigured: boolean;
  currentProvider?: AIProvider | null;
  features: AIFeatureFlags;
  onConfigure: (config: AIConfig) => void;
  onClearConfig: () => void;
}

const PROVIDER_INFO = {
  anthropic: {
    name: 'Anthropic (Claude)',
    models: [
      {
        id: 'claude-sonnet-4-20250514',
        name: 'Claude Sonnet 4 (Recommended)',
        description: 'Best balance of speed and quality',
      },
      { id: 'claude-opus-4-20250514', name: 'Claude Opus 4', description: 'Most capable model' },
      {
        id: 'claude-3-5-haiku-20241022',
        name: 'Claude 3.5 Haiku',
        description: 'Fastest, most affordable',
      },
    ],
    keyPrefix: 'sk-ant-',
    docsUrl: 'https://console.anthropic.com/settings/keys',
  },
  openai: {
    name: 'OpenAI (GPT)',
    models: [
      { id: 'gpt-4o', name: 'GPT-4o (Recommended)', description: 'Most capable GPT model' },
      { id: 'gpt-4o-mini', name: 'GPT-4o Mini', description: 'Fast and affordable' },
      { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', description: 'High capability' },
    ],
    keyPrefix: 'sk-',
    docsUrl: 'https://platform.openai.com/api-keys',
  },
};

export const AISettings: React.FC<AISettingsProps> = ({
  isConfigured,
  currentProvider,
  features,
  onConfigure,
  onClearConfig,
}) => {
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<AIProvider>('anthropic');
  const [apiKey, setApiKey] = useState('');
  const [model, setModel] = useState(PROVIDER_INFO.anthropic.models[0].id);
  const [showKey, setShowKey] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Update model when provider changes
  useEffect(() => {
    setModel(PROVIDER_INFO[provider].models[0].id);
  }, [provider]);

  const validateApiKey = (key: string, provider: AIProvider): boolean => {
    if (!key.trim()) return false;
    const prefix = PROVIDER_INFO[provider].keyPrefix;
    return key.startsWith(prefix);
  };

  const handleSave = async () => {
    setError(null);

    if (!apiKey.trim()) {
      setError('API key is required');
      return;
    }

    if (!validateApiKey(apiKey, provider)) {
      setError(
        `Invalid API key format. ${provider === 'anthropic' ? 'Anthropic' : 'OpenAI'} keys should start with "${PROVIDER_INFO[provider].keyPrefix}"`
      );
      return;
    }

    const config: AIConfig = {
      provider,
      apiKey,
      model,
      maxTokens: 4096,
      temperature: 0.7,
    };

    onConfigure(config);
    setOpen(false);
    setApiKey('');
  };

  const handleDisconnect = () => {
    onClearConfig();
    setApiKey('');
    setProvider('anthropic');
    setModel(PROVIDER_INFO.anthropic.models[0].id);
  };

  const featureList = [
    {
      key: 'playerAnalysis',
      name: 'Player Analysis',
      description: 'Deep analysis of player strengths, weaknesses, and outlook',
    },
    {
      key: 'draftRecommendations',
      name: 'Draft Recommendations',
      description: 'AI-powered pick suggestions based on your roster',
    },
    {
      key: 'tradeAnalysis',
      name: 'Trade Analysis',
      description: 'Evaluate trade proposals with fairness scoring',
    },
    {
      key: 'chatAssistant',
      name: 'Chat Assistant',
      description: 'Ask questions about players, strategy, and more',
    },
    {
      key: 'rookieScouting',
      name: 'Rookie Scouting',
      description: 'Detailed rookie evaluations and dynasty rankings',
    },
    {
      key: 'waiverAnalysis',
      name: 'Waiver Analysis',
      description: 'Smart waiver wire recommendations',
    },
    {
      key: 'matchupAnalysis',
      name: 'Matchup Analysis',
      description: 'Weekly matchup predictions and start/sit advice',
    },
    {
      key: 'naturalLanguageQueries',
      name: 'Natural Language Queries',
      description: 'Ask questions in plain English',
    },
  ];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant={isConfigured ? 'outline' : 'default'} className="gap-2">
          {isConfigured ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              AI Connected
            </>
          ) : (
            <>
              <Brain className="h-4 w-4" />
              Enable AI Features
            </>
          )}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            AI Integration Settings
          </DialogTitle>
          <DialogDescription>
            Connect your AI provider to unlock intelligent draft assistance, player analysis, and
            more.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Connection Status */}
          {isConfigured && (
            <Alert className="border-green-500/50 bg-green-500/10">
              <Check className="h-4 w-4 text-green-500" />
              <AlertDescription className="flex items-center justify-between">
                <span>
                  Connected to{' '}
                  {currentProvider === 'anthropic' ? 'Anthropic (Claude)' : 'OpenAI (GPT)'}
                </span>
                <Button variant="destructive" size="sm" onClick={handleDisconnect}>
                  Disconnect
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {/* Provider Selection */}
          <div className="space-y-3">
            <Label>AI Provider</Label>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className={`cursor-pointer transition-all ${provider === 'anthropic' ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                onClick={() => setProvider('anthropic')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-orange-500/20">
                      <Sparkles className="h-5 w-5 text-orange-500" />
                    </div>
                    <div>
                      <div className="font-medium">Anthropic</div>
                      <div className="text-xs text-muted-foreground">Claude AI</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
              <Card
                className={`cursor-pointer transition-all ${provider === 'openai' ? 'border-primary ring-2 ring-primary/20' : 'hover:border-primary/50'}`}
                onClick={() => setProvider('openai')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-500/20">
                      <Zap className="h-5 w-5 text-green-500" />
                    </div>
                    <div>
                      <div className="font-medium">OpenAI</div>
                      <div className="text-xs text-muted-foreground">GPT Models</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* API Key Input */}
          <div className="space-y-2">
            <Label htmlFor="apiKey">API Key</Label>
            <div className="relative">
              <Input
                id="apiKey"
                type={showKey ? 'text' : 'password'}
                placeholder={`Enter your ${PROVIDER_INFO[provider].name} API key`}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="absolute right-0 top-0 h-full px-3"
                onClick={() => setShowKey(!showKey)}
              >
                {showKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Get your API key from{' '}
              <a
                href={PROVIDER_INFO[provider].docsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {provider === 'anthropic' ? 'Anthropic Console' : 'OpenAI Platform'}
              </a>
            </p>
          </div>

          {/* Model Selection */}
          <div className="space-y-2">
            <Label htmlFor="model">Model</Label>
            <Select value={model} onValueChange={setModel}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROVIDER_INFO[provider].models.map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    <div className="flex flex-col">
                      <span>{m.name}</span>
                      <span className="text-xs text-muted-foreground">{m.description}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Error Display */}
          {error && (
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {/* Features List */}
          <div className="space-y-3">
            <Label>AI Features</Label>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              {featureList.map((feature) => (
                <div
                  key={feature.key}
                  className="flex items-start gap-2 rounded-lg bg-secondary/30 p-2"
                >
                  {features[feature.key as keyof AIFeatureFlags] ? (
                    <Check className="mt-0.5 h-4 w-4 text-green-500" />
                  ) : (
                    <div className="mt-0.5 h-4 w-4 rounded-full border border-muted-foreground/30" />
                  )}
                  <div>
                    <div className="text-sm font-medium">{feature.name}</div>
                    <div className="text-xs text-muted-foreground">{feature.description}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Privacy Notice */}
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              Your API key is stored locally in your browser and never sent to our servers. All AI
              requests are made directly to the provider's API.
            </AlertDescription>
          </Alert>

          {/* Save Button */}
          <div className="flex justify-end gap-3">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={!apiKey.trim()}>
              <Key className="mr-2 h-4 w-4" />
              Save Configuration
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AISettings;
