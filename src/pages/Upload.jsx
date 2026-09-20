import React, { useRef, useState, useEffect } from 'react'
import { uploadPhoto } from '../api'
import { logError, logInfo } from '../logger'
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CircularProgress,
  IconButton,
  Snackbar,
  Stack,
  Typography,
} from '@mui/material'
import CameraAltRoundedIcon from '@mui/icons-material/CameraAltRounded'
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded'
import SendRoundedIcon from '@mui/icons-material/SendRounded'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import RemoveRoundedIcon from '@mui/icons-material/RemoveRounded'
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded'

export default function Upload(){
  const inputRef = useRef()
  const imgRef = useRef()
  const containerRef = useRef()
  const videoRef = useRef()
  const streamRef = useRef()
  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [stickers, setStickers] = useState([])
  const [dragging, setDragging] = useState(null)
  const [cameraOpen, setCameraOpen] = useState(false)
  const [capturedBlob, setCapturedBlob] = useState(null)
  const [uploading, setUploading] = useState(false)
  const [feedback, setFeedback] = useState({ open: false, message: '', severity: 'info' })
  const [selected, setSelected] = useState(null)
  const pinchStateRef = useRef(null)

  const EMOJIS = ['😄','😍','😎','🎉','❤️','🔥','🥳','🤩','😂','👏','✨','📸','🎊','😺','🕶️','💃']

  useEffect(()=> {
    return () => {
      if (preview) URL.revokeObjectURL(preview)
    }
  },[preview])

  const notify = (severity, message) => {
    setFeedback({ open: true, severity, message })
  }

  const closeFeedback = () => {
    setFeedback((f) => ({ ...f, open: false }))
  }

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    if (!f.type?.startsWith('image/')) {
      notify('warning', 'Selecione um arquivo de imagem válido.')
      return
    }
    logInfo('upload', 'File selected from gallery', {
      name: f.name,
      type: f.type,
      size: f.size,
    })
    setFile(f)
    setCapturedBlob(null)
    setPreview(URL.createObjectURL(f))
  }

  const openCamera = async () => {
    const canUseStreamCamera = Boolean(window.isSecureContext && navigator.mediaDevices?.getUserMedia)
    if (!canUseStreamCamera) {
      logInfo('upload', 'Camera API unavailable, using file input fallback')
      notify('info', 'Câmera direta indisponível neste navegador. Abrindo seletor de arquivos.')
      inputRef.current?.click()
      return
    }

    try {
      logInfo('upload', 'Opening camera')
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      videoRef.current.play()
      setCameraOpen(true)
      logInfo('upload', 'Camera opened successfully')
    } catch (e) {
      logError('upload', 'Failed to open camera', { message: e?.message })
      notify('error', 'Não foi possível abrir a câmera. Use a galeria para enviar a foto.')
    }
  }

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t=>t.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
    logInfo('upload', 'Camera closed')
  }

  const captureFromCamera = () => {
    const v = videoRef.current
    const w = v.videoWidth
    const h = v.videoHeight
    const c = document.createElement('canvas')
    c.width = w; c.height = h
    const ctx = c.getContext('2d')
    ctx.drawImage(v, 0, 0, w, h)
    c.toBlob(b => {
      if (!b) {
        logError('upload', 'Camera capture failed: empty blob')
        notify('error', 'Falha ao capturar imagem da câmera.')
        return
      }
      setCapturedBlob(b)
      const url = URL.createObjectURL(b)
      setPreview(url)
      setFile(null)
      logInfo('upload', 'Photo captured from camera', { size: b.size })
      notify('success', 'Foto capturada com sucesso.')
      closeCamera()
    }, 'image/png')
  }

  const addSticker = (emoji) => {
    const id = Date.now().toString()
    // place near center
    setStickers(s=>[...s, { id, emoji, x:200, y:200, size:64 }])
    setSelected(id)
    logInfo('upload', 'Sticker added', { id, emoji })
  }

  const onPointerDownSticker = (e, id) => {
    e.preventDefault()
    setSelected(id)
    setDragging({ id, startX: e.clientX, startY: e.clientY })
  }

  const getTouchDistance = (t1, t2) => {
    const dx = t1.clientX - t2.clientX
    const dy = t1.clientY - t2.clientY
    return Math.sqrt((dx * dx) + (dy * dy))
  }

  const onTouchStartSticker = (e, id) => {
    if (e.touches.length === 2) {
      e.preventDefault()
      const distance = getTouchDistance(e.touches[0], e.touches[1])
      const target = stickers.find((st) => st.id === id)
      if (!target) return

      pinchStateRef.current = {
        id,
        startDistance: distance,
        startSize: target.size,
      }
      setSelected(id)
      setDragging(null)
      logInfo('upload', 'Pinch resize started', { id, startSize: target.size })
      return
    }

    if (e.touches.length === 1) {
      const t = e.touches[0]
      setSelected(id)
      setDragging({ id, startX: t.clientX, startY: t.clientY })
    }
  }

  const onTouchMoveSticker = (e, id) => {
    const pinch = pinchStateRef.current
    if (!pinch || pinch.id !== id) return
    if (e.touches.length !== 2) return

    e.preventDefault()
    const currentDistance = getTouchDistance(e.touches[0], e.touches[1])
    const scale = currentDistance / pinch.startDistance
    const nextSize = Math.max(12, Math.min(220, Math.round(pinch.startSize * scale)))

    setStickers((s) => s.map((st) => (st.id === id ? { ...st, size: nextSize } : st)))
  }

  const onTouchEndSticker = (id) => {
    if (pinchStateRef.current?.id === id) {
      logInfo('upload', 'Pinch resize finished', { id })
      pinchStateRef.current = null
    }
  }

  const adjustStickerSize = (id, delta) => {
    setStickers(s => s.map(st => st.id === id ? { ...st, size: Math.max(12, st.size + delta) } : st))
  }
  const removeSticker = (id) => {
    setStickers(s => s.filter(st => st.id !== id))
    if (selected === id) setSelected(null)
    logInfo('upload', 'Sticker removed', { id })
  }

  useEffect(()=>{
    const onPointerMove = (e) => {
      if (!dragging) return
      const deltaX = e.clientX - dragging.startX
      const deltaY = e.clientY - dragging.startY
      setStickers(s => s.map(st => st.id === dragging.id ? { ...st, x: st.x + deltaX, y: st.y + deltaY } : st))
      setDragging(d => d ? { ...d, startX: e.clientX, startY: e.clientY } : null)
    }
    const onPointerUp = () => setDragging(null)
    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp)
    return () => { window.removeEventListener('pointermove', onPointerMove); window.removeEventListener('pointerup', onPointerUp) }
  },[dragging])

  const canvasToBlob = (canvas, type, quality) => new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) {
        reject(new Error('Canvas blob generation failed'))
        return
      }
      resolve(blob)
    }, type, quality)
  })

  const composeAndSend = async () => {
    if (!preview) {
      logInfo('upload', 'Upload prevented: no preview image')
      notify('warning', 'Selecione ou capture uma foto antes de enviar.')
      return
    }
    setUploading(true)

    try {
      const img = imgRef.current
      const naturalW = img.naturalWidth
      const naturalH = img.naturalHeight
      const displayedW = img.width
      const displayedH = img.height
      const scaleX = naturalW / displayedW
      const scaleY = naturalH / displayedH

      const canvas = document.createElement('canvas')
      canvas.width = naturalW
      canvas.height = naturalH
      const ctx = canvas.getContext('2d')

      await new Promise((resolve, reject) => {
        const base = new Image()
        base.crossOrigin = 'anonymous'
        base.onload = () => {
          ctx.drawImage(base, 0, 0, naturalW, naturalH)
          resolve()
        }
        base.onerror = () => reject(new Error('Falha ao carregar imagem de pré-visualização'))
        base.src = preview
      })

      for (const st of stickers) {
        const fontSize = st.size * ((scaleX + scaleY) / 2)
        const sx = (st.x * scaleX) - (fontSize / 2)
        const sy = (st.y * scaleY) - (fontSize / 2)
        ctx.font = `${fontSize}px serif`
        ctx.textAlign = 'left'
        ctx.textBaseline = 'top'
        ctx.fillText(st.emoji, sx, sy)
      }

      const MAX_DIMENSION = 1920
      const resizeRatio = Math.min(1, MAX_DIMENSION / Math.max(naturalW, naturalH))
      const outputCanvas = document.createElement('canvas')
      outputCanvas.width = Math.max(1, Math.round(naturalW * resizeRatio))
      outputCanvas.height = Math.max(1, Math.round(naturalH * resizeRatio))
      const outputCtx = outputCanvas.getContext('2d')
      outputCtx.drawImage(canvas, 0, 0, outputCanvas.width, outputCanvas.height)

      const blob = await canvasToBlob(outputCanvas, 'image/jpeg', 0.86)
      const fd = new FormData()
      fd.append('photo', blob, 'composed.jpg')

      logInfo('upload', 'Sending composed image', {
        stickerCount: stickers.length,
        outputSize: blob.size,
        width: outputCanvas.width,
        height: outputCanvas.height,
      })

      await uploadPhoto(fd)
      setFile(null); setPreview(null); setStickers([]); setCapturedBlob(null)
      notify('success', 'Foto enviada com sucesso!')
      logInfo('upload', 'Image upload completed successfully')
    } catch (e) {
      logError('upload', 'Image upload failed', {
        message: e?.message,
        status: e?.response?.status,
        response: e?.response?.data,
      })
      if (e?.response?.status === 413) {
        notify('error', 'Imagem muito grande. Tente uma foto menor.')
      } else {
        notify('error', e?.response?.data?.error || 'Falha no upload.')
      }
    } finally {
      setUploading(false)
    }
  }

  return (
    <Box className="upload-page">
      <Card className="upload-card" elevation={0}>
        <CardContent>
          <Stack spacing={2.5}>
            <Typography className="title" component="h1">Foto Ao Vivo</Typography>

            <Box
              sx={{
                px: 2,
                py: 1.5,
                borderRadius: 2,
                border: '1px solid rgba(255,255,255,0.15)',
                background: 'linear-gradient(90deg, rgba(255,122,24,0.18), rgba(255,78,80,0.14))',
              }}
            >
              <Typography sx={{ fontWeight: 800, color: '#fff', textAlign: 'center' }}>
                Envie sua foto para alegrar a festa e aparecer no telao!
              </Typography>
              <Typography sx={{ mt: 0.4, fontSize: 13, color: 'rgba(255,255,255,0.86)', textAlign: 'center' }}>
                Capriche no clique, adicione stickers e compartilhe seu momento.
              </Typography>
            </Box>

            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} className="controls">
              <Button
                variant="contained"
                size="large"
                startIcon={<CameraAltRoundedIcon />}
                onClick={openCamera}
                disabled={uploading}
              >
                Abrir câmera
              </Button>
              <Button
                variant="outlined"
                size="large"
                component="label"
                startIcon={<PhotoLibraryRoundedIcon />}
                disabled={uploading}
              >
                Selecionar da galeria
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={onFile}
                  hidden
                  disabled={uploading}
                />
              </Button>
            </Stack>

            {cameraOpen && (
              <Box className="camera-wrap">
                <video ref={videoRef} className="camera-view" playsInline muted />
                <Stack direction="row" spacing={1} className="camera-actions">
                  <Button color="inherit" variant="outlined" onClick={closeCamera}>Fechar</Button>
                  <Button variant="contained" onClick={captureFromCamera}>Capturar</Button>
                </Stack>
              </Box>
            )}

            <Stack direction="row" spacing={1} className="sticker-palette" useFlexGap flexWrap="wrap">
              {EMOJIS.map(e => (
                <Button key={e} variant="text" className="emoji-btn" onClick={() => addSticker(e)}>{e}</Button>
              ))}
            </Stack>

            {preview && (
              <Box ref={containerRef} className="preview-wrap">
                <img ref={imgRef} src={preview} alt="preview" className="preview-img" />
                {stickers.map(st => (
                  <div
                    key={st.id}
                    onPointerDown={(e)=>onPointerDownSticker(e, st.id)}
                    onTouchStart={(e)=>onTouchStartSticker(e, st.id)}
                    onTouchMove={(e)=>onTouchMoveSticker(e, st.id)}
                    onTouchEnd={()=>onTouchEndSticker(st.id)}
                    onTouchCancel={()=>onTouchEndSticker(st.id)}
                    onClick={(e)=>{ e.stopPropagation(); setSelected(st.id) }}
                    className={"sticker" + (selected===st.id ? ' sticker-selected' : '')}
                    style={{left:st.x, top:st.y, fontSize:st.size}}
                  >
                    {st.emoji}
                  </div>
                ))}

                {selected && (
                  <Stack direction="row" spacing={1} className="sticker-controls">
                    <IconButton size="small" color="primary" onClick={()=>adjustStickerSize(selected, -8)}>
                      <RemoveRoundedIcon fontSize="small" />
                    </IconButton>
                    <IconButton size="small" color="primary" onClick={()=>adjustStickerSize(selected, 8)}>
                      <AddRoundedIcon fontSize="small" />
                    </IconButton>
                    <Button
                      color="error"
                      variant="contained"
                      size="small"
                      startIcon={<DeleteRoundedIcon fontSize="small" />}
                      onClick={()=>removeSticker(selected)}
                    >
                      Excluir
                    </Button>
                  </Stack>
                )}
              </Box>
            )}

            <Box className="actions">
              <Button
                variant="contained"
                size="large"
                startIcon={uploading ? <CircularProgress size={18} color="inherit" /> : <SendRoundedIcon />}
                onClick={composeAndSend}
                disabled={uploading}
              >
                {uploading ? 'Enviando...' : 'Enviar com stickers'}
              </Button>
            </Box>
          </Stack>
        </CardContent>
      </Card>

      <Snackbar open={feedback.open} autoHideDuration={3500} onClose={closeFeedback} anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}>
        <Alert onClose={closeFeedback} severity={feedback.severity} variant="filled" sx={{ width: '100%' }}>
          {feedback.message}
        </Alert>
      </Snackbar>

      <Box sx={{ height: 24 }} />
    </Box>
  )
}
