import { supabase } from '../supabaseClient'

const PRODUCT_IMAGE_BUCKET = 'product-images'
const CACHE_CONTROL = '31536000'

export function isSupabaseStorageUrl(url) {
  if (!url || typeof url !== 'string') return false
  return url.includes('/storage/v1/object/public/') || url.includes('/storage/v1/render/image/public/')
}

export function getStoragePathFromUrl(url) {
  if (!url) return null

  const objectMatch = url.match(/\/storage\/v1\/object\/public\/([^/?]+)\/(.+?)(?:\?|$)/)
  if (objectMatch) {
    return {
      bucket: objectMatch[1],
      path: decodeURIComponent(objectMatch[2])
    }
  }

  const renderMatch = url.match(/\/storage\/v1\/render\/image\/public\/([^/?]+)\/(.+?)(?:\?|$)/)
  if (renderMatch) {
    return {
      bucket: renderMatch[1],
      path: decodeURIComponent(renderMatch[2])
    }
  }

  return null
}

export function getOptimizedImageUrl(url, { width, height, quality = 75, resize = 'cover' } = {}) {
  if (!url || !isSupabaseStorageUrl(url)) return url

  const parsed = getStoragePathFromUrl(url)
  if (!parsed) return url

  const transform = { quality }
  if (width) transform.width = width
  if (height) transform.height = height
  if (width || height) transform.resize = resize

  const { data } = supabase.storage.from(parsed.bucket).getPublicUrl(parsed.path, { transform })
  return data.publicUrl
}

export async function compressImage(file, { maxWidth = 1200, maxHeight = 1200, quality = 0.82 } = {}) {
  if (!file?.type?.startsWith('image/') || file.type === 'image/svg+xml') {
    return file
  }

  return new Promise((resolve) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)

      const scale = Math.min(maxWidth / img.width, maxHeight / img.height, 1)
      const width = Math.max(1, Math.round(img.width * scale))
      const height = Math.max(1, Math.round(img.height * scale))

      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      canvas.getContext('2d').drawImage(img, 0, 0, width, height)

      const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg'
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }

          const extension = outputType === 'image/png' ? 'png' : 'jpg'
          const baseName = file.name.replace(/\.[^.]+$/, '') || 'product-image'
          resolve(new File([blob], `${baseName}.${extension}`, { type: outputType }))
        },
        outputType,
        quality
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}

export async function uploadProductImage(file) {
  const compressed = await compressImage(file)
  const ext = compressed.name.split('.').pop()?.toLowerCase() || 'jpg'
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from(PRODUCT_IMAGE_BUCKET)
    .upload(fileName, compressed, {
      upsert: true,
      cacheControl: CACHE_CONTROL,
      contentType: compressed.type
    })

  if (uploadError) throw uploadError

  const { data: urlData } = supabase.storage.from(PRODUCT_IMAGE_BUCKET).getPublicUrl(fileName)
  return urlData.publicUrl
}
