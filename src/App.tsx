import { useState, useEffect } from 'react';
import { auth, db } from './lib/firebase';
import { onAuthStateChanged, User, signOut, updateProfile } from 'firebase/auth';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { Auth } from './components/Auth';
import { Chat } from './components/Chat';
import { ChatMode } from './types';
import { 
  MessageSquare, 
  LogOut, 
  User as UserIcon, 
  Plus, 
  Search, 
  Settings, 
  HelpCircle,
  Menu,
  X,
  Check,
  Edit2,
  Image as ImageIcon,
  LayoutGrid,
  Telescope,
  Terminal,
  FolderPlus,
  SquarePen
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Toaster, toast } from 'sonner';
import { cn } from './lib/utils';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [chats, setChats] = useState<any[]>([]);
  const [selectedChatId, setSelectedChatId] = useState<string | null>(null);
  const [modalType, setModalType] = useState<'settings' | 'help' | 'search' | 'profile' | 'integrations' | null>(null);
  const [activeMode, setActiveMode] = useState<ChatMode>('chat');
  
  // Settings State
  const [isDarkMode, setIsDarkMode] = useState(true);
  const [isVoiceEnabled, setIsVoiceEnabled] = useState(true);
  
  // Profile Edit State
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [newDisplayName, setNewDisplayName] = useState('');

  // Help Action State
  const [helpPrompt, setHelpPrompt] = useState<string | null>(null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setNewDisplayName(user?.displayName || '');
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  // Theme effect
  useEffect(() => {
    if (isDarkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [isDarkMode]);

  useEffect(() => {
    if (!user) return;
    const q = query(
      collection(db, 'chats'),
      where('userId', '==', user.uid),
      orderBy('createdAt', 'desc')
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const chatData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setChats(chatData);
    });
    return unsubscribe;
  }, [user]);

  const handleNewChat = () => {
    window.speechSynthesis.cancel();
    setSelectedChatId(null);
    setHelpPrompt(null);
    setActiveMode('chat');
    setIsSidebarOpen(false);
  };

  const handleSelectChat = (id: string) => {
    window.speechSynthesis.cancel();
    setSelectedChatId(id);
    setHelpPrompt(null);
    setActiveMode('chat');
    setIsSidebarOpen(false);
  };

  const handleUpdateProfile = async () => {
    if (!user) return;
    try {
      await updateProfile(user, { displayName: newDisplayName });
      setIsEditingProfile(false);
      toast.success('Profile updated successfully');
    } catch (error) {
      toast.error('Failed to update profile');
    }
  };

  const handleHelpAction = (prompt: string, mode: ChatMode = 'chat') => {
    window.speechSynthesis.cancel();
    setHelpPrompt(prompt);
    setModalType(null);
    setSelectedChatId(null);
    setActiveMode(mode);
    setIsSidebarOpen(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-zinc-950 flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-blue-600/30 border-t-blue-600 rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return (
      <>
        <Auth />
        <Toaster position="top-center" theme="dark" />
      </>
    );
  }

  return (
    <div className={cn(
      "flex h-screen overflow-hidden font-sans transition-colors duration-300",
      isDarkMode ? "bg-zinc-950 text-white" : "bg-zinc-50 text-zinc-900"
    )}>
      <Toaster position="top-center" theme={isDarkMode ? "dark" : "light"} />
      
      {/* Sidebar Overlay Backdrop */}
      <AnimatePresence>
        {isSidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[45]"
          />
        )}
      </AnimatePresence>

      {/* Sidebar */}
      <AnimatePresence mode="wait">
        {isSidebarOpen && (
          <motion.aside
            initial={{ x: -300, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: -300, opacity: 0 }}
            className={cn(
              "fixed inset-y-0 left-0 w-64 border-r flex flex-col z-50 transition-colors duration-300 shadow-2xl",
              isDarkMode ? "bg-[#09090b] border-zinc-800" : "bg-white border-zinc-200"
            )}
          >
            <div className="p-4 flex flex-col h-full">
              <button 
                onClick={() => window.location.reload()}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-xl transition-all mb-4 group",
                  isDarkMode ? "hover:bg-zinc-800" : "hover:bg-zinc-100"
                )}
              >
                <div className="w-8 h-8 bg-white rounded-lg flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg shadow-white/10">
                  <MessageSquare className="w-5 h-5 text-black" />
                </div>
                <span className="font-bold text-lg">Skofield Pro</span>
              </button>

              <button 
                onClick={handleNewChat}
                className={cn(
                  "flex items-center justify-between w-full p-3 rounded-xl transition-all mb-2 shadow-sm border",
                  isDarkMode ? "bg-zinc-900/50 border-zinc-800 hover:bg-zinc-800" : "bg-zinc-100 border-zinc-200 hover:bg-zinc-200"
                )}
              >
                <div className="flex items-center gap-3">
                  <SquarePen className={cn("w-5 h-5", isDarkMode ? "text-zinc-400" : "text-zinc-500")} />
                  <span className="text-sm font-medium">New chat</span>
                </div>
              </button>

              <div className="space-y-1 mb-6">
                <SidebarLink 
                  icon={<Search className="w-4 h-4" />} 
                  label="Search chats" 
                  onClick={() => {
                    setModalType('search');
                    setActiveMode('search');
                    setIsSidebarOpen(false);
                  }}
                  isDarkMode={isDarkMode}
                  isActive={activeMode === 'search'}
                />
                <SidebarLink 
                  icon={<ImageIcon className="w-4 h-4" />} 
                  label="Images" 
                  onClick={() => {
                    setActiveMode('image');
                    setSelectedChatId(null);
                    setIsSidebarOpen(false);
                  }}
                  isDarkMode={isDarkMode}
                  isActive={activeMode === 'image'}
                />
                <SidebarLink 
                  icon={<LayoutGrid className="w-4 h-4" />} 
                  label="Apps" 
                  onClick={() => {
                    setModalType('integrations');
                    setActiveMode('apps');
                    setIsSidebarOpen(false);
                  }}
                  isDarkMode={isDarkMode}
                  isActive={activeMode === 'apps'}
                />
                <SidebarLink 
                  icon={<Telescope className="w-4 h-4" />} 
                  label="Deep research" 
                  onClick={() => {
                    setActiveMode('deep-research');
                    setSelectedChatId(null);
                    setIsSidebarOpen(false);
                  }}
                  isDarkMode={isDarkMode}
                  isActive={activeMode === 'deep-research'}
                />
                <SidebarLink 
                  icon={<Terminal className="w-4 h-4" />} 
                  label="Codex" 
                  onClick={() => {
                    setActiveMode('codex');
                    setSelectedChatId(null);
                    setIsSidebarOpen(false);
                  }}
                  isDarkMode={isDarkMode}
                  isActive={activeMode === 'codex'}
                />
                <SidebarLink 
                  icon={<FolderPlus className="w-4 h-4" />} 
                  label="Projects" 
                  onClick={() => {
                    setActiveMode('projects');
                    setSelectedChatId(null);
                    setIsSidebarOpen(false);
                  }}
                  isDarkMode={isDarkMode}
                  isActive={activeMode === 'projects'}
                />
              </div>

              <div className="flex-1 overflow-y-auto space-y-1 -mx-2 px-2">
                <div className={cn(
                  "text-[12px] font-bold uppercase tracking-widest px-2 mb-2",
                  isDarkMode ? "text-zinc-500" : "text-zinc-400"
                )}>Recents</div>
                {chats.map((chat) => (
                  <button 
                    key={chat.id}
                    onClick={() => handleSelectChat(chat.id)}
                    className={cn(
                      "w-full text-left p-2 rounded-lg text-[13.5px] truncate transition-all",
                      selectedChatId === chat.id 
                        ? (isDarkMode ? "bg-zinc-800 text-white" : "bg-zinc-200 text-zinc-900")
                        : (isDarkMode ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100")
                    )}
                  >
                    {chat.messages?.[0]?.text || 'New Chat'}
                  </button>
                ))}
              </div>

              <div className={cn(
                "mt-auto pt-4 border-t space-y-1",
                isDarkMode ? "border-zinc-800" : "border-zinc-200"
              )}>
                <SidebarLink 
                  icon={<Settings className="w-4 h-4" />} 
                  label="Settings" 
                  onClick={() => setModalType('settings')}
                  isDarkMode={isDarkMode}
                />
                <SidebarLink 
                  icon={<HelpCircle className="w-4 h-4" />} 
                  label="Help & Support" 
                  onClick={() => setModalType('help')}
                  isDarkMode={isDarkMode}
                />
                <button 
                  onClick={() => signOut(auth)}
                  className={cn(
                    "flex items-center gap-3 w-full p-2 rounded-lg transition-all text-[13.5px]",
                    isDarkMode ? "text-zinc-400 hover:text-red-500 hover:bg-red-500/10" : "text-zinc-500 hover:text-red-600 hover:bg-red-50"
                  )}
                >
                  <LogOut className="w-4 h-4" />
                  <span>Log out</span>
                </button>
                <button 
                  onClick={() => setModalType('profile')}
                  className={cn(
                    "flex items-center gap-3 p-2 mt-2 w-full text-left rounded-lg transition-all",
                    isDarkMode ? "hover:bg-zinc-800" : "hover:bg-zinc-100"
                  )}
                >
                  <div className="w-8 h-8 rounded-full bg-zinc-800 border border-zinc-700 flex items-center justify-center text-[10px] font-black text-white shadow-md uppercase">
                    {user.displayName?.[0] || user.email?.[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1 truncate">
                    <div className={cn("text-[12px] font-black truncate uppercase tracking-tight", isDarkMode ? "text-white" : "text-zinc-900")}>
                      {user.displayName || user.email?.split('@')[0] || 'User'}
                    </div>
                    <div className={cn("text-[11px] truncate opacity-50", isDarkMode ? "text-zinc-400" : "text-zinc-500")}>{user.email}</div>
                  </div>
                </button>
              </div>
            </div>
          </motion.aside>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="flex-1 flex flex-col relative overflow-hidden">
        {/* Global Header */}
        <header className={cn(
          "p-4 flex items-center justify-between border-b transition-colors duration-300 z-40",
          isDarkMode ? "bg-zinc-950 border-zinc-900" : "bg-white border-zinc-200"
        )}>
          <button onClick={() => setIsSidebarOpen(true)} className={cn("p-2 transition-colors", isDarkMode ? "text-zinc-400 hover:text-white" : "text-zinc-500 hover:text-zinc-900")}>
            <Menu className="w-6 h-6" />
          </button>
          <h1 className="font-bold text-lg">Skofield Pro</h1>
          <div className="w-10" />
        </header>

        <Chat 
          chatId={selectedChatId} 
          onChatCreated={(id) => setSelectedChatId(id)} 
          isVoiceEnabled={isVoiceEnabled}
          isDarkMode={isDarkMode}
          initialPrompt={helpPrompt}
          mode={activeMode}
        />
      </main>

      {/* Modals */}
      <AnimatePresence>
        {modalType && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setModalType(null)}
              className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className={cn(
                "relative w-full max-w-lg border rounded-2xl shadow-2xl overflow-hidden transition-colors duration-300",
                isDarkMode ? "bg-zinc-900 border-zinc-800 text-white" : "bg-white border-zinc-200 text-zinc-900"
              )}
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-bold capitalize">{modalType.replace('-', ' ')}</h2>
                  <button onClick={() => setModalType(null)} className={cn("p-2 rounded-lg transition-all", isDarkMode ? "hover:bg-zinc-800" : "hover:bg-zinc-100")}>
                    <X className="w-5 h-5" />
                  </button>
                </div>
                
                <div className="space-y-4">
                  {modalType === 'settings' && (
                    <div className="space-y-4">
                      <div className={cn("flex items-center justify-between p-4 rounded-xl", isDarkMode ? "bg-zinc-800/50" : "bg-zinc-100")}>
                        <div className="flex flex-col">
                          <span className="font-medium">Theme</span>
                          <span className={cn("text-xs", isDarkMode ? "text-zinc-500" : "text-zinc-400")}>Switch between dark and light mode</span>
                        </div>
                        <button 
                          onClick={() => setIsDarkMode(!isDarkMode)}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-colors duration-300",
                            isDarkMode ? "bg-white" : "bg-zinc-300"
                          )}
                        >
                          <motion.div 
                            animate={{ x: isDarkMode ? 26 : 4 }}
                            className={cn(
                              "absolute top-1 w-4 h-4 rounded-full shadow-sm",
                              isDarkMode ? "bg-zinc-900" : "bg-white"
                            )}
                          />
                        </button>
                      </div>
                      <div className={cn("flex items-center justify-between p-4 rounded-xl", isDarkMode ? "bg-zinc-800/50" : "bg-zinc-100")}>
                        <div className="flex flex-col">
                          <span className="font-medium">Voice Responses</span>
                          <span className={cn("text-xs", isDarkMode ? "text-zinc-500" : "text-zinc-400")}>AI will read responses aloud</span>
                        </div>
                        <button 
                          onClick={() => setIsVoiceEnabled(!isVoiceEnabled)}
                          className={cn(
                            "w-12 h-6 rounded-full relative transition-colors duration-300",
                            isVoiceEnabled ? "bg-white" : "bg-zinc-300"
                          )}
                        >
                          <motion.div 
                            animate={{ x: isVoiceEnabled ? 26 : 4 }}
                            className={cn(
                              "absolute top-1 w-4 h-4 rounded-full shadow-sm",
                              isVoiceEnabled ? "bg-zinc-900" : "bg-white"
                            )}
                          />
                        </button>
                      </div>
                    </div>
                  )}
                  {modalType === 'profile' && (
                    <div className="text-center space-y-6">
                      <div className="relative w-24 h-24 mx-auto">
                        <div className="w-full h-full bg-zinc-800 rounded-full flex items-center justify-center text-3xl font-bold text-white shadow-xl border border-zinc-700">
                          {user.displayName?.[0] || user.email?.[0]?.toUpperCase()}
                        </div>
                        <button className="absolute bottom-0 right-0 p-2 bg-zinc-800 border border-zinc-700 rounded-full text-white hover:bg-zinc-700 transition-all shadow-lg">
                          <Edit2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="text-left">
                          <label className={cn("text-xs font-bold uppercase tracking-widest mb-1 block", isDarkMode ? "text-zinc-500" : "text-zinc-400")}>Display Name</label>
                          <div className="flex gap-2">
                            <input 
                              type="text" 
                              value={newDisplayName}
                              onChange={(e) => setNewDisplayName(e.target.value)}
                              disabled={!isEditingProfile}
                              className={cn(
                                "flex-1 px-4 py-2 rounded-xl border transition-all",
                                isDarkMode 
                                  ? "bg-zinc-800 border-zinc-700 text-white focus:border-white" 
                                  : "bg-zinc-50 border-zinc-200 text-zinc-900 focus:border-zinc-900",
                                !isEditingProfile && "opacity-50 cursor-not-allowed"
                              )}
                            />
                            {isEditingProfile ? (
                              <button 
                                onClick={handleUpdateProfile}
                                className={cn(
                                  "p-2 rounded-xl transition-all",
                                  isDarkMode ? "bg-white text-black hover:bg-zinc-200" : "bg-zinc-900 text-white hover:bg-zinc-800"
                                )}
                              >
                                <Check className="w-5 h-5" />
                              </button>
                            ) : (
                              <button 
                                onClick={() => setIsEditingProfile(true)}
                                className={cn("p-2 rounded-xl transition-all", isDarkMode ? "bg-zinc-800 hover:bg-zinc-700" : "bg-zinc-100 hover:bg-zinc-200")}
                              >
                                <Edit2 className="w-5 h-5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <div className="text-left">
                          <label className={cn("text-xs font-bold uppercase tracking-widest mb-1 block", isDarkMode ? "text-zinc-500" : "text-zinc-400")}>Email Address</label>
                          <div className={cn("px-4 py-2 rounded-xl border opacity-50", isDarkMode ? "bg-zinc-800 border-zinc-700" : "bg-zinc-50 border-zinc-200")}>
                            {user.email}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  {modalType === 'search' && (
                    <div className="relative">
                      <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-zinc-500" />
                      <input 
                        type="text" 
                        placeholder="Search your conversations..." 
                        className={cn(
                          "w-full border-none rounded-xl py-4 pl-12 pr-4 focus:ring-2 focus:ring-blue-600 transition-all shadow-inner",
                          isDarkMode ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900"
                        )}
                      />
                    </div>
                  )}
                  {modalType === 'help' && (
                    <div className="space-y-3">
                      <HelpItem 
                        title="How to generate images?" 
                        desc="Start your message with 'generate image:' followed by your prompt." 
                        onClick={() => handleHelpAction("generate image: A futuristic city with flying cars")}
                        isDarkMode={isDarkMode}
                      />
                      <HelpItem 
                        title="Voice commands" 
                        desc="Click the microphone icon to speak your request." 
                        onClick={() => handleHelpAction("How do I use voice commands?")}
                        isDarkMode={isDarkMode}
                      />
                      <HelpItem 
                        title="Google Search" 
                        desc="The AI uses real-time Google Search to answer your questions accurately." 
                        onClick={() => handleHelpAction("What can you search on Google for me?")}
                        isDarkMode={isDarkMode}
                      />
                    </div>
                  )}
                  {modalType === 'integrations' && (
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                      {[
                        { name: 'Canva', icon: 'Cv' },
                        { name: 'Adobe Express', icon: 'Ae' },
                        { name: 'Figma', icon: 'Fg' },
                        { name: 'Crella', icon: 'Cr' },
                        { name: 'Photoshop', icon: 'Ps' },
                        { name: 'Illustrator', icon: 'Ai' },
                        { name: 'CorelDraw', icon: 'Cd' },
                        { name: 'DALL·E', icon: 'De' },
                        { name: 'Midjourney', icon: 'Mj' },
                        { name: 'Stable Diffusion', icon: 'Sd' },
                        { name: 'Runway', icon: 'Rw' },
                        { name: 'Pika Labs', icon: 'Pk' },
                        { name: 'CapCut', icon: 'Cc' }
                      ].map((app) => (
                        <button 
                          key={app.name}
                          onClick={() => handleHelpAction(`Integrate with ${app.name}: `, 'apps')}
                          className={cn(
                            "flex flex-col items-center gap-2 p-4 rounded-xl border transition-all hover:scale-105",
                            isDarkMode ? "bg-zinc-800/50 border-zinc-700 hover:bg-zinc-800" : "bg-zinc-100 border-zinc-200 hover:bg-zinc-200"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shadow-md",
                            isDarkMode ? "bg-zinc-700 text-white" : "bg-white text-zinc-900"
                          )}>
                            {app.icon}
                          </div>
                          <span className="text-[11px] font-medium text-center">{app.name}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function SidebarLink({ icon, label, onClick, isDarkMode, isActive }: { icon: React.ReactNode; label: string; onClick?: () => void; isDarkMode: boolean; isActive?: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "flex items-center gap-3 w-full p-2 rounded-lg transition-all text-sm",
        isActive 
          ? (isDarkMode ? "bg-zinc-800 text-white" : "bg-zinc-100 text-zinc-900")
          : (isDarkMode ? "text-zinc-400 hover:text-white hover:bg-zinc-800" : "text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100")
      )}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function HelpItem({ title, desc, onClick, isDarkMode }: { title: string; desc: string; onClick: () => void; isDarkMode: boolean }) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full text-left p-4 rounded-xl transition-all border border-transparent hover:border-blue-500/50 group",
        isDarkMode ? "bg-zinc-800/50 hover:bg-zinc-800" : "bg-zinc-100 hover:bg-zinc-200"
      )}
    >
      <h4 className="font-bold text-sm mb-1 group-hover:text-blue-500 transition-colors">{title}</h4>
      <p className={cn("text-xs", isDarkMode ? "text-zinc-400" : "text-zinc-500")}>{desc}</p>
    </button>
  );
}


