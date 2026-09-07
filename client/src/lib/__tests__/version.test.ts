import { describe, expect, it } from 'vitest'
import { compareVersions } from '../version'

describe('compareVersions', () => {
  it('返回 >0 表示后者更新', () => {
    expect(compareVersions('0.1.9', '0.1.10')).toBeGreaterThan(0)
    expect(compareVersions('0.1.9', '0.2.0')).toBeGreaterThan(0)
    expect(compareVersions('1.0.0', '1.0.1')).toBeGreaterThan(0)
  })

  it('相同版本返回 0', () => {
    expect(compareVersions('0.1.9-1', '0.1.9-1')).toBe(0)
    expect(compareVersions('1.0.0', '1.0.0')).toBe(0)
  })

  // 预发布号：本项目 0.1.9-1 起的版本号都带 -N。
  it('预发布号能区分（0.1.9-2 比 0.1.9-1 新）', () => {
    expect(compareVersions('0.1.9-1', '0.1.9-2')).toBeGreaterThan(0)
    expect(compareVersions('0.1.9-2', '0.1.9-1')).toBeLessThan(0)
  })

  it('预发布号不落后于同号正式版（0.1.9-1 比 0.1.9 新）', () => {
    // 若把「9-1」整段按 0 处理，会读成 0.1.0，反而判成比上游 0.1.9 旧，凭空报更新
    expect(compareVersions('0.1.9-1', '0.1.9')).toBeLessThan(0)
    expect(compareVersions('0.1.9', '0.1.9-1')).toBeGreaterThan(0)
  })

  it('预发布号仍小于下一个次版本', () => {
    expect(compareVersions('0.1.9-1', '0.1.10')).toBeGreaterThan(0)
    expect(compareVersions('0.1.9-9', '0.2.0')).toBeGreaterThan(0)
  })

  it('异常输入不产生 NaN', () => {
    expect(Number.isNaN(compareVersions('abc', '1.0.0'))).toBe(false)
    expect(Number.isNaN(compareVersions('', ''))).toBe(false)
  })
})
