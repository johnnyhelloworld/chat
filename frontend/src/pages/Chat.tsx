import { useEffect, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

type Sender = { id: number; username: string; customColor: string };
type Reaction = { id: number; emoji: string; user: { id: number; username: string } };
type ChatMessage = { 
  id: number; 
  content: string; 
  createdAt: string; 
  sender: Sender;
  reactions: Reaction[];
};
type Room = { id: number; name: string; isPrivate: boolean; historyEnabled: boolean };
type UserSimple = { id: number; username: string };

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '😡', '🎉', '🔥', '👀', '🚀', '👎', '💩'];

export default function Chat() {
  const { user, token, logout } = useAuth();
  const navigate = useNavigate();
  
  // Chat State
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [typingUsers, setTypingUsers] = useState<string[]>([]);
  const [activeReactionId, setActiveReactionId] = useState<number | null>(null);
  const [hoveredMessageId, setHoveredMessageId] = useState<number | null>(null);
  
  // Rooms State
  const [rooms, setRooms] = useState<Room[]>([]);
  const [currentRoom, setCurrentRoom] = useState<Room | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [usersList, setUsersList] = useState<UserSimple[]>([]);
  
  // Create Room Form State
  const [newRoomName, setNewRoomName] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [historyEnabled, setHistoryEnabled] = useState(true);
  const [selectedParticipants, setSelectedParticipants] = useState<number[]>([]);

  const socketRef = useRef<Socket | null>(null);
  const typingTimeoutRef = useRef<number | null>(null);

  // Initial Data Load
  useEffect(() => {
    if (token) {
        fetchRooms();
        fetchUsers();
    }
  }, [token]);

  const fetchRooms = async () => {
    try {
        const res = await axios.get('http://localhost:3002/rooms', { headers: { Authorization: `Bearer ${token}` } });
        setRooms(res.data);
    } catch (e) { console.error("Error fetching rooms", e); }
  };

  const fetchUsers = async () => {
    try {
        const res = await axios.get('http://localhost:3002/rooms/users', { headers: { Authorization: `Bearer ${token}` } });
        setUsersList(res.data);
    } catch (e) { console.error("Error fetching users", e); }
  };

  const handleCreateRoom = async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const res = await axios.post('http://localhost:3002/rooms', {
            name: newRoomName,
            isPrivate,
            historyEnabled,
            participantIds: selectedParticipants
        }, { headers: { Authorization: `Bearer ${token}` } });
        
        setRooms(prev => [res.data, ...prev]);
        setShowCreateModal(false);
        setNewRoomName('');
        setIsPrivate(false);
        setHistoryEnabled(true);
        setSelectedParticipants([]);
        
        joinRoom(res.data.id);
      } catch (err) {
          alert('Erreur lors de la création du salon');
      }
  };

  const joinRoom = (roomId: number) => {
      if (socketRef.current) {
          socketRef.current.emit('chat:join', { roomId });
      }
  };

  useEffect(() => {
    if (!token) return;

    const newSocket = io('http://127.0.0.1:3002', {
      auth: { token },
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      autoConnect: false
    });

    socketRef.current = newSocket;

    newSocket.on('connect', () => {
        console.log("Connecté au WebSocket ! ID:", newSocket.id);
    });
    
    newSocket.on('chat:joined', (room: { roomId: number, name: string, isPrivate: boolean, historyEnabled: boolean }) => {
        console.log("Rejoint room:", room);
        setCurrentRoom({ 
            id: room.roomId, 
            name: room.name, 
            isPrivate: room.isPrivate, 
            historyEnabled: room.historyEnabled 
        });
    });

    
    newSocket.on('connect_error', (err) => {
        console.error("Erreur de connexion WebSocket:", err.message);
    });
    
    newSocket.on('disconnect', (reason) => {
        console.log("Déconnecté du WebSocket:", reason);
    });
    
    newSocket.on('chat:history', (history: ChatMessage[]) => {
      console.log("Historique reçu", history);
      setMessages(history);
    });

    newSocket.on('chat:new-message', (msg: ChatMessage) => {
      console.log("Nouveau message", msg);
      setMessages(prev => [...prev, msg]);
    });

    newSocket.on('chat:reaction-added', (payload: { messageId: number, reaction: Reaction }) => {
      setMessages(prev => prev.map(m => {
        if (m.id === payload.messageId) {
          return { ...m, reactions: [...(m.reactions || []), payload.reaction] };
        }
        return m;
      }));
    });

    newSocket.on('chat:typing', (list: string[]) => {
      setTypingUsers(list);
    });

    newSocket.on('chat:error', (err: string) => {
      console.error("Erreur Chat:", err);
      alert("Erreur Chat: " + err);
    });

    newSocket.connect();

    return () => {
      newSocket.off();
      newSocket.disconnect();
      socketRef.current = null;
    };
  }, [token, rooms]);

  useEffect(() => {
    if (!user) return;

    setMessages(prev => prev.map(m => {
      if (m.sender.id === user.id) {
        return { 
          ...m, 
          sender: { 
            ...m.sender, 
            username: user.username, 
            customColor: user.customColor 
          } 
        };
      }
      return m;
    }));

    if (socketRef.current) {
        socketRef.current.emit('chat:update-profile');
    }
  }, [user]);

  const sendMessage = () => {
    const content = input.trim();
    if (!content || !socketRef.current) return;
    socketRef.current.emit('chat:send', { content });
    setInput('');
    stopTyping();
  };

  const startTyping = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('chat:typing');
    if (typingTimeoutRef.current) window.clearTimeout(typingTimeoutRef.current);
    typingTimeoutRef.current = window.setTimeout(stopTyping, 5000);
  };

  const stopTyping = () => {
    if (!socketRef.current) return;
    socketRef.current.emit('chat:typing-stop');
    if (typingTimeoutRef.current) {
      window.clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
  };

  const reactToMessage = (messageId: number, emoji: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('chat:react', { messageId, emoji });
  };

  const handleReactionClick = (messageId: number, emoji: string) => {
    reactToMessage(messageId, emoji);
    setActiveReactionId(null);
  };

  const getGroupedReactions = (reactions: Reaction[]) => {
    const groups: Record<string, { count: number, hasReacted: boolean, users: string[] }> = {};
    if (!reactions) return [];
    reactions.forEach(r => {
      if (!groups[r.emoji]) {
        groups[r.emoji] = { count: 0, hasReacted: false, users: [] };
      }
      groups[r.emoji].count++;
      groups[r.emoji].users.push(r.user.username);
      if (user && r.user.id === user.id) groups[r.emoji].hasReacted = true;
    });
    return Object.entries(groups).sort((a, b) => b[1].count - a[1].count);
  };

  const filteredTypingUsers = typingUsers.filter(u => u !== user?.username);

  return (
    <div style={{ display: 'flex', height: '100vh', width: '100vw', overflow: 'hidden' }} onClick={() => setActiveReactionId(null)}>
      
      {/* Sidebar */}
      <div style={{ width: '250px', background: '#222', borderRight: '1px solid #444', display: 'flex', flexDirection: 'column', padding: '10px' }}>
         <div style={{ marginBottom: 20 }}>
            <h2 style={{ fontSize: '1.2em', margin: '0 0 10px 0' }}>Salons</h2>
            <button onClick={() => setShowCreateModal(true)} style={{ padding: '5px', fontSize: '0.9em' }}>+ Créer un salon</button>
         </div>
         
         <div style={{ flex: 1, overflowY: 'auto' }}>
            {rooms.map(room => (
                <div 
                    key={room.id}
                    onClick={() => joinRoom(room.id)}
                    style={{
                        padding: '10px',
                        cursor: 'pointer',
                        background: currentRoom?.id === room.id ? '#444' : 'transparent',
                        borderRadius: '4px',
                        marginBottom: '5px',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between'
                    }}
                >
                    <span>{room.isPrivate ? '🔒' : '#'} {room.name}</span>
                </div>
            ))}
         </div>

         <div style={{ borderTop: '1px solid #444', paddingTop: 10, marginTop: 10 }}>
            <div style={{ fontWeight: 'bold', marginBottom: 10 }}>{user?.username}</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <button onClick={() => navigate('/profile')} style={{ fontSize: '0.9em', padding: '6px' }}>Mon Profil</button>
                <button onClick={logout} style={{ fontSize: '0.9em', background: '#d32f2f', padding: '6px' }}>Déconnexion</button>
            </div>
         </div>
      </div>

      {/* Main Chat Area */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%' }}>
        <div style={{ padding: '10px', borderBottom: '1px solid #444', background: '#1a1a1a' }}>
            <h2 style={{ margin: 0 }}>{currentRoom ? (currentRoom.isPrivate ? '🔒 ' : '# ') + currentRoom.name : 'Sélectionnez un salon'}</h2>
        </div>

        <div style={{ flex: 1, padding: '10px', overflowY: 'auto', background: '#242424' }}>
            {messages.length === 0 && <p style={{color: '#888', textAlign: 'center', marginTop: 20}}>
                {currentRoom?.historyEnabled ? "Aucun message pour l'instant." : "L'historique est désactivé pour ce salon."}
            </p>}
            {messages.map(m => (
            <div 
                key={m.id} 
                style={{ marginBottom: 12, position: 'relative' }}
                onMouseEnter={() => setHoveredMessageId(m.id)}
                onMouseLeave={() => setHoveredMessageId(null)}
            >
                <span style={{ color: m.sender.customColor, fontWeight: 'bold' }}>{m.sender.username}: </span>
                <span style={{ marginLeft: 8 }}>{m.content}</span>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginTop: 4, alignItems: 'center', minHeight: '24px' }}>
                {getGroupedReactions(m.reactions || []).map(([emoji, data]) => (
                    <button
                        key={emoji}
                        onClick={(e) => { e.stopPropagation(); reactToMessage(m.id, emoji); }}
                        title={data.users.join(', ')}
                        style={{
                            fontSize: '0.85em',
                            background: data.hasReacted ? '#dbeafe' : '#f3f4f6',
                            border: data.hasReacted ? '1px solid #93c5fd' : '1px solid #e5e7eb',
                            color: '#333',
                            borderRadius: '12px',
                            padding: '2px 8px',
                            cursor: 'pointer',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                        }}
                    >
                        <span>{emoji}</span>
                        <span style={{ fontSize: '0.9em', fontWeight: 'bold', color: '#555' }}>{data.count}</span>
                    </button>
                ))}

                {(hoveredMessageId === m.id || activeReactionId === m.id) && (
                    <div style={{ position: 'relative' }}>
                        <button 
                            onClick={(e) => { e.stopPropagation(); setActiveReactionId(activeReactionId === m.id ? null : m.id); }}
                            style={{ 
                                border: 'none', 
                                background: '#f0f0f0', 
                                borderRadius: '50%',
                                width: '24px',
                                height: '24px',
                                cursor: 'pointer', 
                                fontSize: '1.2em',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                color: '#666'
                            }}
                            title="Ajouter une réaction"
                        >
                            +
                        </button>
                        
                        {activeReactionId === m.id && (
                            <div 
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                    position: 'absolute',
                                    bottom: '100%',
                                    left: 0,
                                    background: 'white',
                                    border: '1px solid #ddd',
                                    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
                                    borderRadius: '8px',
                                    padding: '8px',
                                    display: 'grid',
                                    gridTemplateColumns: 'repeat(6, 1fr)',
                                    gap: '4px',
                                    zIndex: 10,
                                    width: '220px',
                                    marginBottom: '5px'
                                }}
                            >
                                {EMOJIS.map(emoji => (
                                    <button
                                        key={emoji}
                                        onClick={() => handleReactionClick(m.id, emoji)}
                                        style={{
                                            fontSize: '1.4em',
                                            background: 'transparent',
                                            border: 'none',
                                            cursor: 'pointer',
                                            padding: '4px',
                                            borderRadius: '4px',
                                            transition: 'background 0.2s'
                                        }}
                                        onMouseEnter={(e) => e.currentTarget.style.background = '#f0f0f0'}
                                        onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                                    >
                                        {emoji}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                )}
                </div>
            </div>
            ))}
        </div>

        {filteredTypingUsers.length > 0 && (
            <div style={{ fontStyle: 'italic', padding: '0 10px', height: '20px', color: '#aaa', background: '#242424' }}>
            {filteredTypingUsers.length === 1
                ? `${filteredTypingUsers[0]} est en train d'écrire...`
                : `${filteredTypingUsers.slice(0, 3).join(', ')} ${filteredTypingUsers.length > 3 ? '...' : ''} sont en train d'écrire...`}
            </div>
        )}

        <div style={{ display: 'flex', gap: 12, padding: '20px 25px', background: '#333', alignItems: 'center', borderTop: '1px solid #444' }}>
            <input
            value={input}
            onChange={(e) => {
                setInput(e.target.value);
                startTyping();
            }}
            onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
            placeholder={`Envoyer un message dans ${currentRoom?.name || '...'}`}
            style={{ 
                flex: 1, 
                padding: '16px 20px', 
                borderRadius: '30px', 
                border: '1px solid #555', 
                background: '#2a2a2a', 
                color: 'white', 
                fontSize: '1.1em',
                outline: 'none'
            }}
            disabled={!currentRoom}
            />
            <button 
                onClick={sendMessage} 
                disabled={!currentRoom}
                style={{
                    padding: '0 24px',
                    height: '54px',
                    borderRadius: '27px',
                    border: 'none',
                    background: '#007bff',
                    color: 'white',
                    fontWeight: 'bold',
                    fontSize: '1em',
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                    opacity: !currentRoom ? 0.6 : 1,
                    whiteSpace: 'nowrap'
                }}
                onMouseEnter={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = '#0056b3')}
                onMouseLeave={(e) => !e.currentTarget.disabled && (e.currentTarget.style.background = '#007bff')}
            >
                Envoyer
            </button>
        </div>
      </div>

      {/* Modal Création Room */}
      {showCreateModal && (
        <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
            background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100
        }}>
            <div style={{ background: '#333', padding: 20, borderRadius: 8, width: 400, maxWidth: '90%' }}>
                <h3>Créer un nouveau salon</h3>
                <form onSubmit={handleCreateRoom}>
                    <div style={{ marginBottom: 10 }}>
                        <label>Nom du salon</label>
                        <input 
                            value={newRoomName} 
                            onChange={e => setNewRoomName(e.target.value)} 
                            required 
                            style={{ width: '100%', padding: 8, marginTop: 5 }}
                        />
                    </div>
                    
                    <div style={{ marginBottom: 10 }}>
                        <label>
                            <input 
                                type="checkbox" 
                                checked={isPrivate} 
                                onChange={e => setIsPrivate(e.target.checked)}
                            /> Salon Privé
                        </label>
                    </div>

                    <div style={{ marginBottom: 10 }}>
                        <label>
                            <input 
                                type="checkbox" 
                                checked={historyEnabled} 
                                onChange={e => setHistoryEnabled(e.target.checked)}
                            /> Activer l'historique
                        </label>
                    </div>

                    {isPrivate && (
                        <div style={{ marginBottom: 10 }}>
                            <label>Inviter des participants</label>
                            <div style={{ maxHeight: 150, overflowY: 'auto', border: '1px solid #555', padding: 5, marginTop: 5 }}>
                                {usersList.filter(u => u.id !== user?.id).map(u => (
                                    <div key={u.id} style={{ display: 'flex', alignItems: 'center', gap: 5, marginBottom: 5 }}>
                                        <input 
                                            type="checkbox"
                                            checked={selectedParticipants.includes(u.id)}
                                            onChange={(e) => {
                                                if (e.target.checked) setSelectedParticipants([...selectedParticipants, u.id]);
                                                else setSelectedParticipants(selectedParticipants.filter(id => id !== u.id));
                                            }}
                                        />
                                        <span>{u.username}</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
                        <button type="submit">Créer</button>
                        <button type="button" onClick={() => setShowCreateModal(false)} style={{ background: '#555' }}>Annuler</button>
                    </div>
                </form>
            </div>
        </div>
      )}

    </div>
  );
}
