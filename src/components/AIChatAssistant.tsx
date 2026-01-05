import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import {
  Brain,
  Send,
  User,
  Bot,
  Sparkles,
  Trash2,
  MessageSquare,
  Lightbulb,
  TrendingUp,
  Target,
  HelpCircle,
} from 'lucide-react';
import type {
  AIMessage,
  ChatResponse,
  PlayerSummary,
  DraftState,
  RosterContext,
} from '@/services/ai/types';

interface AIChatAssistantProps {
  isConfigured: boolean;
  isLoading: boolean;
  conversationHistory: AIMessage[];
  onSendMessage: (message: string, context?: ChatContext) => Promise<ChatResponse | null>;
  onClearHistory: () => void;
  // Context for better responses
  currentView?: string;
  selectedPlayer?: PlayerSummary;
  draftState?: DraftState;
  userRoster?: RosterContext;
}

interface ChatContext {
  currentView?: string;
  selectedPlayer?: PlayerSummary;
  draftState?: DraftState;
  userRoster?: RosterContext;
}

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  suggestions?: string[];
  relatedPlayers?: PlayerSummary[];
}

const SUGGESTED_QUESTIONS = [
  { icon: Target, text: 'Who should I draft next?' },
  { icon: TrendingUp, text: 'Which RBs are trending up?' },
  { icon: Lightbulb, text: "What's my team's biggest weakness?" },
  { icon: HelpCircle, text: 'Explain zero-RB strategy' },
];

