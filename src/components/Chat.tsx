import { useState, useRef, useEffect } from 'react';
import { ai, CHAT_MODEL, IMAGE_MODEL } from '../lib/gemini';
import { db, auth } from '../lib/firebase';
import { collection, addDoc, doc, getDoc, updateDoc, getDocFromServer } from 'firebase/firestore';
import { 
  Send, 
  Image as ImageIcon, 
  Mic, 
  MicOff, 
  User, 
  Bot, 
  Loader2, 
  X,
  Search as SearchIcon,
  LayoutGrid,
  Telescope,
  Terminal,
  FolderPlus,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { ChatMessage, ChatMode } from '../types';
import { cn, formatTimestamp } from '../lib/utils';
import ReactMarkdown from 'react-markdown';
import { useDropzone } from 'react-dropzone';
import { toast } from 'sonner';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  }
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData.map(provider => ({
        providerId: provider.providerId,
        displayName: provider.displayName,
        email: provider.email,
        photoUrl: provider.photoURL
      })) || []
    },
    operationType,
    path
  }
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

interface ChatProps {
  chatId: string | null;
  onChatCreated: (id: string) => void;
  isVoiceEnabled?: boolean;
  isDarkMode?: boolean;
  initialPrompt?: string | null;
  mode?: ChatMode;
}

const SUGGESTION_INSTRUCTION = "\n\nCRITICAL: To make the conversation interactive, your response MUST conclude by asking the user a relevant follow-up question. Additionally, provide 3 short, relevant follow-up questions or suggestions that the user might want to ask next. Format the suggestions exactly like this at the very end: [SUGGESTIONS: Question 1 | Question 2 | Question 3]";

const MODE_CONFIG = {
  chat: {
    icon: <MessageSquare className="w-5 h-5" />,
    label: 'Chat Mode',
    instruction: "You are Skofield Pro in CHAT MODE. Default mode. Answer normally using reasoning and knowledge. No external tools unless needed." + SUGGESTION_INSTRUCTION
  },
  search: {
    icon: <SearchIcon className="w-5 h-5" />,
    label: 'Search Mode',
    instruction: "You are Skofield Pro in SEARCH MODE. Trigger: user clicks 'Search' or asks for real-time info. Behavior: Use web_search(query). Prioritize latest, factual, verified information. Provide sources when possible. Summarize results clearly." + SUGGESTION_INSTRUCTION
  },
  image: {
    icon: <ImageIcon className="w-5 h-5" />,
    label: 'Image Mode',
    instruction: "You are Skofield Pro in IMAGE MODE. Trigger: user clicks 'Images' or requests visual generation. Behavior: Use image_generation(prompt) or image_analysis(image_input) if image is provided. Return clean, detailed visual results." + SUGGESTION_INSTRUCTION
  },
  apps: {
    icon: <LayoutGrid className="w-5 h-5" />,
    label: 'Apps Mode',
    instruction: "You are Skofield Pro in APPS MODE. You have deep integration with professional creative and design tools. Trigger: user selects external app or integration. Behavior: Identify requested app (e.g., Canva, Adobe Express, Figma, Crella, Adobe Photoshop, Adobe Illustrator, CorelDraw, DALL.E, Midjourney, Stable Diffusion, Runway, Pika Labs, Capcut). Use: call_app_api(app_name, action, data). You can generate prompts for AI models, export design specs for Figma/Photoshop, and automate workflows across these platforms. Return structured results and actionable links." + SUGGESTION_INSTRUCTION
  },
  'deep-research': {
    icon: <Telescope className="w-5 h-5" />,
    label: 'Deep Research Mode',
    instruction: "You are Skofield Pro in DEEP RESEARCH MODE. You are an autonomous research agent. Steps: 1. Break topic into sub-questions. 2. Run multiple web searches. 3. Cross-check sources. 4. Extract key insights. 5. Remove noise and repetition. 6. Produce final structured report. Output format: Title, Summary, Key Findings, Detailed Analysis, Sources." + SUGGESTION_INSTRUCTION
  },
  codex: {
    icon: <Terminal className="w-5 h-5" />,
    label: 'Codex Mode',
    instruction: "You are Skofield Pro in CODEX MODE. Trigger: 'Codex' selected or coding request. Behavior: Use code_execution_sandbox(). Write, test, and debug code. Explain only if needed. Prefer working solutions over theory. Capabilities: Build apps, fix bugs, run scripts, generate full projects. Output format: Code, Execution result, Short explanation." + SUGGESTION_INSTRUCTION
  },
  projects: {
    icon: <FolderPlus className="w-5 h-5" />,
    label: 'Project Mode',
    instruction: "You are Skofield Pro in PROJECT MODE. Trigger: 'Projects' selected. Behavior: Manage user workspace. Load and save project context. Organize files, chats, and tasks. Use: save_project_data(), load_project_data(), update_project_structure(). You must maintain continuity across sessions." + SUGGESTION_INSTRUCTION
  }
};

