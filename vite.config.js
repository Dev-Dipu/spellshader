import { defineConfig } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig({
  resolve: {
    alias: [
      { find: 'common', replacement: path.resolve(__dirname, 'modules/common.js') },
      { find: 'maf', replacement: path.resolve(__dirname, 'modules/maf.js') },
      { find: 'guspira', replacement: path.resolve(__dirname, 'third_party/guspira.js') },
      { find: 'easings', replacement: path.resolve(__dirname, 'modules/easings.js') },
      { find: /^three$/, replacement: path.resolve(__dirname, 'third_party/three.module.js') },
      { find: 'three', replacement: path.resolve(__dirname, 'third_party') },
      { find: 'third_party', replacement: path.resolve(__dirname, 'third_party') },
      { find: 'shaders', replacement: path.resolve(__dirname, 'shaders') },
      { find: 'modules', replacement: path.resolve(__dirname, 'modules') },
    ],
  },
  assetsInclude: ['**/*.bin', '**/*.hdr', '**/*.obj', '**/*.mp3', '**/*.webp'],
  server: {
    port: 5173,
    open: true,
  },
});
