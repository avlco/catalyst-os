import React, { useState, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Paperclip, Loader2, FileText, Image, File } from 'lucide-react';
import { cn } from '@/lib/utils';

export default function FloatingChat({
  isOpen,
  onToggle,
  chatHistory = [],
  onSendMessage,
  isLoading,
  t,
  isRTL,
  prefillMessage = '',
  onClearPrefill,
  hasUnread = false,
}) {
  const [message, setMessage] = useState('');
  const [attachments, setAttachments] = useState([]);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (prefillMessage) {
      setMessage(prefillMessage);
      onClearPrefill?.();
      inputRef.current?.focus();
    }
  }, [prefillMessage, onClearPrefill]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory]);

  const send = () => {
    const trimmed = message.trim();
    if (!trimmed || isLoading) return;
    onSendMessage(trimmed, attachments);
    setMessage('');
    setAttachments([]);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  const handleFileSelect = (mode) => {
    fileInputRef.current._attachMode = mode;
    fileInputRef.current?.click();
    setShowAttachMenu(false);
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const mode = fileInputRef.current._attachMode || 'context';
    const newAttachments = files.map(file => ({ file, mode }));
    setAttachments(prev => [...prev, ...newAttachments]);
    e.target.value = '';
  };

  const removeAttachment = (idx) => {
    setAttachments(prev => prev.filter((_, i) => i !== idx));
  };

  const getFileIcon = (file) => {
    if (file.type.startsWith('image/')) return Image;
    if (file.type === 'application/pdf') return FileText;
    return File;
  };

  return (
    <>
      {/* FAB Button */}
      {!isOpen && (
        <button
          onClick={onToggle}
          className="fixed bottom-6 end-6 z-40 w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg hover:bg-primary/90 flex items-center justify-center transition-all hover:scale-105 active:scale-95"
        >
          <MessageSquare className="w-6 h-6" />
          {hasUnread && (
            <span className="absolute top-0 end-0 w-3 h-3 rounded-full bg-red-500 border-2 border-background" />
          )}
        </button>
      )}

      {/* Chat Drawer */}
      {isOpen && (
        <div className={cn(
          'fixed bottom-6 z-40 w-[400px] max-w-[calc(100vw-2rem)] h-[500px] max-h-[calc(100vh-8rem)]',
          'bg-card border border-border rounded-2xl shadow-2xl flex flex-col overflow-hidden',
          isRTL ? 'left-6' : 'right-6',
        )}>
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-muted/20">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium">{t?.('discovery.chatTitle') || 'Refine Document'}</span>
            </div>
            <button onClick={onToggle} className="p-1.5 rounded-md hover:bg-muted text-muted-foreground hover:text-foreground">
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {chatHistory.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-8">
                {t?.('discovery.chatPlaceholder') || 'Ask me to improve any section...'}
              </p>
            )}
            {chatHistory.map((msg, idx) => (
              <div key={idx} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[85%] rounded-xl px-3 py-2 text-sm',
                  msg.role === 'user'
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm',
                )}>
                  <div className="whitespace-pre-wrap">{msg.content}</div>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-start">
                <div className="bg-muted rounded-xl px-3 py-2">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Attachments */}
          {attachments.length > 0 && (
            <div className="px-4 pb-1 flex flex-wrap gap-1.5">
              {attachments.map((att, idx) => {
                const FileIcon = getFileIcon(att.file);
                return (
                  <div key={idx} className="flex items-center gap-1.5 text-xs bg-muted rounded-lg px-2 py-1">
                    <FileIcon className="w-3 h-3" />
                    <span className="max-w-[100px] truncate">{att.file.name}</span>
                    <span className="text-muted-foreground">{att.mode === 'artifact' ? '\uD83D\uDCC1' : '\uD83D\uDCCE'}</span>
                    <button onClick={() => removeAttachment(idx)} className="text-muted-foreground hover:text-red-500">
                      <X className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-border p-3">
            <div className="flex items-end gap-2">
              <div className="relative">
                <button
                  onClick={() => setShowAttachMenu(!showAttachMenu)}
                  className="p-2 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Paperclip className="w-4 h-4" />
                </button>
                {showAttachMenu && (
                  <div className="absolute bottom-full mb-1 start-0 bg-card border border-border rounded-lg shadow-lg py-1 z-10 min-w-[180px]">
                    <button
                      onClick={() => handleFileSelect('context')}
                      className="w-full px-3 py-1.5 text-start text-sm hover:bg-muted flex items-center gap-2"
                    >
                      {'\uD83D\uDCCE'} {t?.('discovery.chatAttachContext') || 'As context (temporary)'}
                    </button>
                    <button
                      onClick={() => handleFileSelect('artifact')}
                      className="w-full px-3 py-1.5 text-start text-sm hover:bg-muted flex items-center gap-2"
                    >
                      {'\uD83D\uDCC1'} {t?.('discovery.chatAttachArtifact') || 'Save to project'}
                    </button>
                  </div>
                )}
              </div>
              <textarea
                ref={inputRef}
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t?.('discovery.chatPlaceholder') || 'Ask me to improve any section...'}
                rows={1}
                className="flex-1 resize-none bg-muted/50 border border-border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 max-h-[100px]"
                style={{ height: 'auto', minHeight: '36px' }}
                onInput={(e) => { e.target.style.height = 'auto'; e.target.style.height = Math.min(e.target.scrollHeight, 100) + 'px'; }}
              />
              <button
                onClick={send}
                disabled={!message.trim() || isLoading}
                className="p-2 rounded-xl bg-primary text-primary-foreground disabled:opacity-50 disabled:cursor-not-allowed hover:bg-primary/90 transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".pdf,.png,.jpg,.jpeg,.txt,.md"
        onChange={handleFileChange}
        className="hidden"
      />
    </>
  );
}