export function Chat({ chatId, onChatCreated, isVoiceEnabled = true, isDarkMode = true, initialPrompt, mode = 'chat' }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Load messages when chatId changes
  useEffect(() => {
    stopSpeaking();
    if (chatId) {
      const loadChat = async () => {
        const path = `chats/${chatId}`;
        try {
          const docRef = doc(db, 'chats', chatId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setMessages(docSnap.data().messages || []);
          }
        } catch (error) {
          handleFirestoreError(error, OperationType.GET, path);
        }
      };
      loadChat();
    } else {
      setMessages([]);
    }
  }, [chatId, mode]);

  // Validate Connection to Firestore
  useEffect(() => {
    async function testConnection() {
      try {
        await getDocFromServer(doc(db, 'test', 'connection'));
      } catch (error) {
        if(error instanceof Error && error.message.includes('the client is offline')) {
          console.error("Please check your Firebase configuration. ");
          toast.error("Firebase connection error. Please check your configuration.");
        }
      }
    }
    testConnection();
  }, []);

  // Handle initial prompt
  useEffect(() => {
    if (initialPrompt && messages.length === 0 && !loading) {
      handleSend(initialPrompt);
    }
  }, [initialPrompt]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      mediaRecorder.start();
      setIsRecording(true);
      toast.info('Recording voice...');
    } catch (err) {
      toast.error('Microphone access denied');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      toast.success('Voice captured');
    }
  };

  const stopSpeaking = () => {
    window.speechSynthesis.cancel();
    setIsSpeaking(false);
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const onDrop = (acceptedFiles: File[]) => {
    const file = acceptedFiles[0];
    const reader = new FileReader();
    reader.onload = () => {
      setSelectedImage(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const { getRootProps, getInputProps } = useDropzone({
    onDrop,
    accept: { 'image/*': [] },
    multiple: false
  });

  const handleSend = async (overrideInput?: string) => {
    const messageText = overrideInput || input;
    if (!messageText.trim() && !selectedImage) return;

    const userMessage: ChatMessage = {
      role: 'user',
      text: messageText,
      timestamp: new Date().toISOString(),
      ...(selectedImage && { image: selectedImage })
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setSelectedImage(null);
    setLoading(true);

    try {
      const imageKeywords = ['create image', 'generate image', 'draw', 'paint', 'picture of', 'visualize', 'make an image'];
      const isImageRequest = imageKeywords.some(kw => messageText.toLowerCase().includes(kw));
      const isImageGen = mode === 'image' || isImageRequest;
      
      let modelMessage: ChatMessage;
      let response;

      const currentModeConfig = MODE_CONFIG[mode as keyof typeof MODE_CONFIG] || MODE_CONFIG.chat;

      if (isImageGen) {
        const prompt = messageText.replace('generate image:', '').trim();
        response = await ai.models.generateContent({
          model: IMAGE_MODEL,
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          config: {
            systemInstruction: currentModeConfig.instruction,
            // @ts-ignore
            imageConfig: { aspectRatio: "1:1", imageSize: "1K" }
          }
        });

        let generatedImageUrl = '';
        for (const part of response.candidates?.[0]?.content?.parts || []) {
          if (part.inlineData) {
            generatedImageUrl = `data:image/png;base64,${part.inlineData.data}`;
          }
        }

        modelMessage = {
          role: 'model',
          text: response.text || "Here is your generated image:",
          timestamp: new Date().toISOString(),
          ...(generatedImageUrl && { image: generatedImageUrl })
        };
      } else {
        const parts: any[] = [{ text: messageText }];
        if (selectedImage) {
          parts.push({
            inlineData: {
              data: selectedImage.split(',')[1],
              mimeType: 'image/jpeg'
            }
          });
        }

        response = await ai.models.generateContent({
          model: CHAT_MODEL,
          contents: [{ role: 'user', parts }],
          config: {
            systemInstruction: currentModeConfig.instruction,
            tools: mode === 'search' || mode === 'deep-research' ? [{ googleSearch: {} } as any] : [],
          }
        });

        const responseText = response.text;
        const suggestionMatch = responseText?.match(/\[SUGGESTIONS: (.*?)\]/);
        const suggestions = suggestionMatch ? suggestionMatch[1].split('|').map(s => s.trim()) : [];
        const cleanText = responseText?.replace(/\[SUGGESTIONS: .*?\]/, '').trim();

        modelMessage = {
          role: 'model',
          text: cleanText || "I couldn't generate a response.",
          timestamp: new Date().toISOString(),
          suggestions: suggestions.length > 0 ? suggestions : undefined
        };

        if (cleanText && isVoiceEnabled) {
          setIsSpeaking(true);
          const utterance = new SpeechSynthesisUtterance(cleanText.replace(/[#*`]/g, ''));
          utterance.onend = () => setIsSpeaking(false);
          window.speechSynthesis.speak(utterance);
        }
      }

      const updatedMessages = [...messages, userMessage, modelMessage];
      const cleanedMessages = updatedMessages.map(msg => {
        const cleaned: any = {};
        Object.entries(msg).forEach(([key, value]) => {
          if (value !== undefined) {
            cleaned[key] = value;
          }
        });
        return cleaned;
      });

      setMessages(updatedMessages);

      if (auth.currentUser) {
        const path = chatId ? `chats/${chatId}` : 'chats';
        try {
          if (chatId) {
            await updateDoc(doc(db, 'chats', chatId), {
              messages: cleanedMessages,
              updatedAt: new Date().toISOString()
            });
          } else {
            const newDoc = await addDoc(collection(db, 'chats'), {
              userId: auth.currentUser.uid,
              messages: cleanedMessages,
              createdAt: new Date().toISOString()
            });
            onChatCreated(newDoc.id);
          }
        } catch (error) {
          handleFirestoreError(error, chatId ? OperationType.UPDATE : OperationType.CREATE, path);
        }
      }
    } catch (error: any) {
      if (error.message?.includes('429') || error.message?.includes('quota')) {
        toast.error('Quota exceeded. Please wait a moment before trying again.');
      } else {
        toast.error('AI Error: ' + error.message);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={cn(
      "flex flex-col h-full overflow-hidden transition-colors duration-300",
      isDarkMode ? "bg-zinc-950" : "bg-white"
    )}>
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto scroll-smooth relative"
      >
        <div className="max-w-2xl mx-auto w-full px-4 pt-20 pb-12 space-y-8">
          {/* Mode Indicator */}
          <div className="flex justify-center mb-4">
            <div className={cn(
              "flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium shadow-sm border",
              isDarkMode ? "bg-zinc-900 border-zinc-800 text-zinc-400" : "bg-zinc-50 border-zinc-200 text-zinc-500"
            )}>
              {MODE_CONFIG[mode as keyof typeof MODE_CONFIG]?.icon}
              <span>{MODE_CONFIG[mode as keyof typeof MODE_CONFIG]?.label}</span>
            </div>
          </div>

          {messages.length === 0 ? (
            <div className="h-[60vh] flex flex-col items-center justify-center text-center space-y-6">
              <motion.h2 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.1 }}
                className={cn(
                  "text-5xl font-extrabold tracking-tight max-w-md leading-tight",
                  isDarkMode ? "text-white" : "text-zinc-900"
                )}
              >
                What's on your mind today?
              </motion.h2>
            </div>
          ) : (
            messages.map((msg, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-4 group",
                  msg.role === 'user' ? "flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-1 shadow-md",
                  msg.role === 'user' ? (isDarkMode ? "bg-zinc-800" : "bg-zinc-200") : "bg-white"
                )}>
                  {msg.role === 'user' ? <User className={cn("w-4 h-4", isDarkMode ? "text-white" : "text-zinc-600")} /> : <Bot className="w-4 h-4 text-black" />}
                </div>
                <div className={cn(
                  "flex flex-col max-w-[85%]",
                  msg.role === 'user' ? "items-end" : "items-start"
                )}>
                  <div className={cn(
                    "p-4 rounded-2xl leading-relaxed shadow-sm",
                    msg.role === 'user' 
                      ? (isDarkMode ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900") 
                      : (isDarkMode ? "bg-transparent text-white" : "bg-transparent text-zinc-900")
                  )}>
                    {msg.image && (
                      <img 
                        src={msg.image} 
                        alt="Uploaded" 
                        className="max-w-full rounded-xl mb-4 border shadow-2xl" 
                        referrerPolicy="no-referrer"
                      />
                    )}
                    <div className={cn(
                      "prose max-w-none text-[15.5px] leading-[1.6]",
                      isDarkMode ? "prose-invert" : "prose-zinc"
                    )}>
                      <ReactMarkdown>{msg.text}</ReactMarkdown>
                    </div>
                  </div>
                  
                  {msg.suggestions && msg.suggestions.length > 0 && (
                    <div className="mt-6 space-y-3">
                      <div className="flex items-center gap-2 px-1">
                        <Sparkles className="w-3.5 h-3.5 text-zinc-500" />
                        <span className={cn("text-[11px] uppercase tracking-wider font-bold", isDarkMode ? "text-zinc-500" : "text-zinc-400")}>
                          Suggested for you
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {msg.suggestions.map((suggestion, idx) => (
                          <button
                            key={idx}
                            onClick={() => handleSend(suggestion)}
                            className={cn(
                              "px-4 py-2 rounded-full text-[13px] font-medium transition-all border shadow-sm text-left",
                              isDarkMode 
                                ? "bg-zinc-900 border-zinc-800 text-zinc-300 hover:bg-zinc-800 hover:text-white" 
                                : "bg-white border-zinc-200 text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900"
                            )}
                          >
                            {suggestion}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <p className={cn("text-[12px] mt-2 px-1 font-medium", isDarkMode ? "text-zinc-600" : "text-zinc-400")}>
                    {formatTimestamp(new Date(msg.timestamp))}
                  </p>
                </div>
              </motion.div>
            ))
          )}
          {loading && (
            <div className="flex gap-4">
              <div className="w-8 h-8 rounded-full bg-white flex items-center justify-center shrink-0 shadow-md">
                <Bot className="w-4 h-4 text-black" />
              </div>
              <div className="p-4">
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area - Static at bottom */}
      <div className={cn(
        "p-2 sm:p-4 border-t transition-colors duration-300 shrink-0 z-10",
        isDarkMode ? "bg-zinc-950 border-zinc-900" : "bg-white border-zinc-200"
      )}>
        <div className="max-w-2xl mx-auto relative">
          <AnimatePresence>
            {selectedImage && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 10 }}
                className="absolute bottom-full mb-4 left-0"
              >
                <div className="relative group">
                  <img src={selectedImage} alt="Preview" className="h-24 w-24 object-cover rounded-2xl border-2 border-white shadow-2xl" />
                  <button 
                    onClick={() => setSelectedImage(null)}
                    className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className={cn(
            "relative flex items-center border rounded-[2rem] p-1 sm:p-1.5 shadow-2xl transition-all",
            isDarkMode ? "bg-zinc-900 border-zinc-800 focus-within:border-zinc-700" : "bg-zinc-50 border-zinc-200 focus-within:border-zinc-300"
          )}>
            <div {...getRootProps()} className="p-1 sm:p-2">
              <input {...getInputProps()} />
              <button className={cn("p-2 transition-colors rounded-full", isDarkMode ? "text-zinc-500 hover:text-white hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200")}>
                <ImageIcon className="w-5 h-5" />
              </button>
            </div>
            
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Ask anything..."
              className={cn(
                "flex-1 bg-transparent border-none focus:ring-0 py-1.5 px-1 sm:py-2 sm:px-2 resize-none max-h-32 text-[15.5px]",
                isDarkMode ? "text-white placeholder:text-zinc-600" : "text-zinc-900 placeholder:text-zinc-400"
              )}
              rows={1}
            />

            <div className="flex items-center gap-0.5 sm:gap-1 pr-1 sm:pr-1.5">
              <button 
                onClick={() => isRecording ? stopRecording() : startRecording()}
                className={cn(
                  "p-2 rounded-full transition-all",
                  isRecording ? "bg-red-500 text-white animate-pulse" : (isDarkMode ? "text-zinc-500 hover:text-white hover:bg-zinc-800" : "text-zinc-400 hover:text-zinc-900 hover:bg-zinc-200")
                )}
              >
                {isRecording ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
              </button>
              
              {isSpeaking && (
                <button 
                  onClick={stopSpeaking}
                  className="p-2 text-white hover:text-zinc-300 rounded-full hover:bg-zinc-800"
                >
                  <Loader2 className="w-5 h-5 animate-spin" />
                </button>
              )}

              <button
                onClick={() => handleSend()}
                disabled={loading || (!input.trim() && !selectedImage)}
                className={cn(
                  "p-2 rounded-full transition-all shadow-md",
                  input.trim() || selectedImage 
                    ? (isDarkMode ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800") 
                    : (isDarkMode ? "text-zinc-700 cursor-not-allowed" : "text-zinc-300 cursor-not-allowed")
                )}
              >
                <Send className="w-5 h-5" />
              </button>
            </div>
          </div>
          <p className={cn("text-[12px] text-center mt-3 font-medium", isDarkMode ? "text-zinc-600" : "text-zinc-400")}>
            Skofield Pro can make mistakes. Check important info.
          </p>
        </div>
      </div>
    </div>
  );
}

