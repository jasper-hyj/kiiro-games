import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
// es2020 + safari14 keeps older iPhones (iOS 14+) working
export default defineConfig({ plugins: [react()], build: { target: ['es2020', 'safari14', 'chrome87', 'firefox78'] } })
