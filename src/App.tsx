/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Send, 
  Image as ImageIcon, 
  Cpu, 
  Layers, 
  Activity, 
  X, 
  Plus, 
  Terminal, 
  Zap,
  Globe,
  Database,
  Search,
  BookOpen,
  ChevronRight,
  Maximize2,
  Trash2,
  Download
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn, formatDate } from './lib/utils';
import { chatStream, Message, summarizeText } from './services/geminiService';
import { KnowledgeGraph, Node, Link } from './components/KnowledgeGraph';
import confetti from 'canvas-confetti';

export default function App() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [activeWorkspace, setActiveWorkspace] = useState<'brain' | 'terminal' | 'stats'>('brain');
  const [workspaceContent, setWorkspaceContent] = useState<string>('# Synthesis Chamber\nQuantum stability: 100%. Awaiting Operative Input for recursive mapping.');
  const [knowledgeBase, setKnowledgeBase] = useState<{ name: string, content: string }[]>([]);
  const [summaries, setSummaries] = useState<Record<number, string>>({});
  const [isSummarizing, setIsSummarizing] = useState<number | null>(null);
  const [graphData, setGraphData] = useState<{ nodes: Node[], links: Link[] }>({
    nodes: [
      { id: 'Aether', group: 1, label: 'Aether Core' },
      { id: 'Reasoning', group: 2, label: 'Reasoning' },
      { id: 'Semantic', group: 2, label: 'Semantic Bridge' },
    ],
    links: [
      { source: 'Aether', target: 'Reasoning', value: 2 },
      { source: 'Aether', target: 'Semantic', value: 2 },
    ]
  });
  
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportGraph = () => {
    const dataStr = JSON.stringify(graphData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = `aether-knowledge-graph-${new Date().toISOString()}.json`;

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    // Add a visual flair on export
    confetti({
      particleCount: 20,
      startVelocity: 10,
      gravity: 0.5,
      colors: ['#D4AF37'],
      origin: { x: 0.9, y: 0.1 }
    });
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleSend = async () => {
    if ((!input.trim() && images.length === 0) || isLoading) return;

    // Build context string from knowledge base
    const groundedContext = knowledgeBase.map(doc => `SOURCE: ${doc.name}\nCONTENT: ${doc.content}`).join('\n\n');

    const userMessage: Message = {
      role: 'user',
      content: input,
      timestamp: new Date(),
      images: images.length > 0 ? [...images] : undefined
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setImages([]);
    setIsLoading(true);

    let assistantMessage: Message = {
      role: 'assistant',
      content: '',
      timestamp: new Date(),
      thinking: ''
    };

    setMessages(prev => [...prev, assistantMessage]);

    try {
      const stream = chatStream([...messages, userMessage], groundedContext || undefined);
      let fullContent = '';
      
      for await (const chunk of stream) {
        fullContent += chunk.text || '';
        setMessages(prev => {
          const newMessages = [...prev];
          const last = newMessages[newMessages.length - 1];
          if (chunk.text) last.content += chunk.text;
          if (chunk.thought) last.thinking = (last.thinking || '') + chunk.thought;
          return newMessages;
        });

        // Check for workspace update in real-time or at the end
        if (fullContent.includes('[[WORKSPACE_UPDATE]]:')) {
          const parts = fullContent.split('[[WORKSPACE_UPDATE]]:');
          if (parts.length > 1) {
            setWorkspaceContent(parts[parts.length - 1].trim());
          }
        }
      }
      
      // Final check for updates and confetti
      if (fullContent.includes('[[WORKSPACE_UPDATE]]')) {
        confetti({
          particleCount: 150,
          spread: 80,
          origin: { y: 0.6 },
          colors: ['#D4AF37', '#E0D8D0', '#ffffff']
        });
      }

      // Logic for adding nodes based on query keywords (simplified visualization update)
      const currentInput = userMessage.content.toLowerCase();
      if (currentInput.length > 5) {
         setGraphData(prev => {
           const newId = `Node_${prev.nodes.length}`;
           const newLabel = currentInput.split(' ').slice(0, 2).join(' ');
           // Don't add if too many nodes or duplicate label
           if (prev.nodes.some(n => n.label === newLabel)) return prev;
           return {
             nodes: [...prev.nodes, { id: newId, group: 2, label: newLabel }],
             links: [...prev.links, { source: 'Aether', target: newId, value: 1 }]
           };
         });
      }

    } catch (error) {
      console.error('Nexus Failure:', error);
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Connection severed. Intelligence stream disrupted.', timestamp: new Date() }
      ]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onload = (event) => {
          const content = event.target?.result as string;
          setKnowledgeBase(prev => [...prev, { name: file.name, content }]);
          confetti({
            particleCount: 40,
            spread: 50,
            origin: { x: 0.9, y: 0.5 },
            colors: ['#D4AF37']
          });
        };
        reader.readAsText(file);
      });
    }
  };

  const handleSummarize = async (index: number) => {
    const msg = messages[index];
    if (msg.role !== 'assistant' || summaries[index] || isSummarizing === index) return;
    
    setIsSummarizing(index);
    try {
      const summary = await summarizeText(msg.content);
      setSummaries(prev => ({ ...prev, [index]: summary }));
    } catch (error) {
      console.error("Summary failed:", error);
    } finally {
      setIsSummarizing(null);
    }
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files) {
      Array.from(files).forEach(file => {
        const reader = new FileReader();
        reader.onloadend = () => {
          setImages(prev => [...prev, reader.result as string]);
        };
        reader.readAsDataURL(file);
      });
    }
  };

  return (
    <div className="flex h-screen w-full bg-[#050505] overflow-hidden nexus-grid relative text-[#E0D8D0]">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="scanline opacity-20 absolute top-0" />
      </div>

      {/* Sidebar - Sophisticated Navigation */}
      <aside className="w-[260px] border-r border-white/10 flex flex-col justify-between p-6 z-20 bg-[#080808]/80 backdrop-blur-xl">
        <div className="top-nav">
          <div className="flex items-center gap-3 mb-12">
            <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
            <span className="serif italic text-2xl text-white tracking-tight">Aether v.4.0</span>
          </div>
          
          <nav className="space-y-8">
            <div>
              <div className="metric-label mb-4">Neural Context</div>
              <div className="space-y-4">
                <NavButton icon={Layers} active={activeWorkspace === 'brain'} onClick={() => setActiveWorkspace('brain')} label="Quantum Workspace" />
                <NavButton icon={Terminal} active={activeWorkspace === 'terminal'} onClick={() => setActiveWorkspace('terminal')} label="Pattern Delta" />
                <NavButton icon={Activity} active={activeWorkspace === 'stats'} onClick={() => setActiveWorkspace('stats')} label="Simulations" />
              </div>
            </div>
          </nav>
        </div>

        <div className="bottom-info space-y-6">
          <div>
            <div className="metric-label">System Entropy</div>
            <div className="text-xs font-mono mt-1 opacity-70">0.0004278 Δ</div>
            <div className="data-line" />
            <div className="metric-label">Model Density</div>
            <div className="text-xs font-mono mt-1 opacity-70">14.2 Quadrillion Params</div>
          </div>
          <div className="opacity-30 hover:opacity-100 transition-opacity flex justify-center">
            <NavButton icon={Database} label="Knowledge Sync" />
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex gap-0 relative z-10 transition-all duration-700">
        
        {/* Chat Section */}
        <section className="flex-1 flex flex-col border-r border-white/10 max-w-4xl mx-auto">
          {/* Header */}
          <header className="h-20 border-b border-white/5 flex items-center justify-between px-10 bg-[#050505]/50 backdrop-blur-sm">
            <div className="title-block">
              <h1 className="serif text-3xl font-light text-white mb-0.5">Advanced Synthesis</h1>
              <p className="opacity-30 text-[10px] tracking-[0.25em] uppercase">Cognitive Overlay Active</p>
            </div>
            <div className="flex gap-4">
              {images.length > 0 && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card py-2.5 px-5 text-[10px] tracking-[0.2em] uppercase font-mono border-accent/50 text-accent flex items-center gap-2"
                >
                  <div className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                  Visual Synthesis Mode
                </motion.div>
              )}
              <div className="glass-card py-2.5 px-5 text-[10px] tracking-[0.2em] uppercase font-mono opacity-60">Heuristic: ON</div>
              <div className="glass-card py-2.5 px-5 text-[10px] tracking-[0.2em] uppercase font-mono opacity-60 text-accent">Latency: 12ms</div>
            </div>
          </header>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-10 py-12 space-y-12 scroll-smooth">
            {messages.length === 0 && (
              <div className="h-full flex flex-col items-center justify-center opacity-30 text-center px-12">
                <div className="token-chip">Neural Handshake</div>
                <div className="serif text-3xl italic leading-relaxed text-white max-w-lg mb-8">
                  "Initiate a multi-modal stream to synthesize cross-domain intelligence..."
                </div>
                <p className="metric-label max-w-xs leading-loose">
                  Awaiting operational parameters for recursive synthesis.
                </p>
              </div>
            )}
            
            <AnimatePresence mode="popLayout">
              {messages.map((msg, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
                  className="flex flex-col gap-5 max-w-3xl mx-auto w-full"
                >
                  <div className="flex items-center justify-between border-b border-white/5 pb-2">
                    <div className="token-chip m-0">
                      {msg.role === 'user' ? 'Operator Query' : 'Aether Synthesis'}
                    </div>
                    <span className="metric-label opacity-20">{formatDate(msg.timestamp)}</span>
                  </div>

                  {msg.thinking && msg.role === 'assistant' && (
                    <div className="glass-card relative overflow-hidden p-5 mb-2">
                      <div className="absolute top-0 right-0 p-4 opacity-10 serif italic text-sm">Reasoning Log</div>
                      <details className="group/details">
                        <summary className="metric-label cursor-pointer hover:text-accent transition-colors list-none flex items-center gap-2">
                          <Plus className="w-3 h-3 group-open/details:rotate-45 transition-transform" /> Structural Analysis
                        </summary>
                        <div className="text-xs text-white/50 font-mono italic mt-5 leading-relaxed bg-white/[0.02] p-5 border border-white/5">
                          {msg.thinking}
                        </div>
                      </details>
                    </div>
                  )}

                  <div className="markdown-body">
                    {summaries[i] ? (
                      <div className="relative">
                        <div className="token-chip text-[9px] bg-accent/10 border-accent/20 mb-2">Cognitive Condensed</div>
                        <ReactMarkdown>{summaries[i]}</ReactMarkdown>
                        <button 
                          onClick={() => setSummaries(prev => {
                            const next = { ...prev };
                            delete next[i];
                            return next;
                          })}
                          className="text-[9px] font-mono opacity-30 hover:opacity-100 mt-2 block"
                        >
                          [ RESTORE FULL SEQUENCE ]
                        </button>
                      </div>
                    ) : (
                      <>
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                        {msg.role === 'assistant' && msg.content.length > 300 && (
                          <button 
                            onClick={() => handleSummarize(i)}
                            disabled={isSummarizing === i}
                            className="flex items-center gap-2 mt-4 text-[10px] font-mono tracking-widest opacity-30 hover:opacity-80 transition-opacity border border-white/10 px-2 py-1 rounded"
                          >
                            <Zap className={cn("w-3 h-3", isSummarizing === i && "animate-spin text-accent")} />
                            {isSummarizing === i ? "CONDENSING..." : "CONDENSE SYNTHESIS"}
                          </button>
                        )}
                      </>
                    )}
                  </div>

                  {msg.images && (
                    <div className="flex flex-wrap gap-3 mt-4">
                      {msg.images.map((img, idx) => (
                        <div key={idx} className="glass-card p-1">
                          <img src={img} alt="Upload" className="w-48 h-48 object-cover rounded shadow-2xl" referrerPolicy="no-referrer" />
                        </div>
                      ))}
                    </div>
                  )}

                  {msg.role === 'assistant' && !isLoading && i === messages.length - 1 && (
                    <div className="flex gap-8 mt-4 pt-6 border-t border-white/5">
                      <div className="flex-1 border-l border-accent pl-5">
                        <div className="metric-label mb-1">Synthesis Integrity</div>
                        <div className="text-2xl serif">98.4%</div>
                      </div>
                      <div className="flex-1 border-l border-white/10 pl-5">
                        <div className="metric-label mb-1">Semantic Drift</div>
                        <div className="text-2xl font-mono opacity-80 italic">0.002</div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))}
            </AnimatePresence>
            
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col gap-2 opacity-50 max-w-3xl mx-auto w-full"
              >
                <div className="data-line animate-pulse" />
                <div className="metric-label flex items-center gap-3">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent animate-ping" />
                  Synchronizing Neural Pathways...
                </div>
              </motion.div>
            )}
          </div>

          {/* Input Section */}
          <footer className="p-10 bg-[#050505]/80 backdrop-blur-md">
            <div className="max-w-3xl mx-auto">
              {images.length > 0 && (
                <div className="flex gap-3 mb-6 px-4">
                  {images.map((img, i) => (
                    <div key={i} className="relative glass-card p-1">
                      <img src={img} alt="Preview" className="w-20 h-20 object-cover rounded" />
                      <button 
                        onClick={() => setImages(prev => prev.filter((_, idx) => idx !== i))}
                        className="absolute -top-3 -right-3 bg-black border border-accent p-1.5 rounded-full shadow-xl hover:scale-110 transition-transform"
                      >
                        <X className="w-3 h-3 text-accent" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              
              <div className="glass-card flex items-center p-4 border-accent/30 focus-within:border-accent group transition-all duration-500 shadow-2xl">
                <span className="serif text-white/20 mr-5 text-xl">λ</span>
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSend();
                    }
                  }}
                  placeholder="Enter neural command..."
                  className="bg-transparent border-none outline-none flex-1 text-white placeholder-white/20 font-light resize-none min-h-[24px] max-h-32 text-lg"
                  rows={1}
                />
                
                <div className="flex items-center gap-3 ml-4">
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:border-accent hover:text-accent transition-all duration-300"
                    title="Upload Context"
                  >
                    <ImageIcon className="w-4 h-4 opacity-60" />
                  </button>
                  <input type="file" ref={fileInputRef} onChange={handleImageUpload} className="hidden" multiple accept="image/*" />
                  
                  <div className="w-[1px] h-6 bg-white/10 mx-1" />
                  
                  <button 
                    onClick={handleSend}
                    disabled={isLoading || (!input.trim() && images.length === 0)}
                    className="w-10 h-10 rounded-full border border-accent flex items-center justify-center bg-accent/5 hover:bg-accent hover:text-black transition-all duration-500 shadow-[0_0_20px_rgba(212,175,55,0.2)] disabled:opacity-20 disabled:grayscale"
                  >
                    <Send className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="mt-4 flex justify-center gap-6 opacity-20">
                <KBLabel label="⌘ CMD + ENTER TO SYNTHESIZE" />
              </div>
            </div>
          </footer>
        </section>

        {/* Workspace Section */}
        <section className="hidden 2xl:flex w-[480px] flex-col bg-[#080808] border-l border-white/10 relative overflow-hidden">
          <div className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-[#050505]/50 z-10">
            <div className="metric-label opacity-40">Knowledge Synthesis Buffer</div>
            <div className="flex gap-3">
              <button onClick={handleExportGraph} className="p-2 hover:bg-white/5 rounded-full transition-colors" title="Export Graph Data">
                <Download className="w-4 h-4 opacity-30 hover:text-accent transition-colors" />
              </button>
              <button onClick={() => setMessages([])} className="p-2 hover:bg-white/5 rounded-full transition-colors" title="Purge Synthesis">
                <Trash2 className="w-4 h-4 opacity-30 hover:opacity-100" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-10 z-10 flex flex-col gap-12">
            <div className="space-y-6">
              <div className="token-chip" style={{ borderColor: 'rgba(255,255,255,0.2)', color: 'rgba(255,255,255,0.4)' }}>Quantum State Overlay</div>
              
              <KnowledgeGraph nodes={graphData.nodes} links={graphData.links} width={400} height={300} />

              <div className="markdown-body opacity-90 leading-loose">
                <ReactMarkdown>{workspaceContent}</ReactMarkdown>
              </div>
            </div>
            
            <div className="space-y-8">
              <h3 className="metric-label border-b border-white/5 pb-3 flex justify-between items-center">
                Knowledge Ingestion
                <button 
                  onClick={() => document.getElementById('knowledge-upload')?.click()}
                  className="p-1 hover:bg-accent/10 hover:text-accent rounded transition-all"
                >
                  <Plus className="w-3 h-3" />
                </button>
                <input 
                  id="knowledge-upload" 
                  type="file" 
                  className="hidden" 
                  multiple 
                  onChange={handleFileUpload} 
                  accept=".txt,.md"
                />
              </h3>
              {knowledgeBase.length > 0 ? (
                <div className="space-y-3">
                  {knowledgeBase.map((doc, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 border border-white/5 bg-white/[0.02] rounded group relative">
                      <div className="flex items-center gap-3">
                        <BookOpen className="w-3 h-3 text-accent/60" />
                        <span className="text-[11px] font-mono opacity-80 truncate max-w-[200px]">{doc.name}</span>
                      </div>
                      <button 
                        onClick={() => setKnowledgeBase(prev => prev.filter((_, i) => i !== idx))}
                        className="opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="w-3 h-3 text-red-500/50 hover:text-red-500" />
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-[10px] font-mono opacity-20 italic text-center py-4">No grounded context initialized.</div>
              )}
            </div>

            <div className="space-y-8 mt-auto">
               <h3 className="metric-label border-b border-white/5 pb-3">Neural Stability</h3>
               <div className="space-y-5">
                  <ActivityBar label="Quantum Coherence" value={92} />
                  <ActivityBar label="Semantic Signal" value={98} />
                  <ActivityBar label="Entropy Sink" value={14} />
               </div>
            </div>
          </div>

          <div className="p-8 border-t border-white/5 bg-[#050505] flex justify-between items-center">
            <div className="metric-label opacity-30">AETHER CORE: ACTIVE</div>
            <div className="status-dot-large animate-pulse" style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#D4AF37' }}></div>
          </div>
        </section>
      </main>
    </div>
  );
}

function NavButton({ icon: Icon, active, onClick, label }: { icon: any, active?: boolean, onClick?: () => void, label: string }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-4 w-full p-2.5 rounded-lg transition-all group relative",
        active ? "text-accent" : "text-white/40 hover:text-white/70"
      )}
    >
      <div className={cn(
        "p-2 rounded-md transition-all",
        active ? "bg-accent/10 border border-accent/20" : "bg-white/5 border border-white/5 group-hover:border-white/10"
      )}>
        <Icon className="w-4 h-4" />
      </div>
      <span className="text-sm font-light tracking-wide">{label}</span>
      {active && <motion.div layoutId="nav-glow" className="absolute left-0 w-1 h-6 bg-accent rounded-full -ml-1 shadow-[0_0_15px_rgba(212,175,55,0.5)]" />}
    </button>
  );
}

function KBLabel({ label }: { label: string }) {
  return (
    <span className="text-[9px] font-mono opacity-30 tracking-[0.2em]">
      {label}
    </span>
  );
}

function EntityCard({ icon: Icon, label, status }: { icon: any, label: string, status: string }) {
  return (
    <div className="glass-card p-4 hover:border-accent/40 transition-all duration-500 group cursor-default">
      <Icon className="w-4 h-4 mb-3 text-accent opacity-40 group-hover:opacity-100 transition-opacity" />
      <div className="serif text-sm italic mb-1 text-white/80">{label}</div>
      <div className="metric-label opacity-30 tracking-widest">{status}</div>
    </div>
  );
}

function ActivityBar({ label, value }: { label: string, value: number }) {
  return (
    <div className="space-y-2 group">
      <div className="flex justify-between font-mono text-[9px] uppercase tracking-widest">
        <span className="opacity-40 group-hover:opacity-80 transition-opacity">{label}</span>
        <span className="opacity-60">{value}%</span>
      </div>
      <div className="h-[2px] bg-white/5 rounded-full overflow-hidden">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          className="h-full bg-accent opacity-40 group-hover:opacity-100 shadow-[0_0_10px_rgba(212,175,55,0.4)] transition-all"
        />
      </div>
    </div>
  );
}

function BrainIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2a10 10 0 0 0-10 10 10 10 0 0 0 10 10 10 10 0 0 0 10-10 10 10 0 0 0-10-10Z" />
      <path d="M12 12c.5 0 1 .5 1 1s-.5 1-1 1-1-.5-1-1 .5-1 1-1Z" />
      <path d="M12 2c-.5 0-1 .5-1 1s.5 1 1 1 1-.5 1-1-.5-1-1-1Z" />
      <path d="M12 20c-.5 0-1 .5-1 1s.5 1 1 1 1-.5 1-1-.5-1-1-1Z" />
      <path d="M2 12c0-.5.5-1 1-1s1 .5 1 1-.5 1-1 1-1-.5-1-1Z" />
      <path d="M20 12c0-.5.5-1 1-1s1 .5 1 1-.5 1-1 1-1-.5-1-1Z" />
      <path d="M12 6c1.5 0 3 1.5 3 3s-1.5 3-3 3-3-1.5-3-3 1.5-3 3-3Z" />
      <path d="M12 18c1.5 0 3-1.5 3-3s-1.5-3-3-3-3 1.5-3 3 1.5-3 3-3Z" />
    </svg>
  )
}
