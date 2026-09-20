import axios from 'axios'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'
import { logError, logInfo } from './logger'

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

const rawApiBaseUrl = import.meta.env.VITE_API_URL || '/api'
export const API_BASE_URL = rawApiBaseUrl.replace(/\/$/, '')
const BACKEND_BASE_URL = API_BASE_URL === '/api'
  ? ''
  : API_BASE_URL.endsWith('/api')
    ? API_BASE_URL.slice(0, -4)
    : API_BASE_URL

const http = axios.create({
  baseURL: API_BASE_URL,
  timeout: 10000,
})

logInfo('api', 'Client initialized', {
  API_BASE_URL,
  BACKEND_BASE_URL: BACKEND_BASE_URL || '(same-origin)',
})

http.interceptors.request.use((config) => {
  logInfo('api', 'HTTP request started', {
    method: config.method,
    url: `${config.baseURL || ''}${config.url || ''}`,
  })
  return config
})

http.interceptors.response.use(
  (response) => {
    logInfo('api', 'HTTP request completed', {
      method: response.config.method,
      url: `${response.config.baseURL || ''}${response.config.url || ''}`,
      status: response.status,
    })
    return response
  },
  (error) => {
    logError('api', 'HTTP request failed', {
      message: error?.message,
      method: error?.config?.method,
      url: `${error?.config?.baseURL || ''}${error?.config?.url || ''}`,
      status: error?.response?.status,
      response: error?.response?.data,
    })
    return Promise.reject(error)
  },
)

async function unwrap<T>(request: Promise<{ data: T }>): Promise<T> {
  const { data } = await request
  return data
}

export function createSocketConnection(): Socket {
  const socket = BACKEND_BASE_URL ? io(BACKEND_BASE_URL) : io()

  socket.on('connect', () => {
    logInfo('socket', 'Socket connected', { id: socket.id, endpoint: BACKEND_BASE_URL || window.location.origin })
  })
  socket.on('disconnect', (reason) => {
    logInfo('socket', 'Socket disconnected', { reason })
  })
  socket.on('connect_error', (err) => {
    logError('socket', 'Socket connection error', { message: err.message })
  })

  return socket
}

export function getPhotoUrl(filename: string): string {
  return `${BACKEND_BASE_URL}/uploads/${filename}`
}

export async function uploadPhoto(formData: FormData) {
  return unwrap(http.post('/upload', formData))
}

export async function getPhotos() {
  return unwrap(http.get('/photos'))
}

export async function deletePhoto(id: string) {
  return unwrap(http.delete(`/photos/${id}`))
}

export async function updatePhotoDisplayTime(id: string, displayTime: number | null) {
  return unwrap(http.put(`/photos/${id}`, { display_time: displayTime }))
}

export async function getConfig(key: string) {
  return unwrap<{ value: string | null }>(http.get(`/config/${key}`))
}

export async function setConfig(key: string, value: string | number) {
  return unwrap(http.put('/config', { key, value }))
}
