import { useState } from 'react';
import axios from 'axios';
import { useAuth } from '../context/AuthContext';
import { useNavigate, Link } from 'react-router-dom';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await axios.post('http://localhost:3002/auth/login', { email, password });
      
      const token = res.data.access_token;
      
      const payload = JSON.parse(atob(token.split('.')[1]));
      
      login(token, { 
          id: payload.sub, 
          email: payload.email, 
          username: payload.username,
          customColor: '#000000'
      });
      
      navigate('/chat');
    } catch (error) {
      alert('Login failed');
      console.error(error);
    }
  };

  return (
    <div className="card">
      <h2>Login</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Email</label>
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </div>
        <div className="form-group">
          <label>Password</label>
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
        </div>
        <button type="submit">Se connecter</button>
      </form>
      <p style={{marginTop: '1rem'}}>
        Pas de compte ? <Link to="/register">S'inscrire</Link>
      </p>
    </div>
  );
}