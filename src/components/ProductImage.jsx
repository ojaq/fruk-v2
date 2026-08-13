import React, { useState } from 'react'
import { getOptimizedImageUrl } from '../utils/imageUtils'
import { Eye } from 'react-feather'

const SIZE_PRESETS = {
  thumb: { width: 120, height: 120, quality: 70 },
  preview: { width: 360, height: 360, quality: 75 },
  full: { width: 1200, height: 1200, quality: 80, resize: 'contain' }
}

const ProductImage = ({
  src,
  alt = '',
  size = 'thumb',
  className,
  style,
  onClick,
  lazy = true,
  autoLoad = false
}) => {
  if (!src) return null

  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.thumb
  const optimizedSrc = getOptimizedImageUrl(src, preset)
  const fullSrc = src
  const [stage, setStage] = useState(() => (autoLoad ? (size === 'full' ? 'full' : 'thumb') : 'hidden'))
  const openThumb = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    setStage('thumb')
  }

  const openFull = (e) => {
    if (e && e.preventDefault) e.preventDefault()
    if (onClick) {
      try { onClick(fullSrc) } catch (err) {}
    }
    setStage('full')
  }

  if (stage === 'hidden') {
    return (
      <button
        type="button"
        onClick={openThumb}
        className={className}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#fafafa',
          border: '1px solid #eee',
          color: '#444',
          padding: 6,
          textAlign: 'center',
          cursor: 'pointer',
          ...style
        }}
        aria-label={`Show image ${alt || ''}`}
      >
        <Eye />
      </button>
    )
  }

  if (stage === 'thumb') {
    return (
      <div style={{ display: 'inline-block', position: 'relative' }} className={className}>
        <img
          src={optimizedSrc}
          alt={alt}
          style={style}
          loading={lazy ? 'lazy' : 'eager'}
          decoding="async"
          onClick={openFull}
        />
      </div>
    )
  }

  return (
    <img
      src={fullSrc}
      alt={alt}
      className={className}
      style={style}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
    />
  )
}

export default ProductImage
