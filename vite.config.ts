import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Caminhos relativos permitem publicar tanto na raiz quanto em um repositório do GitHub Pages.
export default defineConfig({ base: './', plugins: [react()] })
