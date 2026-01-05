import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    host: '0.0.0.0', // Écouter sur toutes les interfaces pour Docker
    // allowedHosts: true // Autoriser tous les hôtes (nécessaire pour certains env Docker)
  }
})
