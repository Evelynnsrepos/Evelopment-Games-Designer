import { beforeEach, describe, expect, it } from 'vitest'
import { getFs, MemoryFs, setFs } from '../fs'
import { assetKindOfExtension, assetUrl, extensionOf, importAssetFromBlob, importAssetFromPath, importAssetsFromDataTransfer, resolveAssetPath } from '.'

const PNG = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 255])
const ROOT = '/Documents/Game'

describe('asset import', () => {
  beforeEach(() => setFs(new MemoryFs()))

  it('saves a pasted image under assets/images with a uuid name and keeps the bytes', async () => {
    const asset = await importAssetFromBlob(ROOT, new Blob([PNG], { type: 'image/png' }))
    expect(asset?.kind).toBe('image')
    expect(asset?.path).toMatch(/^assets\/images\/[0-9a-f-]{36}\.png$/)
    const bytes = await getFs().readBinary(await resolveAssetPath(ROOT, asset!.path))
    expect([...bytes]).toEqual([...PNG])
  })

  it('uses the file name when the type is unknown and files audio under assets/audio', async () => {
    const file = new File([PNG], 'Theme Song.MP3')
    const asset = await importAssetFromBlob(ROOT, file)
    expect(asset).toMatchObject({ kind: 'audio', name: 'Theme Song.MP3' })
    expect(asset?.path).toMatch(/^assets\/audio\/.+\.mp3$/)
  })

  it('rejects unsupported files and kinds the caller does not accept', async () => {
    expect(await importAssetFromBlob(ROOT, new File(['x'], 'notes.txt'))).toBeNull()
    expect(await importAssetFromBlob(ROOT, new Blob([PNG], { type: 'image/png' }), 'audio')).toBeNull()
  })

  it('copies a picked file from disk', async () => {
    await getFs().writeBinaryAtomic('/Pictures/Hero.JPEG', PNG)
    const asset = await importAssetFromPath(ROOT, '/Pictures/Hero.JPEG', 'image')
    expect(asset?.path).toMatch(/^assets\/images\/.+\.jpg$/)
    expect([...(await getFs().readBinary(await resolveAssetPath(ROOT, asset!.path)))]).toEqual([...PNG])
  })

  it('imports every usable file from a drop or paste', async () => {
    const files = [new File([PNG], 'a.png', { type: 'image/png' }), new File(['x'], 'b.txt'), new File([PNG], 'c.wav', { type: 'audio/wav' })]
    const dt = { files, items: [], types: ['Files'] } as unknown as DataTransfer
    const assets = await importAssetsFromDataTransfer(ROOT, dt)
    expect(assets.map((a) => a.kind)).toEqual(['image', 'audio'])
  })

  it('returns null for a missing asset so the placeholder shows', async () => {
    expect(await assetUrl(ROOT, 'assets/images/missing.png')).toBeNull()
    expect(await assetUrl(ROOT, null)).toBeNull()
  })
})

describe('asset helpers', () => {
  it('reads extensions and kinds', () => {
    expect(extensionOf('C:\\Users\\me\\Pic.v2.PNG')).toBe('png')
    expect(extensionOf('/home/me/.hidden')).toBe('')
    expect(assetKindOfExtension('ogg')).toBe('audio')
    expect(assetKindOfExtension('exe')).toBeNull()
  })
})
