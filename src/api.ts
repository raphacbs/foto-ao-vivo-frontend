import axios from 'axios'
import { io } from 'socket.io-client'
import type { Socket } from 'socket.io-client'

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

async function unwrap<T>(request: Promise<{ data: T }>): Promise<T> {
  const { data } = await request
  return data
}

export function createSocketConnection(): Socket {
  return BACKEND_BASE_URL ? io(BACKEND_BASE_URL) : io()
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
