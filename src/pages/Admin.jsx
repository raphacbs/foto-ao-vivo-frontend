import React, { useEffect, useState, useRef } from 'react'
import {
  createSocketConnection,
  deletePhoto,
  getConfig,
  getPhotoUrl,
  getPhotos,
  setConfig,
  updatePhotoDisplayTime,
} from '../api'
import { logError, logInfo } from '../logger'

export default function Admin(){
  const [photos, setPhotos] = useState([])
  const [globalTime, setGlobalTime] = useState(6)

  const [displayPhrase, setDisplayPhrase] = useState('')
  const socketRef = useRef()
  const listRef = useRef()

  const load = async ()=>{
    logInfo('admin', 'Loading admin data')
    const photosData = await getPhotos()
    setPhotos(photosData)
    const cfg = await getConfig('display_time')
    setGlobalTime(cfg.value ? Number(cfg.value) : 6)
    const ph = await getConfig('display_phrase')
    setDisplayPhrase(ph.value || '')
    logInfo('admin', 'Admin data loaded', {
      photosCount: photosData.length,
      globalTime: cfg.value ? Number(cfg.value) : 6,
    })
  }

  useEffect(()=>{ 
    load().catch((e) => {
      logError('admin', 'Failed to load admin data', { message: e?.message })
    })
    socketRef.current = createSocketConnection()
    socketRef.current.on('new-photo', (photo) => setPhotos(p => {
      logInfo('admin', 'Socket event new-photo', { id: photo?.id })
      // avoid duplicates
      if (p.find(x=>x.id===photo.id)) return p
      return [...p, photo]
    }))
    socketRef.current.on('delete-photo', ({id}) => {
      logInfo('admin', 'Socket event delete-photo', { id })
      setPhotos(p => p.filter(x=>x.id !== id))
    })
    socketRef.current.on('update-photo', (photo) => {
      logInfo('admin', 'Socket event update-photo', { id: photo?.id })
      setPhotos(p => p.map(x => x.id===photo.id ? photo : x))
    })
    socketRef.current.on('config-updated', ({key, value}) => {
      logInfo('admin', 'Socket event config-updated', { key, value })
      if (key === 'display_time') setGlobalTime(value ? Number(value) : 6)
      if (key === 'display_phrase') setDisplayPhrase(value)
    })
    return ()=> {
      logInfo('admin', 'Disconnecting socket on unmount')
      socketRef.current.disconnect()
    }
  },[])

  const del = async (id) => {
    logInfo('admin', 'Deleting photo', { id })
    await deletePhoto(id)
    setPhotos(p=>p.filter(x=>x.id!==id))
    logInfo('admin', 'Photo deleted', { id })
  }
  const saveTime = async (id, time) => {
    logInfo('admin', 'Updating photo display time', { id, time })
    await updatePhotoDisplayTime(id, time)
    setPhotos(p=>p.map(x=> x.id===id ? { ...x, display_time: time } : x))
    logInfo('admin', 'Photo display time updated', { id, time })
  }
  const saveGlobal = async () => {
    logInfo('admin', 'Saving global display time', { globalTime })
    await setConfig('display_time', globalTime)
    alert('Salvo')
    logInfo('admin', 'Global display time saved', { globalTime })
  }
  const savePhrase = async () => {
    logInfo('admin', 'Saving display phrase', { displayPhrase })
    await setConfig('display_phrase', displayPhrase)
    alert('Frase salva')
    logInfo('admin', 'Display phrase saved')
  }

  return (
    <div className="admin-page">
      <div className="admin-header">
        <h1>Admin</h1>
        <div className="admin-actions">
          <div className="field">
            <label>Tempo padrão (segundos)</label>
            <input type="number" value={globalTime} onChange={e=>setGlobalTime(e.target.value)} />
            <button className="btn" onClick={saveGlobal}>Salvar</button>
          </div>
          <div className="field">
            <label>Frase exibida na tela</label>
            <input type="text" value={displayPhrase} onChange={e=>setDisplayPhrase(e.target.value)} />
            <button className="btn" onClick={savePhrase}>Salvar frase</button>
          </div>
        </div>
      </div>

      <div className="photo-list" ref={listRef}>
        {photos.map(p=> (
          <div key={p.id} className="photo-row">
            <img src={getPhotoUrl(p.filename)} alt="t" className="thumb" />
            <div className="meta">
              <div className="orig">{p.originalname}</div>
              <div className="controls">
                <label>Tempo (s): <input type="number" defaultValue={p.display_time || ''} onBlur={(e)=>saveTime(p.id, Number(e.target.value) || null)} /></label>
                <button className="btn danger" onClick={()=>del(p.id)}>Excluir</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
