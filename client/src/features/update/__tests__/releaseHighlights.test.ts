import { describe, expect, it } from 'vitest'
import { RELEASE_HIGHLIGHTS } from '../releaseHighlights'
import tauriConf from '../../../../src-tauri/tauri.conf.json'

// 关于页用 `RELEASE_HIGHLIGHTS.version === currentVersion` 全等比较决定是否展示亮点
// （About.tsx），而 currentVersion 来自 tauri.conf.json。升版本时任何一侧漏改，
// 亮点就会静默消失 —— 没有报错、也看不出来。这条断言把两侧钉在一起。
describe('RELEASE_HIGHLIGHTS', () => {
  it('version 与打包版本（tauri.conf.json）一致', () => {
    expect(RELEASE_HIGHLIGHTS.version).toBe(tauriConf.version)
  })

  it('文案键在当前语言下能取到值', () => {
    const items = RELEASE_HIGHLIGHTS.items
    expect(items.length).toBeGreaterThan(0)
    for (const item of items) {
      expect(item).toBeTruthy()
      // 取不到时会回填成键名，说明 locale 文件漏了这条
      expect(item).not.toMatch(/^release\./)
    }
  })
})
