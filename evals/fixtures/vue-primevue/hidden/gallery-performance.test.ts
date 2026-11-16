// @vitest-environment jsdom
// F2: "The gallery page feels slow to load and the layout jumps around while the images come in. Fix the
// loading performance and the layout shift." Checked on the rendered DOM: the hero (the LCP image) loads
// eagerly at high priority, images far below the fold load lazily, and every image reserves its box
// (width and height attributes, or an aspect ratio on the image or its wrapper).
import { afterEach, describe, expect, it } from 'vitest'
import { mountApp, unmountApp, waitFor } from './harness'

afterEach(unmountApp)

const { fetchPhotos } = await import('../services/api')
const PHOTOS = await fetchPhotos()

const images = () => [...document.querySelectorAll<HTMLImageElement>('main img, img')].filter((img, index, all) => all.indexOf(img) === index)
const hero = () => images().find((img) => /hero/.test(img.getAttribute('src') ?? img.getAttribute('srcset') ?? '')) ?? images()[0]
const photoImages = () => images().filter((img) => PHOTOS.some((photo) => (img.getAttribute('src') ?? '').includes(photo.src.replace(/\.\w+$/, ''))))

async function openGallery() {
  await mountApp('/gallery')
  await waitFor(() => expect(photoImages()).toHaveLength(PHOTOS.length))
}

const isLazy = (img: HTMLImageElement) => img.getAttribute('loading')?.toLowerCase() === 'lazy'
const priority = (img: HTMLImageElement) => img.getAttribute('fetchpriority')?.toLowerCase()

const ASPECT_CLASS = /(^|\s)(aspect-(square|video|auto|\[[^\]]+\]|\d+\/\d+))(\s|$)/

/** True when the image's box is known before it loads. */
function reservesSpace(img: HTMLImageElement) {
  const width = Number(img.getAttribute('width'))
  const height = Number(img.getAttribute('height'))
  if (width > 0 && height > 0) return true
  for (let node: HTMLElement | null = img, depth = 0; node && depth < 3; node = node.parentElement, depth += 1) {
    if (ASPECT_CLASS.test(node.getAttribute('class') ?? '')) return true
    if (/aspect-ratio\s*:/.test(node.getAttribute('style') ?? '')) return true
  }
  return false
}

describe('F2 gallery loading performance and layout shift', () => {
  it('the hero image is not lazy-loaded', async () => {
    await openGallery()
    expect(hero(), 'the hero image').toBeTruthy()
    expect(isLazy(hero() as HTMLImageElement)).toBe(false)
  })

  it('the hero image is fetched at high priority', async () => {
    await openGallery()
    expect(priority(hero() as HTMLImageElement)).toBe('high')
  })

  it('gallery photos below the first two rows are lazy-loaded', async () => {
    await openGallery()
    const belowFold = photoImages().slice(6)
    expect(belowFold.filter((img) => !isLazy(img)).map((img) => img.getAttribute('src'))).toEqual([])
  })

  it('only the hero is high priority', async () => {
    await openGallery()
    expect(photoImages().filter((img) => priority(img) === 'high').map((img) => img.getAttribute('src'))).toEqual([])
  })

  it('every image reserves its space before it loads', async () => {
    await openGallery()
    expect(images().filter((img) => !reservesSpace(img)).map((img) => img.getAttribute('src'))).toEqual([])
  })
})
