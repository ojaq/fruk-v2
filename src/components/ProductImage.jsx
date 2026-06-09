import React from 'react'
import { getOptimizedImageUrl } from '../utils/imageUtils'

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
  lazy = true
}) => {
  if (!src) return null

  const preset = SIZE_PRESETS[size] || SIZE_PRESETS.thumb
  const optimizedSrc = getOptimizedImageUrl(src, preset)
  const fullSrc = size === 'full' ? optimizedSrc : getOptimizedImageUrl(src, SIZE_PRESETS.full)

  return (
    <img
      src={optimizedSrc}
      alt={alt}
      className={className}
      style={style}
      onClick={onClick ? () => onClick(fullSrc || src) : undefined}
      loading={lazy ? 'lazy' : 'eager'}
      decoding="async"
    />
  )
}

export default ProductImage
