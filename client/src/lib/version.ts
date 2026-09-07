// 版本号比较 —— 自动更新与远程公告共用同一套比较规则。
//
// 为什么抽出来：两处各自实现过一份 compareVersions，规则却不一样
// （一个用 parseInt、一个用 Number），版本里出现预发布后缀时行为分叉，
// 修好一边另一边还是错的。版本语义只有一种，比较就该只有一份。

/**
 * 返回 >0 表示 b 比 a 新（0 相等，<0 表示 b 更旧）。
 *
 * 只认纯数字的点分段。非数字段按 0 处理而不是让 NaN 传下去：
 * NaN 参与减法永远得 NaN，`NaN !== 0` 为真，会让循环在第一段就返回 NaN，
 * 而 `NaN > 0` 是 false —— 结果是"有更新也不报"，且没有任何报错。
 *
 * 数字预发布号 `0.1.9-1` 里的 `-N` 先展开成第四段再比。只支持 `-N` 这一种形态：
 * `alpha`/`beta`/`rc1` 这类非数字后缀一律按 0 处理，彼此判等。本项目版本号只用过
 * `0.1.9-N`，没有别的形态，故不做通用 semver 的预发布排序（YAGNI）。
 * 不能把 `-N` 留在第三段里：
 * `parseInt('9-1')` 得 9 而不是 NaN，于是 `0.1.9-1` 和 `0.1.9-2` 会被判成同一版本，
 * 之后发 `-2` 时用户点了"检查更新"也永远收不到提示，且没有任何报错。
 * 也不能让这种段整段按 0 处理（`Number('9-1')` 正是 NaN，`NaN || 0` 得 0）——
 * 那会把 `0.1.9-1` 读成 `0.1.0`：自动更新会凭空报出上游 `0.1.9` 这个"更新"，
 * 公告的 minVersion/maxVersion 区间判定也会两个方向都错。
 */
export function compareVersions(a: string, b: string): number {
  const parse = (value: string) => value.replace('-', '.').split('.').map((segment) => {
    const parsed = /^\d+$/.test(segment) ? Number.parseInt(segment, 10) : Number.NaN
    return Number.isFinite(parsed) ? parsed : 0
  })
  const pa = parse(a)
  const pb = parse(b)
  for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
    const diff = (pb[i] || 0) - (pa[i] || 0)
    if (diff !== 0) return diff
  }
  return 0
}
