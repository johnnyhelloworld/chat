import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function Profile() {
  const { user, token, login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState(user?.username || '');
  const [customColor, setCustomColor] = useState(user?.customColor || '#000000');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess('');

    try {
      const res = await axios.put(
        'http://localhost:3002/auth/profile',
        { username, customColor },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      
      if (token) {
        login(token, res.data);
      }
      
      setSuccess('Profil mis à jour !');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Erreur lors de la mise à jour');
    }
  };

  return (
    <div style={{ padding: 20, maxWidth: 400, margin: '0 auto' }}>
      <h1>Mon Profil</h1>
      {error && <p style={{ color: 'red' }}>{error}</p>}
      {success && <p style={{ color: 'green' }}>{success}</p>}
      
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div>
          <label>Username:</label>
          <input 
            type="text" 
            value={username} 
            onChange={(e) => setUsername(e.target.value)} 
            style={{ width: '100%', padding: 8 }}
          />
        </div>
        
        <div>
          <label>Couleur d'affichage:</label>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input 
              type="color" 
              value={customColor} 
              onChange={(e) => setCustomColor(e.target.value)}
              style={{ height: 40, width: 60 }}
            />
            <span style={{ color: customColor, fontWeight: 'bold' }}>Aperçu</span>
          </div>
        </div>

        <button type="submit" style={{ padding: 10, cursor: 'pointer' }}>Enregistrer</button>
      </form>

      <button onClick={() => navigate('/chat')} style={{ marginTop: 20 }}>Retour au Chat</button>
    </div>
  );
}