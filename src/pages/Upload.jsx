import React, { useRef, useState, useEffect } from 'react'
import axios from 'axios'
import { useNavigate } from 'react-router-dom'

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
  const navigate = useNavigate()

  const EMOJIS = ['😄','😍','😎','🎉','❤️','🔥']

  useEffect(()=> {
    return () => { if (preview) URL.revokeObjectURL(preview); if (capturedBlob) URL.revokeObjectURL(URL.createObjectURL(capturedBlob)) }
  },[preview, capturedBlob])

  const onFile = (e) => {
    const f = e.target.files?.[0]
    if (!f) return
    setFile(f)
    setCapturedBlob(null)
    setPreview(URL.createObjectURL(f))
  }

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
      streamRef.current = stream
      videoRef.current.srcObject = stream
      videoRef.current.play()
      setCameraOpen(true)
    } catch (e) {
      alert('Não foi possível acessar a câmera')
      console.error(e)
    }
  }

  const closeCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t=>t.stop())
      streamRef.current = null
    }
    setCameraOpen(false)
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
      setCapturedBlob(b)
      const url = URL.createObjectURL(b)
      setPreview(url)
      setFile(null)
      closeCamera()
    }, 'image/png')
  }

  const [selected, setSelected] = useState(null)

  const addSticker = (emoji) => {
    const id = Date.now().toString()
    // place near center
    setStickers(s=>[...s, { id, emoji, x:200, y:200, size:64 }])
    setSelected(id)
  }

  const onPointerDownSticker = (e, id) => {
    e.preventDefault()
    setSelected(id)
    setDragging({ id, startX: e.clientX, startY: e.clientY })
  }

  const adjustStickerSize = (id, delta) => {
    setStickers(s => s.map(st => st.id === id ? { ...st, size: Math.max(12, st.size + delta) } : st))
  }
  const removeSticker = (id) => {
    setStickers(s => s.filter(st => st.id !== id))
    if (selected === id) setSelected(null)
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

  const [uploading, setUploading] = useState(false)
  const [toast, setToast] = useState(null)

  const composeAndSend = async () => {
    if (!preview) return alert('Selecione ou capture uma foto')
    setUploading(true)
    const img = imgRef.current
    const naturalW = img.naturalWidth
    const naturalH = img.naturalHeight

    const displayRect = containerRef.current.getBoundingClientRect()
    const displayedW = img.width
    const displayedH = img.height
    const scaleX = naturalW / displayedW
    const scaleY = naturalH / displayedH

    const canvas = document.createElement('canvas')
    canvas.width = naturalW
    canvas.height = naturalH
    const ctx = canvas.getContext('2d')

    // draw base image
    await new Promise((resolve) => {
      const base = new Image()
      base.crossOrigin = 'anonymous'
      base.onload = () => { ctx.drawImage(base, 0, 0, naturalW, naturalH); resolve() }
      base.src = preview
    })

    // draw stickers (as text emoji)
    for (const st of stickers) {
      // st.x/st.y are recorded in pixels relative to the preview container (center point due to translate(-50%,-50%))
      const fontSize = st.size * ((scaleX + scaleY)/2)
      // compute top-left for drawing since on DOM we center with translate(-50%,-50%)
      const sx = (st.x * scaleX) - (fontSize/2)
      const sy = (st.y * scaleY) - (fontSize/2)
      ctx.font = `${fontSize}px serif`
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      ctx.fillText(st.emoji, sx, sy)
    }

    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
    const fd = new FormData()
    fd.append('photo', blob, 'composed.png')
    try {
      await axios.post('http://localhost:4000/api/upload', fd)
      // show non-blocking confirmation and clear preview so user can send another
      setToast('Foto enviada com sucesso!')
      setFile(null); setPreview(null); setStickers([]); setCapturedBlob(null)
      // hide toast after 3s
      setTimeout(()=>setToast(null), 3000)
    } catch (e) {
      console.error(e)
      alert('Falha no upload')
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="upload-page">
      <h1 className="title">Foto Ao Vivo</h1>

      <div className="controls">
        <button className="btn primary" onClick={openCamera} disabled={uploading}>Abrir câmera</button>
        <label className="btn secondary" aria-disabled={uploading}>
          Selecionar da galeria
          <input ref={inputRef} type="file" accept="image/*" capture="environment" onChange={onFile} style={{display:'none'}} disabled={uploading} />
        </label>
      </div>

      {cameraOpen && (
        <div className="camera-wrap">
          <video ref={videoRef} className="camera-view" playsInline muted />
          <div className="camera-actions">
            <button className="btn danger" onClick={closeCamera}>Fechar</button>
            <button className="btn primary" onClick={captureFromCamera}>Capturar</button>
          </div>
        </div>
      )}

      <div className="sticker-palette">
        {EMOJIS.map(e => (
          <button key={e} className="emoji-btn" onClick={() => addSticker(e)}>{e}</button>
        ))}
      </div>

      {preview && (
        <div ref={containerRef} className="preview-wrap">
          <img ref={imgRef} src={preview} alt="preview" className="preview-img" />
          {stickers.map(st => (
            <div key={st.id}
              onPointerDown={(e)=>onPointerDownSticker(e, st.id)}
                  onClick={(e)=>{ e.stopPropagation(); setSelected(st.id) }}
                  className={"sticker" + (selected===st.id ? ' sticker-selected' : '')}
                  style={{left:st.x, top:st.y, fontSize:st.size}}>
                  {st.emoji}
                </div>
              ))}

              {selected && (
                <div className="sticker-controls" style={{position:'absolute', right:8, bottom:8, display:'flex', gap:8}}>
                  <button className="btn" onClick={()=>adjustStickerSize(selected, -8)}>-</button>
                  <button className="btn" onClick={()=>adjustStickerSize(selected, 8)}>+</button>
                  <button className="btn danger" onClick={()=>removeSticker(selected)}>Excluir</button>
                </div>
              )}
            </div>
          )}

          <div className="actions">
            <button className="btn success" onClick={composeAndSend} disabled={uploading}>{uploading ? 'Enviando...' : 'Enviar com stickers'}</button>
          </div>

      <div style={{height:32}} />

      {toast && <div className="toast">{toast}</div>}
    </div>
  )
}
