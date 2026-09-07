import { describe, expect, it } from 'vitest'
import { matchesVersion, normalizeRemoteNotice, type RemoteNotice } from '../notice'

const base = { id: 'notice-1', level: 'info' as const }

describe('normalizeRemoteNotice', () => {
  it('keeps legacy single-language notices compatible', () => {
    const result = normalizeRemoteNotice({ ...base, title: '旧公告', body: '旧正文' }, 'en')
    expect(result?.title).toBe('旧公告')
    expect(result?.body).toBe('旧正文')
  })

  it('selects title, body, and link label for the active locale', () => {
    const payload = {
      ...base,
      title: '维护通知',
      body: '今晚维护',
      linkLabel: '查看详情',
      translations: {
        en: {
          title: 'Maintenance notice',
          body: 'Maintenance tonight',
          linkLabel: 'Learn more',
        },
      },
    }
    expect(normalizeRemoteNotice(payload, 'en')).toMatchObject({
      title: 'Maintenance notice',
      body: 'Maintenance tonight',
      linkLabel: 'Learn more',
    })
    expect(normalizeRemoteNotice(payload, 'zh-CN')).toMatchObject({
      title: '维护通知',
      body: '今晚维护',
      linkLabel: '查看详情',
    })
  })

  it('falls back field by field to legacy strings', () => {
    const result = normalizeRemoteNotice({
      ...base,
      title: 'Fallback title',
      body: 'Fallback body',
      translations: { en: { title: 'English title' } },
    }, 'en')
    expect(result?.title).toBe('English title')
    expect(result?.body).toBe('Fallback body')
  })

  it('rejects payloads without any usable title', () => {
    expect(normalizeRemoteNotice({ ...base, title: '', translations: { en: { title: 'English' } } }, 'en')).toBeNull()
  })
})

// 版本区间：钉住 notice 里 compareVersions 那个取反的方向 —— 删掉它会让
// 区间两个方向完全反转，而其它测试一条都不会红。
describe('matchesVersion', () => {
  const notice = (minVersion?: string, maxVersion?: string): RemoteNotice => ({
    id: 'n1', level: 'info', title: 't', body: 'b', minVersion, maxVersion,
  })

  it('预发布号落在区间内要能看到（0.1.9-1 在 0.1.9~0.2.0）', () => {
    // 旧实现把 0.1.9-1 读成 0.1.0，这里会 false
    expect(matchesVersion(notice('0.1.9', '0.2.0'), '0.1.9-1')).toBe(true)
  })

  it('预发布号超出区间不该看到（0.1.9-1 不在 0.1.0~0.1.5）', () => {
    // 旧实现这里会 true
    expect(matchesVersion(notice('0.1.0', '0.1.5'), '0.1.9-1')).toBe(false)
  })

  it('纯数字版本的区间判定（取反不得改变这部分语义）', () => {
    expect(matchesVersion(notice('0.1.9'), '0.1.8')).toBe(false)
    expect(matchesVersion(notice('0.1.9'), '0.1.9')).toBe(true)
    expect(matchesVersion(notice('0.1.9'), '0.3.0')).toBe(true)
    expect(matchesVersion(notice(undefined, '0.2.0'), '0.3.0')).toBe(false)
    expect(matchesVersion(notice(undefined, '0.2.0'), '0.1.0')).toBe(true)
  })

  it('不设区间时一律展示', () => {
    expect(matchesVersion(notice(), '0.1.9-1')).toBe(true)
  })
})