export const AIChatAssistant: React.FC<AIChatAssistantProps> = ({
  isConfigured,
  isLoading,
  conversationHistory,
  onSendMessage,
  onClearHistory,
  currentView,
  selectedPlayer,
  draftState,
  userRoster,
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isExpanded, setIsExpanded] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Convert conversation history to display messages
  useEffect(() => {
    const displayMessages: ChatMessage[] = conversationHistory.map((msg, index) => ({
      id: `msg-${index}`,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(),
    }));
    setMessages(displayMessages);
  }, [conversationHistory]);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || !isConfigured || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    const context: ChatContext = {
      currentView,
      selectedPlayer,
      draftState,
      userRoster,
    };

    const response = await onSendMessage(input.trim(), context);

    if (response) {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        suggestions: response.suggestions,
        relatedPlayers: response.relatedPlayers,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  };

  const handleSuggestedQuestion = (question: string) => {
    setInput(question);
    inputRef.current?.focus();
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const ChatContent = () => (
    <div className="flex h-full flex-col">
      {/* Messages Area */}
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center space-y-4 py-8 text-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20">
              <Brain className="h-8 w-8 text-primary" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">AI Draft Assistant</h3>
              <p className="max-w-xs text-sm text-muted-foreground">
                Ask me anything about fantasy football, draft strategy, or player analysis.
              </p>
            </div>

            {/* Suggested Questions */}
            <div className="grid w-full max-w-sm grid-cols-1 gap-2 pt-4">
              {SUGGESTED_QUESTIONS.map((q, index) => (
                <Button
                  key={index}
                  variant="outline"
                  className="h-auto justify-start gap-2 py-3 text-left"
                  onClick={() => handleSuggestedQuestion(q.text)}
                  disabled={!isConfigured}
                >
                  <q.icon className="h-4 w-4 flex-shrink-0 text-primary" />
                  <span className="text-sm">{q.text}</span>
                </Button>
              ))}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {message.role === 'assistant' && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-primary/20">
                    <Bot className="h-4 w-4 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[80%] rounded-lg p-3 ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50'
                  }`}
                >
                  <p className="whitespace-pre-wrap text-sm">{message.content}</p>

                  {/* Suggestions */}
                  {message.suggestions && message.suggestions.length > 0 && (
                    <div className="mt-3 space-y-1">
                      <p className="mb-1 text-xs text-muted-foreground">Follow-up questions:</p>
                      {message.suggestions.map((suggestion, index) => (
                        <Button
                          key={index}
                          variant="ghost"
                          size="sm"
                          className="h-auto justify-start px-2 py-1 text-xs"
                          onClick={() => handleSuggestedQuestion(suggestion)}
                        >
                          {suggestion}
                        </Button>
                      ))}
                    </div>
                  )}

                  {/* Related Players */}
                  {message.relatedPlayers && message.relatedPlayers.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1">
                      {message.relatedPlayers.map((player) => (
                        <Badge key={player.id} variant="secondary" className="text-xs">
                          {player.name} ({player.position})
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
                {message.role === 'user' && (
                  <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent/20">
                    <User className="h-4 w-4 text-accent" />
                  </div>
                )}
              </div>
            ))}

            {/* Loading indicator */}
            {isLoading && (
              <div className="flex justify-start gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20">
                  <Bot className="h-4 w-4 animate-pulse text-primary" />
                </div>
                <div className="space-y-2 rounded-lg bg-secondary/50 p-3">
                  <Skeleton className="h-4 w-48" />
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      {/* Input Area */}
      <div className="space-y-2 border-t p-4">
        {!isConfigured && (
          <div className="mb-2 text-center text-xs text-muted-foreground">
            Configure AI in settings to enable the chat assistant
          </div>
        )}
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={
              isConfigured ? 'Ask about draft strategy, players, trades...' : 'AI not configured'
            }
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConfigured || isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || !isConfigured || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>

        {/* Clear History */}
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground"
            onClick={onClearHistory}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Clear conversation
          </Button>
        )}
      </div>
    </div>
  );

  // Floating button trigger
  return (
    <>
      {/* Sheet (Slide-out Panel) */}
      <Sheet open={isExpanded} onOpenChange={setIsExpanded}>
        <SheetTrigger asChild>
          <Button
            className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full shadow-lg"
            size="icon"
          >
            <MessageSquare className="h-6 w-6" />
            {isConfigured && (
              <span className="absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
            )}
          </Button>
        </SheetTrigger>
        <SheetContent side="right" className="w-full p-0 sm:max-w-lg">
          <SheetHeader className="border-b p-4">
            <SheetTitle className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              AI Draft Assistant
              {isConfigured && (
                <Badge variant="secondary" className="ml-2">
                  <Sparkles className="mr-1 h-3 w-3" />
                  Active
                </Badge>
              )}
            </SheetTitle>
          </SheetHeader>
          <div className="h-[calc(100vh-80px)]">
            <ChatContent />
          </div>
        </SheetContent>
      </Sheet>
    </>
  );
};

// Inline chat component for embedding in pages
export const InlineAIChat: React.FC<AIChatAssistantProps> = (props) => {
  return (
    <Card className="glass-card flex h-[500px] flex-col">
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Brain className="h-5 w-5 text-primary" />
          AI Assistant
          {props.isConfigured && (
            <Badge variant="secondary" className="ml-2 text-xs">
              <Sparkles className="mr-1 h-3 w-3" />
              Active
            </Badge>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 overflow-hidden p-0">
        <div className="flex h-full flex-col">
          {/* Reuse chat content logic */}
          <AIChatContent {...props} />
        </div>
      </CardContent>
    </Card>
  );
};

// Extracted chat content for reuse
const AIChatContent: React.FC<AIChatAssistantProps> = ({
  isConfigured,
  isLoading,
  conversationHistory,
  onSendMessage,
  onClearHistory,
  currentView,
  selectedPlayer,
  draftState,
  userRoster,
}) => {
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const displayMessages: ChatMessage[] = conversationHistory.map((msg, index) => ({
      id: `msg-${index}`,
      role: msg.role as 'user' | 'assistant',
      content: msg.content,
      timestamp: new Date(),
    }));
    setMessages(displayMessages);
  }, [conversationHistory]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if (!input.trim() || !isConfigured || isLoading) return;

    const userMessage: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: input.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');

    const response = await onSendMessage(input.trim(), {
      currentView,
      selectedPlayer,
      draftState,
      userRoster,
    });

    if (response) {
      const assistantMessage: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        suggestions: response.suggestions,
        relatedPlayers: response.relatedPlayers,
      };
      setMessages((prev) => [...prev, assistantMessage]);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center py-8 text-center">
            <Brain className="mb-3 h-12 w-12 text-primary/50" />
            <p className="text-sm text-muted-foreground">
              {isConfigured
                ? 'Ask me anything about your draft!'
                : 'Configure AI to start chatting'}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[85%] rounded-lg p-2 text-sm ${
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary/50'
                  }`}
                >
                  {message.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="rounded-lg bg-secondary/50 p-2">
                  <Skeleton className="h-4 w-32" />
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>
      <div className="border-t p-3">
        <div className="flex gap-2">
          <Input
            ref={inputRef}
            placeholder={isConfigured ? 'Ask a question...' : 'AI not configured'}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            disabled={!isConfigured || isLoading}
            className="flex-1"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || !isConfigured || isLoading}
            size="icon"
          >
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {messages.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            className="mt-2 w-full text-xs text-muted-foreground"
            onClick={onClearHistory}
          >
            <Trash2 className="mr-1 h-3 w-3" />
            Clear conversation
          </Button>
        )}
      </div>
    </>
  );
};

export default AIChatAssistant;
