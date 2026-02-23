/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  ChevronLeft,
  Settings,
  Share2,
  Trash2,
  Paperclip,
  Mic,
  Send,
  Plus,
  Heart,
  Volume2,
  CircleUser,
  Wand2,
  Camera,
  Home,
  Moon,
  Bell
} from 'lucide-react';
import { Character, Screen, Message } from './types';
import {
  fetchCharacters,
  createCharacter,
  updateCharacter,
  deleteCharacter,
  fetchMessages,
  sendMessage,
  clearMessages,
  generateSpeech,
} from './services/apiService';

export default function App() {
  const [currentScreen, setCurrentScreen] = useState<Screen>('home');
  const [characters, setCharacters] = useState<Character[]>([]);
  const [selectedCharacter, setSelectedCharacter] = useState<Character | null>(null);
  const [chatMessages, setChatMessages] = useState<Record<string, Message[]>>({});
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showClearModal, setShowClearModal] = useState(false);
  const [showShareSheet, setShowShareSheet] = useState(false);
  const [showIntimacyToast, setShowIntimacyToast] = useState(false);
  const [activeTab, setActiveTab] = useState<'home' | 'create'>('home');
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [notifications, setNotifications] = useState(true);
  const [selectedVoice, setSelectedVoice] = useState('默认甜美女声');
  const [newName, setNewName] = useState('');
  const [newPersonality, setNewPersonality] = useState('温暖型');
  const [newDescription, setNewDescription] = useState('');
  const [newAvatar, setNewAvatar] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlayingVoice, setIsPlayingVoice] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chatFileInputRef = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // 启动时从后端加载角色列表
  useEffect(() => {
    fetchCharacters()
      .then(chars => setCharacters(chars))
      .catch(err => console.error('加载角色失败:', err));
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [chatMessages, currentScreen]);

  const handleStartChat = (char: Character) => {
    setSelectedCharacter(char);
    setCurrentScreen('chat');
    if (!chatMessages[char.id]) {
      fetchMessages(char.id)
        .then(messages => {
          setChatMessages(prev => ({
            ...prev,
            [char.id]: messages.length > 0 ? messages : [{
              id: 'initial',
              text: char.intro,
              isUser: false,
              timestamp: Date.now(),
            }],
          }));
        })
        .catch(() => {
          setChatMessages(prev => ({
            ...prev,
            [char.id]: [{ id: 'initial', text: char.intro, isUser: false, timestamp: Date.now() }],
          }));
        });
    }
  };

  const handleSendMessage = async () => {
    if (!inputText.trim() || !selectedCharacter) return;

    const charId = selectedCharacter.id;
    const userMsg: Message = {
      id: Date.now().toString(),
      text: inputText,
      isUser: true,
      timestamp: Date.now(),
    };

    setChatMessages(prev => ({
      ...prev,
      [charId]: [...(prev[charId] || []), userMsg],
    }));
    setInputText('');
    setShowIntimacyToast(true);
    setTimeout(() => setShowIntimacyToast(false), 2000);

    setIsTyping(true);
    try {
      const aiMsg = await sendMessage(charId, userMsg.text);
      setChatMessages(prev => ({
        ...prev,
        [charId]: [...(prev[charId] || []), aiMsg],
      }));
    } catch (error) {
      console.error('发送消息失败:', error);
    } finally {
      setIsTyping(false);
    }
  };

  const clearChat = async () => {
    if (selectedCharacter) {
      await clearMessages(selectedCharacter.id).catch(console.error);
      setChatMessages(prev => ({
        ...prev,
        [selectedCharacter.id]: [{
          id: 'initial',
          text: selectedCharacter.intro,
          isUser: false,
          timestamp: Date.now(),
        }],
      }));
    }
    setShowClearModal(false);
  };

  const handleAvatarUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setNewAvatar(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleChatFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file && selectedCharacter) {
      const userMsg: Message = {
        id: Date.now().toString(),
        text: `[文件] ${file.name}`,
        isUser: true,
        timestamp: Date.now(),
      };
      setChatMessages(prev => ({
        ...prev,
        [selectedCharacter.id]: [...(prev[selectedCharacter.id] || []), userMsg],
      }));
    }
  };

  const toggleVoiceInput = () => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('您的浏览器不支持语音识别');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.onstart = () => setIsRecording(true);
    recognition.onend = () => setIsRecording(false);
    recognition.onresult = (event: any) => {
      const transcript = event.results[0][0].transcript;
      setInputText(prev => prev + transcript);
    };

    recognition.start();
    recognitionRef.current = recognition;
  };

  const playVoiceMessage = async (text: string, msgId: string) => {
    if (isPlayingVoice === msgId) {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsPlayingVoice(null);
      return;
    }

    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current = null;
    }

    setIsPlayingVoice(msgId);
    try {
      let voiceName = 'Kore';
      if (selectedVoice === '磁性男生') voiceName = 'Zephyr';
      if (selectedVoice === '可爱萌宠') voiceName = 'Puck';

      const base64Audio = await generateSpeech(text, voiceName);
      if (base64Audio) {
        const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
        audioRef.current = audio;
        audio.onended = () => {
          setIsPlayingVoice(null);
          audioRef.current = null;
        };
        audio.play();
      } else {
        setIsPlayingVoice(null);
      }
    } catch (error) {
      console.error('语音播放失败:', error);
      setIsPlayingVoice(null);
    }
  };

  const handleSaveCharacter = async () => {
    if (!newName.trim()) return;

    if (isEditing && selectedCharacter) {
      const updatedChar = await updateCharacter(selectedCharacter.id, {
        ...selectedCharacter,
        name: newName,
        avatar: newAvatar || selectedCharacter.avatar,
        description: newDescription,
        personality: newPersonality,
        voice: selectedVoice,
      });
      setCharacters(prev => prev.map(c => c.id === selectedCharacter.id ? updatedChar : c));
      setSelectedCharacter(updatedChar);
    } else {
      const newChar = await createCharacter({
        id: Date.now().toString(),
        name: newName,
        avatar: newAvatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(newName)}`,
        description: newDescription || '一个新伙伴',
        intro: `我是${newName}，很高兴认识你！`,
        level: 'Lv1 · 初识',
        personality: newPersonality,
        voice: selectedVoice,
      });
      setCharacters(prev => [newChar, ...prev]);
    }

    setNewName('');
    setNewDescription('');
    setNewAvatar(null);
    setNewPersonality('温暖型');
    setIsEditing(false);
    setCurrentScreen('home');
    setActiveTab('home');
  };

  const handleDeleteCharacter = async () => {
    if (!selectedCharacter) return;
    await deleteCharacter(selectedCharacter.id).catch(console.error);
    setCharacters(prev => prev.filter(c => c.id !== selectedCharacter.id));
    setChatMessages(prev => {
      const next = { ...prev };
      delete next[selectedCharacter.id];
      return next;
    });
    setCurrentScreen('home');
  };

  const renderHomeScreen = () => (
    <div className="flex flex-col h-full bg-gray-50">
      <header className="sticky top-0 z-10 bg-white/80 backdrop-blur-md border-b border-orange-100 px-4 h-16 flex items-center justify-between">
        <h1 className="text-xl font-bold tracking-tight">AI心语伙伴</h1>
        <button
          onClick={() => setShowSettingsModal(true)}
          className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-orange-50 transition-colors"
        >
          <Settings className="w-6 h-6 text-slate-600" />
        </button>
      </header>

      <main className="flex-1 p-4 space-y-4 pb-24 overflow-y-auto">
        {characters.map(char => (
          <motion.div
            key={char.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white p-4 rounded-2xl shadow-sm border border-slate-100 flex items-center gap-4"
          >
            <div
              className="w-[50px] h-[50px] rounded-full overflow-hidden border-2 border-orange-100 flex-shrink-0 cursor-pointer"
              onClick={() => { setSelectedCharacter(char); setCurrentScreen('detail'); }}
            >
              <img src={char.avatar} alt={char.name} className="w-full h-full object-cover" />
            </div>
            <div className="flex-1 min-w-0" onClick={() => { setSelectedCharacter(char); setCurrentScreen('detail'); }}>
              <h3 className="text-[16px] font-bold truncate">{char.name}</h3>
              <p className="text-[14px] text-slate-500 truncate">{char.description}</p>
            </div>
            <button
              onClick={() => handleStartChat(char)}
              className="bg-primary hover:bg-brand text-white px-5 py-1.5 rounded-full text-sm font-medium transition-transform active:scale-95 whitespace-nowrap"
            >
              去聊天
            </button>
          </motion.div>
        ))}
      </main>

      <nav className="fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-lg border-t border-slate-100 flex justify-around items-center px-4 pb-8 pt-2 h-20 z-30">
        <button
          onClick={() => { setCurrentScreen('home'); setActiveTab('home'); }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'home' ? 'text-primary' : 'text-slate-400'}`}
        >
          <Home className={`w-6 h-6 ${activeTab === 'home' ? 'fill-current' : ''}`} />
          <span className="text-xs font-medium">首页</span>
        </button>
        <button
          onClick={() => {
            setNewName('');
            setNewDescription('');
            setNewAvatar(null);
            setNewPersonality('温暖型');
            setSelectedVoice('默认甜美女声');
            setIsEditing(false);
            setCurrentScreen('create');
            setActiveTab('create');
          }}
          className={`flex flex-col items-center gap-1 ${activeTab === 'create' ? 'text-primary' : 'text-slate-400'}`}
        >
          <Plus className={`w-6 h-6 ${activeTab === 'create' ? 'fill-current' : ''}`} />
          <span className="text-xs font-medium">创建角色</span>
        </button>
      </nav>
    </div>
  );

  const renderDetailScreen = () => {
    if (!selectedCharacter) return null;
    return (
      <div className="flex flex-col h-full bg-[#FDFCFB]">
        <header className="flex items-center justify-between px-4 py-4 bg-white/80 backdrop-blur-md sticky top-0 z-30">
          <button onClick={() => setCurrentScreen('home')} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
            <ChevronLeft className="w-6 h-6" />
          </button>
          <h1 className="text-lg font-semibold">{selectedCharacter.name}</h1>
          <div className="flex gap-2">
            <button onClick={() => setShowShareSheet(true)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <Share2 className="w-5 h-5 text-slate-600" />
            </button>
            <button
              onClick={handleDeleteCharacter}
              className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors text-red-400"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main className="flex-1 flex flex-col items-center px-6 pt-10 pb-20">
          <section className="flex flex-col items-center text-center space-y-4">
            <div className="relative">
              <img
                src={selectedCharacter.avatar}
                alt={selectedCharacter.name}
                className="w-[120px] h-[120px] object-cover shadow-lg border-4 border-white rounded-[30px]"
              />
              <div className="absolute -bottom-2 right-0 bg-yellow-400 w-6 h-6 rounded-full border-2 border-white flex items-center justify-center">
                <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 2 }}>
                  <Plus className="w-3 h-3 text-white fill-current" />
                </motion.div>
              </div>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-slate-800">{selectedCharacter.name}</h2>
              <div className="mt-2 inline-flex items-center px-3 py-1 bg-primary-light text-brand text-xs font-semibold rounded-full">
                {selectedCharacter.level}
              </div>
            </div>
            <p className="text-slate-500 text-sm leading-relaxed max-w-[280px]">
              {selectedCharacter.intro}
            </p>
          </section>

          <section className="w-full mt-12 space-y-4 max-w-xs">
            <button
              onClick={() => handleStartChat(selectedCharacter)}
              className="w-full py-4 bg-primary text-white font-bold text-lg shadow-lg shadow-orange-200 hover:scale-[0.98] transition-transform rounded-[30px]"
            >
              开始聊天
            </button>
            <button
              onClick={() => {
                setNewName(selectedCharacter.name);
                setNewDescription(selectedCharacter.description);
                setNewAvatar(selectedCharacter.avatar);
                setNewPersonality(selectedCharacter.personality);
                setSelectedVoice(selectedCharacter.voice);
                setIsEditing(true);
                setCurrentScreen('create');
              }}
              className="w-full py-4 border-2 border-slate-200 text-slate-600 font-semibold text-lg hover:bg-slate-50 transition-colors rounded-[30px]"
            >
              编辑角色
            </button>
          </section>
        </main>
      </div>
    );
  };

  const renderChatScreen = () => {
    if (!selectedCharacter) return null;
    const messages = chatMessages[selectedCharacter.id] || [];

    return (
      <div className="flex flex-col h-full bg-white relative">
        <header className="fixed top-0 left-0 right-0 z-50 blur-bg border-b border-gray-100 px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button onClick={() => setCurrentScreen('home')} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 transition-colors">
              <ChevronLeft className="w-6 h-6" />
            </button>
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => setCurrentScreen('detail')}
            >
              <img src={selectedCharacter.avatar} alt="Avatar" className="w-8 h-8 rounded-full border border-gray-100" />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <h1 className="font-bold text-base">{selectedCharacter.name} Partner</h1>
                  <span className="bg-primary text-white text-[10px] px-2 py-0.5 rounded-full font-semibold">
                    {selectedCharacter.level.split(' · ')[0]}
                  </span>
                </div>
                <span className="text-[10px] text-green-500 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-500 rounded-full"></span> 在线
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={() => setShowShareSheet(true)} className="p-2 text-gray-500 hover:text-primary transition-colors">
              <Share2 className="w-5 h-5" />
            </button>
            <button onClick={() => setShowClearModal(true)} className="p-2 text-gray-500 hover:text-red-500 transition-colors">
              <Trash2 className="w-5 h-5" />
            </button>
          </div>
        </header>

        <main
          ref={scrollRef}
          className="flex-1 pt-20 pb-24 px-4 flex flex-col gap-6 overflow-y-auto message-container"
        >
          {messages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, x: msg.isUser ? 20 : -20 }}
              animate={{ opacity: 1, x: 0 }}
              className={`flex items-start gap-3 ${msg.isUser ? 'self-end max-w-[85%]' : 'max-w-[85%]'}`}
            >
              {!msg.isUser && (
                <div className="flex-shrink-0">
                  <img src={selectedCharacter.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-gray-100 shadow-sm" />
                </div>
              )}
              <div className={`flex flex-col ${msg.isUser ? 'items-end' : ''} gap-1`}>
                <div className={`${msg.isUser ? 'bg-chat-user rounded-tl-[18px]' : 'bg-primary-light rounded-tr-[18px]'} p-3 rounded-br-[18px] rounded-bl-[18px] text-sm leading-relaxed text-gray-800`}>
                  {msg.text}
                </div>
                {!msg.isUser && (
                  <button
                    onClick={() => playVoiceMessage(msg.text, msg.id)}
                    className={`flex items-center gap-1 transition-colors mt-1 ${isPlayingVoice === msg.id ? 'text-primary' : 'text-gray-400 hover:text-primary'}`}
                  >
                    <Volume2 className={`w-3 h-3 ${isPlayingVoice === msg.id ? 'animate-pulse' : ''}`} />
                    <span className="text-[10px]">{isPlayingVoice === msg.id ? '正在播放...' : '点击收听'}</span>
                  </button>
                )}
              </div>
              {msg.isUser && (
                <div className="flex-shrink-0">
                  <div className="w-10 h-10 flex items-center justify-center bg-gray-200 rounded-full">
                    <CircleUser className="w-8 h-8 text-gray-400" />
                  </div>
                </div>
              )}
            </motion.div>
          ))}
          {isTyping && (
            <div className="flex items-start gap-3 max-w-[85%]">
              <div className="flex-shrink-0">
                <img src={selectedCharacter.avatar} alt="Avatar" className="w-10 h-10 rounded-full border border-gray-100 shadow-sm" />
              </div>
              <div className="bg-primary-light p-3 rounded-tr-[18px] rounded-br-[18px] rounded-bl-[18px] text-sm">
                <div className="flex gap-1">
                  <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1 }}>.</motion.span>
                  <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.2 }}>.</motion.span>
                  <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ repeat: Infinity, duration: 1, delay: 0.4 }}>.</motion.span>
                </div>
              </div>
            </div>
          )}
          <div className="h-4" />
        </main>

        <AnimatePresence>
          {showIntimacyToast && (
            <motion.div
              initial={{ opacity: 0, y: 0 }}
              animate={{ opacity: 1, y: -40 }}
              exit={{ opacity: 0 }}
              className="fixed bottom-32 left-1/2 -translate-x-1/2 text-primary font-bold text-xs flex items-center gap-1 z-50"
            >
              <Heart className="w-3 h-3 fill-current" /> 亲密度 +1
            </motion.div>
          )}
        </AnimatePresence>

        <footer className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-100 p-3 pb-8 flex items-center gap-2 z-50">
          <input
            type="file"
            ref={chatFileInputRef}
            onChange={handleChatFileUpload}
            className="hidden"
          />
          <button
            onClick={() => chatFileInputRef.current?.click()}
            className="p-2 text-gray-400 hover:text-primary"
          >
            <Paperclip className="w-6 h-6" />
          </button>
          <div className="flex-grow bg-gray-50 rounded-full px-4 py-2 flex items-center border border-gray-200 focus-within:border-primary transition-colors">
            <input
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              className="bg-transparent border-none focus:ring-0 w-full text-sm p-0 placeholder-gray-400"
              placeholder="聊聊此时此刻的心情..."
              type="text"
            />
          </div>
          <button
            onClick={toggleVoiceInput}
            className={`p-2 transition-colors ${isRecording ? 'text-primary animate-pulse' : 'text-gray-400 hover:text-primary'}`}
          >
            <Mic className="w-6 h-6" />
          </button>
          <button
            onClick={handleSendMessage}
            disabled={!inputText.trim()}
            className="bg-brand text-white w-10 h-10 rounded-full flex items-center justify-center shadow-lg active:scale-95 transition-transform disabled:opacity-50"
          >
            <Send className="w-4 h-4 ml-0.5" />
          </button>
        </footer>

        {/* Clear Modal */}
        <AnimatePresence>
          {showClearModal && (
            <div className="fixed inset-0 z-[100] flex items-center justify-center p-6">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setShowClearModal(false)}
                className="absolute inset-0 bg-black/40 backdrop-blur-sm"
              />
              <motion.div
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white w-full max-w-[280px] rounded-[20px] overflow-hidden shadow-2xl relative z-10"
              >
                <div className="p-6 text-center">
                  <h3 className="text-[18px] font-bold mb-2">清空聊天记录</h3>
                  <p className="text-gray-500 text-[14px]">确定清空所有聊天记录吗？</p>
                </div>
                <div className="flex border-t border-gray-100">
                  <button
                    onClick={() => setShowClearModal(false)}
                    className="flex-1 py-4 text-gray-400 font-medium hover:bg-gray-50 transition-colors border-r border-gray-100 text-[16px]"
                  >
                    取消
                  </button>
                  <button
                    onClick={clearChat}
                    className="flex-1 py-4 text-brand font-bold hover:bg-orange-50 transition-colors text-[16px]"
                  >
                    清空
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  const renderCreateScreen = () => (
    <div className="flex flex-col h-full bg-[#f9f7f2]">
      <header className="sticky top-0 z-50 bg-[#f9f7f2]/80 backdrop-blur-md px-4 py-3 flex items-center justify-between border-b border-gray-100">
        <button onClick={() => setCurrentScreen('home')} className="text-gray-500 text-base font-medium">取消</button>
        <h1 className="text-lg font-bold text-gray-900">{isEditing ? '编辑角色' : '创建新角色'}</h1>
        <button onClick={handleSaveCharacter} className="text-brand font-bold text-base">保存</button>
      </header>

      <main className="flex-1 overflow-y-auto px-6 pt-8 pb-32 no-scrollbar">
        <section className="flex flex-col items-center mb-8">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleAvatarUpload}
            accept="image/*"
            className="hidden"
          />
          <div
            onClick={() => fileInputRef.current?.click()}
            className="relative w-20 h-20 bg-gray-200 rounded-full flex items-center justify-center text-gray-400 group cursor-pointer transition-transform active:scale-95 overflow-hidden"
          >
            {newAvatar ? (
              <img src={newAvatar} alt="Avatar Preview" className="w-full h-full object-cover" />
            ) : (
              <Camera className="w-8 h-8" />
            )}
            <div className="absolute -bottom-1 -right-1 bg-brand text-white rounded-full w-6 h-6 flex items-center justify-center border-2 border-[#f9f7f2]">
              <Plus className="w-3 h-3" />
            </div>
          </div>
          <p className="mt-3 text-xs text-gray-400">点击上传头像</p>
        </section>

        <form className="space-y-8" onSubmit={e => e.preventDefault()}>
          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">角色名称</label>
            <input
              value={newName}
              onChange={e => setNewName(e.target.value)}
              className="w-full bg-white border-0 ring-1 ring-gray-200 rounded-full px-5 py-3 focus:ring-2 focus:ring-brand focus:outline-none transition-all placeholder:text-gray-300"
              placeholder="给角色起个名字"
              type="text"
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 ml-1">性格类型</label>
            <div className="flex flex-wrap gap-3">
              {['温暖型', '幽默型', '治愈型'].map((type) => (
                <button
                  key={type}
                  onClick={() => setNewPersonality(type)}
                  className={`px-5 py-2 rounded-full border text-sm font-medium transition-colors ${newPersonality === type ? 'border-brand bg-orange-50 text-brand' : 'border-gray-200 bg-white text-gray-500'}`}
                  type="button"
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-bold text-gray-700 ml-1">角色介绍</label>
            <textarea
              value={newDescription}
              onChange={e => setNewDescription(e.target.value)}
              className="w-full bg-white border-0 ring-1 ring-gray-200 rounded-2xl px-5 py-4 focus:ring-2 focus:ring-brand focus:outline-none transition-all placeholder:text-gray-300 resize-none"
              placeholder="简单介绍一下这个角色吧..."
              rows={4}
            />
          </div>

          <div className="space-y-3">
            <label className="block text-sm font-bold text-gray-700 ml-1">语音选择</label>
            <div className="flex flex-wrap gap-3">
              {['默认甜美女声', '磁性男生', '可爱萌宠'].map((voice) => (
                <button
                  key={voice}
                  onClick={() => setSelectedVoice(voice)}
                  className={`px-5 py-2 rounded-full border text-sm font-medium transition-colors ${selectedVoice === voice ? 'border-brand bg-orange-50 text-brand' : 'border-gray-200 bg-white text-gray-500'}`}
                  type="button"
                >
                  {voice}
                </button>
              ))}
            </div>
          </div>
        </form>
      </main>

      <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-[#f9f7f2] via-[#f9f7f2] to-transparent">
        <div className="max-w-md mx-auto">
          <button
            onClick={handleSaveCharacter}
            className="w-full bg-brand hover:bg-brand-dark text-white font-bold py-4 rounded-full shadow-lg shadow-orange-200 transition-all active:scale-95 flex items-center justify-center gap-2"
          >
            <span>{isEditing ? '保存修改' : '立即创建'}</span>
            <Wand2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-[390px] h-[884px] mx-auto bg-white shadow-2xl overflow-hidden relative border border-gray-100">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentScreen}
          initial={{ opacity: 0, x: 10 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: -10 }}
          className="h-full"
        >
          {currentScreen === 'home' && renderHomeScreen()}
          {currentScreen === 'detail' && renderDetailScreen()}
          {currentScreen === 'chat' && renderChatScreen()}
          {currentScreen === 'create' && renderCreateScreen()}
        </motion.div>
      </AnimatePresence>

      {/* Share Sheet */}
      <AnimatePresence>
        {showShareSheet && (
          <div className="fixed inset-0 z-[110] flex items-end justify-center">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowShareSheet(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              className="bg-white w-full max-w-[390px] rounded-t-[20px] p-6 pb-10 relative z-10"
            >
              <h3 className="text-center text-[14px] font-medium text-gray-500 mb-8">分享到</h3>
              <div className="grid grid-cols-4 gap-4 mb-10">
                {[
                  { name: '微信', color: '#07C160', icon: '💬' },
                  { name: '微博', color: '#E6162D', icon: '🌐' },
                  { name: 'QQ', color: '#1296DB', icon: '🐧' },
                  { name: '更多', color: '#999', icon: '...' }
                ].map(platform => (
                  <div key={platform.name} className="flex flex-col items-center gap-2 cursor-pointer active:scale-90 transition-transform">
                    <div className="w-12 h-12 flex items-center justify-center text-2xl" style={{ color: platform.color }}>
                      {platform.icon}
                    </div>
                    <span className="text-[12px] text-gray-600">{platform.name}</span>
                  </div>
                ))}
              </div>
              <button
                onClick={() => setShowShareSheet(false)}
                className="w-full h-[50px] bg-white border-t border-gray-100 text-gray-800 font-medium active:bg-gray-50 transition-colors"
              >
                取消
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Settings Modal */}
      <AnimatePresence>
        {showSettingsModal && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-6">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowSettingsModal(false)}
              className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white w-full max-w-[320px] rounded-[24px] overflow-hidden shadow-2xl relative z-10 p-6"
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold">设置</h3>
                <button onClick={() => setShowSettingsModal(false)} className="text-slate-400">
                  <Plus className="w-6 h-6 rotate-45" />
                </button>
              </div>

              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <Moon className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">深色模式</p>
                      <p className="text-xs text-slate-400">切换应用主题</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setDarkMode(!darkMode)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${darkMode ? 'bg-primary' : 'bg-slate-200'}`}
                  >
                    <motion.div
                      animate={{ x: darkMode ? 24 : 2 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center">
                      <Bell className="w-5 h-5 text-slate-600" />
                    </div>
                    <div>
                      <p className="font-semibold text-sm">消息通知</p>
                      <p className="text-xs text-slate-400">接收伙伴的消息提醒</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setNotifications(!notifications)}
                    className={`w-12 h-6 rounded-full transition-colors relative ${notifications ? 'bg-primary' : 'bg-slate-200'}`}
                  >
                    <motion.div
                      animate={{ x: notifications ? 24 : 2 }}
                      className="absolute top-1 left-0 w-4 h-4 bg-white rounded-full shadow-sm"
                    />
                  </button>
                </div>
              </div>

              <button
                onClick={() => setShowSettingsModal(false)}
                className="w-full mt-8 py-3 bg-slate-100 text-slate-600 font-bold rounded-full hover:bg-slate-200 transition-colors"
              >
                完成
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
