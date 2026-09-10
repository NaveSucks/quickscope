import { defineConfig } from 'vite';
export default defineConfig({root:'client',base:'/quickscope/game/',build:{outDir:'../dist',emptyOutDir:true,target:'es2022',chunkSizeWarningLimit:2500}});
