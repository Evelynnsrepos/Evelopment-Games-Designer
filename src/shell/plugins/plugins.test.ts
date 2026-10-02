import { zipSync } from 'fflate'
import { describe, expect, it } from 'vitest'
import { parseGitHubUrl, readPluginZip } from './plugins'

const enc = (s: string) => new TextEncoder().encode(s)
const info = { id: 'dice', name: 'Dice', version: '1.0.0', apiVersion: 1 }

describe('plugins', () => {
  it('parses GitHub links', () => {
    expect(parseGitHubUrl('https://github.com/Evelynnsrepos/egd-plugin.git')).toEqual({ owner: 'Evelynnsrepos', repo: 'egd-plugin' })
    expect(parseGitHubUrl('github.com/a/b/tree/main')).toEqual({ owner: 'a', repo: 'b' })
    expect(parseGitHubUrl('https://example.com/a/b')).toBeNull()
  })

  it('reads a GitHub-style zip with the plugin in one folder', () => {
    const zip = zipSync({ 'dice-main/plugin.json': enc(JSON.stringify(info)), 'dice-main/index.js': enc('export default () => ({})') })
    const pkg = readPluginZip(zip, 'src')
    expect(pkg.info).toMatchObject({ id: 'dice', source: 'src' })
    expect(Object.keys(pkg.files).sort()).toEqual(['index.js', 'plugin.json'])
  })

  it('rejects bad ids, other API versions and a missing module', () => {
    const make = (i: object, files: Record<string, Uint8Array> = { 'index.js': enc('') }) => zipSync({ 'plugin.json': enc(JSON.stringify(i)), ...files })
    expect(() => readPluginZip(make({ ...info, id: '../x' }), 's')).toThrow(/id/)
    expect(() => readPluginZip(make({ ...info, apiVersion: 2 }), 's')).toThrow(/API 2/)
    expect(() => readPluginZip(make(info, {}), 's')).toThrow(/missing/)
  })
})
