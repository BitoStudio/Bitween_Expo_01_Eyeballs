import basicSsl from '@vitejs/plugin-basic-ssl'
import { defineConfig } from 'vite'

/**
 * `npm run dev` serves plain HTTP, which is all localhost needs.
 *
 * `npm run dev:lan` adds a self-signed certificate. getUserMedia only exists
 * in a secure context, so over http:// a phone or tablet on the venue LAN
 * silently loses the camera and the piece stops working. Mode is used rather
 * than an env var because `VAR=x cmd` is not a thing on Windows.
 */
export default defineConfig(({ mode }) => ({
  plugins: mode === 'lan' ? [basicSsl()] : [],
  // host: true binds every interface. Vite defaults to localhost, which is
  // loopback only and therefore invisible from any other machine.
  server: { host: true, port: 5273, strictPort: true },
  preview: { host: true, port: 5274, strictPort: true },
}))
