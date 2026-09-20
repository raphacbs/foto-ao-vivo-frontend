import React, { useEffect, useState, useRef } from 'react'
import QRCode from 'qrcode'
import { motion, AnimatePresence } from 'framer-motion'
import { createSocketConnection, getConfig, getPhotoUrl, getPhotos } from '../api'
import { logError, logInfo } from '../logger'

export default function Show(){
  const [photos, setPhotos] = useState([])
  const [phrase, setPhrase] = useState('')
  const [qrDataUrl, setQrDataUrl] = useState(null)
  const [defaultTimeSec, setDefaultTimeSec] = useState(6)
  const [celebrationMessage, setCelebrationMessage] = useState('')
  const socketRef = useRef()
  const idxRef = useRef(0)
  const photosRef = useRef([])
  const priorityPhotoIdRef = useRef(null)
  const resumePhotoIdRef = useRef(null)
  const celebrationTimerRef = useRef(null)
  const [index, setIndex] = useState(0)
  const [variantKey, setVariantKey] = useState('fade')
  const timerRef = useRef()

  const celebrationPhrases = [
    'Oba! Nova foto!',
    'Que massa! Mais uma fotinha!',
    'Olha so! Chegou foto nova!',
    'Uhuu! Mais um clique entrou!',
    'Que demais! Nova lembranca na tela!',
  ]

  useEffect(() => {
    idxRef.current = index
  }, [index])

  useEffect(() => {
    photosRef.current = photos
  }, [photos])

  // define a set of transition variants to choose randomly
  const variants = {
    fade: {
      initial: { opacity: 0 },
      animate: { opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 0.8, ease: [0.2,0.8,0.2,1] }
    },
    slideLeft: {
      initial: { x: 120, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: -120, opacity: 0 },
      transition: { duration: 0.9, ease: [0.25,0.8,0.25,1] }
    },
    slideRight: {
      initial: { x: -120, opacity: 0 },
      animate: { x: 0, opacity: 1 },
      exit: { x: 120, opacity: 0 },
      transition: { duration: 0.9, ease: [0.25,0.8,0.25,1] }
    },
    scaleUp: {
      initial: { scale: 0.85, opacity: 0 },
      animate: { scale: 1, opacity: 1 },
      exit: { scale: 0.85, opacity: 0 },
      transition: { duration: 0.85, ease: [0.2,0.8,0.2,1] }
    },
    rotate: {
      initial: { rotate: -6, opacity: 0, scale: 0.92 },
      animate: { rotate: 0, opacity: 1, scale: 1 },
      exit: { rotate: 6, opacity: 0, scale: 0.92 },
      transition: { duration: 0.95, ease: [0.2,0.8,0.2,1] }
    },
    punch: {
      initial: { scale: 0.6, opacity: 0 },
      animate: { scale: [1.05, 0.98, 1], opacity: 1 },
      exit: { opacity: 0 },
      transition: { duration: 1.0, times: [0,0.6,1], ease: 'easeInOut' }
    }
  }

  const pickRandomVariant = () => {
    const keys = Object.keys(variants)
    return keys[Math.floor(Math.random() * keys.length)]
  }

  useEffect(()=>{
    const load = async () => {
      logInfo('show', 'Loading initial show data')
      const photosData = await getPhotos()
      setPhotos(photosData)
      logInfo('show', 'Initial photo list loaded', { count: photosData.length })
      const cfgP = await getConfig('display_phrase')
      setPhrase(cfgP.value || 'Compartilhe suas melhores fotos!')
      const cfgT = await getConfig('display_time')
      setDefaultTimeSec(cfgT.value ? Number(cfgT.value) : 6)
      logInfo('show', 'Initial configs loaded', {
        phraseSet: Boolean(cfgP.value),
        defaultTimeSec: cfgT.value ? Number(cfgT.value) : 6,
      })

      // generate QR for upload page locally
      const uploadUrl = (typeof window !== 'undefined') ? `${window.location.origin}/upload` : '/upload'
      try {
        const url = await QRCode.toDataURL(uploadUrl, { margin: 1, width: 500 })
        setQrDataUrl(url)
        logInfo('show', 'QR code generated', { uploadUrl })
      } catch (e) {
        logError('show', 'QR generation failed', { message: e?.message })
      }
    }
    load().catch((e) => {
      logError('show', 'Failed to load initial show data', { message: e?.message })
    })

    socketRef.current = createSocketConnection()
    socketRef.current.on('new-photo', photo => {
      logInfo('show', 'Socket event new-photo', { id: photo?.id })
      const currentPhotos = photosRef.current
      const currentIndex = idxRef.current
      const currentDisplayed = currentPhotos.length
        ? currentPhotos[currentIndex % currentPhotos.length]
        : null

      if (!resumePhotoIdRef.current && currentDisplayed?.id) {
        resumePhotoIdRef.current = currentDisplayed.id
      }

      priorityPhotoIdRef.current = photo?.id || null

      const phrase = celebrationPhrases[Math.floor(Math.random() * celebrationPhrases.length)]
      setCelebrationMessage(phrase)
      clearTimeout(celebrationTimerRef.current)
      celebrationTimerRef.current = setTimeout(() => {
        setCelebrationMessage('')
      }, 2600)

      setPhotos((p) => [photo, ...p.filter((x) => x.id !== photo?.id)])
      setVariantKey(pickRandomVariant())
      setIndex(0)
      logInfo('show', 'New photo promoted to priority display', {
        id: photo?.id,
        resumePhotoId: resumePhotoIdRef.current,
      })
    })
    socketRef.current.on('delete-photo', ({id}) => {
      logInfo('show', 'Socket event delete-photo', { id })
      setPhotos(p=>p.filter(x=>x.id!==id))
    })
    socketRef.current.on('update-photo', (photo)=>{
      logInfo('show', 'Socket event update-photo', { id: photo?.id })
      setPhotos(p=>p.map(x=> x.id===photo.id ? photo : x))
    })
    socketRef.current.on('config-updated', ({key, value}) => {
      logInfo('show', 'Socket event config-updated', { key, value })
      if (key === 'display_phrase') setPhrase(value)
      if (key === 'display_time') setDefaultTimeSec(value ? Number(value) : 6)
      if (key === 'upload_url') {
        QRCode.toDataURL(value)
          .then(u=>setQrDataUrl(u))
          .catch((err)=>{
            logError('show', 'QR regeneration failed', { message: err?.message })
          })
      }
    })
    return ()=> {
      logInfo('show', 'Disconnecting socket on unmount')
      socketRef.current.disconnect()
      clearTimeout(celebrationTimerRef.current)
    }
  },[])

  useEffect(()=>{
    // schedule cycling per-photo using per-photo display_time or global config (defaultTimeSec)
    let active = true
    const init = async () => {
      clearTimeout(timerRef.current)
      if (!active || photos.length === 0) return
      const schedule = (i) => {
        const cur = photos[i % photos.length]
        const t = cur && cur.display_time ? Number(cur.display_time)*1000 : (Number(defaultTimeSec) * 1000)
        logInfo('show', 'Scheduling next photo transition', {
          index: i,
          currentPhotoId: cur?.id,
          transitionMs: Math.max(1000, t),
        })
        timerRef.current = setTimeout(()=>{
          let next = (i+1) % photos.length

          if (priorityPhotoIdRef.current && cur?.id === priorityPhotoIdRef.current) {
            const resumeId = resumePhotoIdRef.current
            if (resumeId) {
              const resumeIdx = photos.findIndex((p) => p.id === resumeId)
              if (resumeIdx >= 0) {
                next = resumeIdx
              }
            }

            logInfo('show', 'Returning to paused photo after priority display', {
              priorityPhotoId: priorityPhotoIdRef.current,
              resumePhotoId: resumePhotoIdRef.current,
              nextIndex: next,
            })

            priorityPhotoIdRef.current = null
            resumePhotoIdRef.current = null
          }

          // pick a new random variant different from current
          let v = pickRandomVariant()
          // avoid same variant twice in a row
          if (v === variantKey) {
            const keys = Object.keys(variants).filter(k=>k!==variantKey)
            v = keys[Math.floor(Math.random() * keys.length)]
          }
          setVariantKey(v)
          // advance index after variant is chosen so the incoming image uses it
          setIndex(next)
          logInfo('show', 'Photo transition executed', { from: i, to: next, variant: v })
          schedule(next)
        }, Math.max(1000, t))
      }
      schedule(index % Math.max(1, photos.length))
    }
    init()
    return ()=>{ active = false; clearTimeout(timerRef.current) }
  },[photos, index, defaultTimeSec])


  const current = photos.length ? photos[index % photos.length] : null
  const uploadUrl = (typeof window !== 'undefined') ? `${window.location.origin}/upload` : '/upload'
  const chosen = variants[variantKey] || variants.fade

  return (
    <div className="show-page">
      <div className="bg-visual" />
      <div className="overlay">
        <div className="topbar">
          <motion.div className="phrase" key={phrase} initial={{opacity:0, y:-6}} animate={{opacity:1, y:0}} transition={{duration:0.5}}>{phrase}</motion.div>
          <motion.div className="count" initial={{opacity:0}} animate={{opacity:1}} transition={{delay:0.2}}>{photos.length} {photos.length === 1 ? 'foto' : 'fotos'}</motion.div>
        </div>

        <div className="stage">
          <AnimatePresence>
            {celebrationMessage && (
              <motion.div
                key={celebrationMessage}
                className="celebration-banner"
                initial={{ opacity: 0, y: -20, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -16, scale: 0.97 }}
                transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
              >
                {celebrationMessage}
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence mode="wait">
            { !current ? (
              <motion.h2 className="empty" key="empty" initial={{opacity:0}} animate={{opacity:1}} exit={{opacity:0}} transition={{duration:0.5}}>Nenhuma foto ainda</motion.h2>
            ) : (
              <div key={current.id} className="photo-container">
                <motion.div
                  className="photo-anim"
                  initial={chosen.initial}
                  animate={chosen.animate}
                  exit={chosen.exit}
                  transition={chosen.transition}
                >
                  <img
                    className="show-photo"
                    src={getPhotoUrl(current.filename)}
                    alt="show"
                  />
                </motion.div>
              </div>
            )}
          </AnimatePresence>
        </div>

        {qrDataUrl && (
          <div className="qr-wrap">
            <a className="qr" href={uploadUrl} target="_blank" rel="noopener noreferrer" title="Abrir página de envio">
              <motion.img src={qrDataUrl} alt="qr" initial={{scale:0.6, opacity:0}} animate={{scale:1, opacity:1}} transition={{duration:0.6}} />
              <div className="qr-label">Participe enviando sua foto</div>
              <div className="qr-hint">Aponte a camera e envie para aparecer no telao</div>
            </a>
          </div>
        )}

      </div>
    </div>
  )
}
