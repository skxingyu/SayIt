# SayIt 自用 fork 改动记录与上游同步指南

> 用途：本仓库是 [`crosswk/SayIt`](https://github.com/crosswk/SayIt) 的个人自用 fork（`origin` = skxingyu/SayIt，`upstream` = crosswk/SayIt）。
> 这份文档记录**相对上游的所有改动**，并说明**上游更新时如何把改动同步过去**。
> 上游将来发新版本时，先读本文，再照「§4 同步步骤」操作。

---

## 0. 当前状态

- 基于上游 `upstream/main` 于 `fcb0cc2`（"发布 0.1.9"）之后 fork。
- 本 fork 最新版本：**`0.1.9-2`**（四段号 `0.1.9.1` 在 Cargo/npm semver 下非法，故用预发布号 `-N`）。
- 改动跨度：`client/src/services/textPostProcess.ts`（数字规范化）、版本比较逻辑统一、`README` 重组、版本号、以及配套测试。

---

## 1. 改动清单（按主题）

### A. 数字规范化增强 — `client/src/services/textPostProcess.ts`

**目的**：语音逐位报数时把他读的数字串转成阿拉伯数字，并修正约数被误转的问题。

**具体改动**：
- **规则 4.5（逐位串）**：把「无位值词的中文数字连续串」逐字映射成阿拉伯数字。
  - 正则长度门槛 **`{3,}`**（原为上游的 `{2,}` 思路不适用本 fork）。理由：两字组合在中文里绝大多数是约数/副词而非报数——
    `七八个人`、`过两三天`、`三五分钟`、`一一说明`、`二两肉`、`乱七八糟`、`一二年级` 都**不转**；
    真实逐位报数几乎 ≥3 位（`一零零二三 → 10023`、`一二三四五 → 12345`、`三三零六 → 3306`）照常转。
  - 已知可接受边界（写入了代码注释）：四字成语 `三三两两 → 3322` 仍会转（用户明确**不加**成语黑名单）；两位数报数（说「一二」想得到 12）不再转。
- **规则 5（第 N 序号）**：`第 + 单字数字 + 序数后缀` → `第N`。`ORD_SUFFIX = '个名位号批轮期章节条目页项'`，**刻意不含 `次`**（避免误转「第一次/第二次世界大战」）。
- 单字数字不转（「三个→三个」「一起→一起」），与成语语素同形无法可靠判别。

**同步上游时注意**：
- 上游若也改了 `convertChineseNumbers`（很可能，原版数字规范化较保守），rebase 时此处**必冲突**。
- 决策原则：保留本 fork 的「门槛 `{3,}` + 约数免疫 + `次` 不进后缀」这几个偏好，把上游新增的有益规则（如上游可能补的新后缀、新边界）**追加**进来，而非整体覆盖。
- 改完务必同步更新 `client/src/services/__tests__/textPostProcess.test.ts`（正向 + 负向用例都已钉住）。

### B. 版本比较统一 — `client/src/lib/version.ts`（新增）+ `updateChecker.ts` + `notice.ts`

**目的**：修掉版本号带预发布号（`0.1.9-1`）时被误判的 bug，并把两份重复实现收敛成一份。

**具体改动**：
- 新增 `client/src/lib/version.ts`：`compareVersions(a, b)`，返回 >0 表示 b 比 a 新。
  把 `-N` 展开成第四段再比（`value.replace('-', '.')`），且只认纯数字段（`/^\d+$/`），非数字段按 0。
- `updateChecker.ts`：删掉本地实现，改为 `import { compareVersions }` 后 `export { compareVersions }`（保持对 `autoUpdate.ts` 的对外导出不变）。
- `notice.ts`：删掉本地 `Number` 解析实现，改为 `return -sharedCompareVersions(a, b)`。
  **那个负号是命脉**：notice 旧语义「a 比 b 新为正」，共享实现「b 比 a 新为正」，方向相反，取反后 `matchesVersion` 调用处不改。

**反例（切勿再写）**：
- `parseInt('9-1')` 前缀解析得 **9** → `0.1.9-1` 与 `0.1.9-2` 判为同版（下次发 `-2` 用户收不到更新）。
- `Number('9-1')` 得 NaN 被 `|| 0` 吞成 0 → `0.1.9-1` 读成 `0.1.0`（公告 min/max 区间两个方向全错）。

**同步上游时注意**：
- 上游可能已独立修过这两处，或引入自己的统一实现（如用 `semver` 库）。rebase 冲突时，判断：
  - 若上游统一到一份实现 → 以**本 fork 的 `src/lib/version.ts` 语义**为准（它正确覆盖预发布号），删掉上游可能残留的旧实现。
  - 若上游改用第三方库（如 `semver`）→ 评估是否跟随上游，但需保证 `version.ts` 的测试（`version.test.ts`）仍全绿，且 notice 的 `matchesVersion` 测试仍全绿。
- 守护测试：`client/src/lib/__tests__/version.test.ts`、`client/src/services/__tests__/notice.test.ts` 的 `matchesVersion`（注意：`matchesVersion` 被 **export** 就是为了让测试钉住那个负号）。

### C. 版本号提升到 `0.1.9-2`

**改动文件（6 处必须同时改）**：
1. `client/package.json`
2. `client/src-tauri/Cargo.toml`
3. `client/src-tauri/tauri.conf.json`
4. `client/src-tauri/Cargo.lock`（搜 `^name = "sayit"` 下方的 `version`，cargo 不自动改）
5. `client/src/features/update/releaseHighlights.ts`（`version` 字段 + 文案 key `release.<版本>.<序号>`）
6. `client/src/i18n/locales/zh-CN.json`、`en.json`（新增对应 key）

**约束**：`releaseHighlights.version` 必须与 `tauri.conf.json` 的 `version` **逐字相等**（About 页字符串全等比较；已有 `releaseHighlights.test.ts` 钉住）。

**同步上游时注意**：每次 rebase / 合并上游后，上游会改版本号；本 fork 必须在其基础上再 bump 一个预发布号（如上游到 `0.1.10`，本 fork 用 `0.1.10-1`），并同步 6 处。

### D. README 重组

**改动**：
- `README.md` = **中文主文档**（GitHub 默认展示），顶部语言条 `简体中文 · [English](README.en.md)`。
- `README.en.md` = 英文补充文档（原 `README.md` 英文内容），顶部 `English · [简体中文](README.md)`。
- 旧 `README.zh-CN.md` 已**删并**进 `README.md`。
- `README.md` 开头加了「⚠️ 自用定制版说明」区块（fork 来源 + 接入本地模型「qwen3 ASR 1.7B-提速版」+ 相对上游改动）+ 致谢原作者 `crosswk`。

**同步上游时注意**：
- 上游 `README.md` 是英文主文档，本 fork 的是中文主文档 —— **路径同名、内容方向相反**，rebase 时 git 会直接冲突。
- 推荐解法：rebase 后保留本 fork 的「中文主文档」结构，把上游 README 里**新增的功能/截图/链接**手动合并进本 fork 的 `README.md`（中文）与 `README.en.md`（英文）对应位置，再删上游的英文 `README.md` 冲突、确认语言条链接正确。
- 不要简单 `git checkout` 上游的 README，否则会丢掉中文主文档结构。

### E. 新增/强化的测试

| 文件 | 钉住什么 |
| --- | --- |
| `client/src/lib/__tests__/version.test.ts` | 预发布号比较正确（含 `-1 vs -2`、`-1 vs 0.1.9`） |
| `client/src/services/__tests__/notice.test.ts`（`matchesVersion` 段） | notice 版本区间方向（防那个负号被误删） |
| `client/src/features/update/__tests__/releaseHighlights.test.ts` | `releaseHighlights.version` 与 `tauri.conf.json` 一致 |
| `client/src/services/__tests__/textPostProcess.test.ts`（负向用例） | 约数/副词/成语两字组合不转，报数串仍转 |

**同步上游时注意**：上游也可能给这些文件加测试，rebase 时同名测试文件可能冲突。合并后跑 `npx vitest run`，确保总数与上游新增都对得上。

---

## 2. 上游同步前必读约束（来自 AGENTS.md，精简版）

- **编译**：绝不用普通 shell 直接 `npx tauri build`。用 `cmd //c "C:\code\env\vc_tauri.cmd build"`（Ninja+MSVC cl+Vulkan 环境）。原因：Git Bash 的 `link.exe` 会盖 MSEVC；BuildTools 未注册为 VS 实例；CMake 默认 VS 生成器找不到它。
- **i18n 闸门**：`node scripts/check-i18n.mjs --strict` 进 CI。代码里的中文串必须进 locale 或标 `// i18n-allow:`；注释中文不报，测试目录跳过。
- **schema 噪音**：`client/src-tauri/gen/schemas/*.json` 的 CRLF 差异无实际内容，提交前 `git checkout -- client/src-tauri/gen/schemas` 丢。
- **gh release 目标**：`gh release create` 默认解析到 **upstream**，必须 `--repo skxingyu/SayIt`。正文用 `--notes-file` 传文件（反引号会被 bash 吞）。

---

## 3. 各改动与上游的冲突风险矩阵

| 改动 | 上游更新常动它吗 | 冲突风险 | 同步策略 |
| --- | --- | --- | --- |
| `textPostProcess.ts` 规则 4.5 / 5 | **高**（数字处理是活跃区） | 高 | 保留本 fork 偏好，手工合并上游新增 |
| `version.ts` / `updateChecker.ts` / `notice.ts` | 中 | 中 | 以本 fork 语义为准，删上游残留旧实现 |
| 版本号 6 处 | **高**（每次发布必动） | 高 | 每次 rebase 后重新 bump 预发布号 |
| `README.md` / `README.en.md` | 中 | 中（同名路径反向） | 手动把上游新增内容并入中文主结构 |
| 测试文件 | 中 | 低-中 | 合并后跑全量测试 |

---

## 4. 同步步骤（上游更新时操作模板）

```bash
cd C:/Users/skxingyu/Desktop/AI/SayIt

# 1. 拿上游最新
git fetch upstream
git fetch origin

# 2. 在干净的 fork main 上 rebase 到上游（冲突时逐个解决，参考 §3 矩阵）
git checkout main
git rebase upstream/main
#   冲突重点：textPostProcess.ts / version.ts / README.md / 版本号 6 处

# 3. 解完冲突后，重新 bump 本 fork 版本号（见 C 节 6 处）
#    taureg.conf.json 与 releaseHighlights.version 必须逐字相等

# 4. 校验
cd client
npx vitest run          # 约 340+ 用例全绿
npx tsc --noEmit        # 无类型错误
node scripts/check-i18n.mjs --strict   # 无中文串遗漏

# 5. 编译（必须用环境脚本）
#    在另一个 shell 里：
cmd //c "C:\code\env\vc_tauri.cmd build"

# 6. 提交并推 fork
git add -A
git commit -m "chore: 同步上游 <上游版本>，本 fork 升至 <本fork版本>"
git push origin main

# 7. 打 tag + 发 release（注意 --repo 指向 fork）
git tag -a v<本fork版本> -m "SayIt <本fork版本>"
git push origin v<本fork版本>
gh release create v<本fork版本> --repo skxingyu/SayIt \
  --title "SayIt <本fork版本>" --notes-file <正文文件> --latest \
  client/src-tauri/target/release/bundle/nsis/SayIt_<本fork版本>_x64-setup.exe \
  client/src-tauri/target/release/bundle/msi/SayIt_<本fork版本>_x64_zh-CN.msi \
  client/src-tauri/target/release/bundle/msi/SayIt_<本fork版本>_x64_en-US.msi
```

---

## 5. 本 fork 相对上游的完整文件差异

> 用 `git diff upstream/main...HEAD` 随时查看最新全量差异。截至 `0.1.9-2` 的改动文件：

```
README.md                          # 中文主文档（原 zh-CN 并入）
README.en.md                       # 英文补充（原 README.md 英文）
README.zh-CN.md                    # 已删除
client/package.json                # 版本 0.1.9-2
client/src-tauri/Cargo.toml        # 版本 0.1.9-2
client/src-tauri/Cargo.lock        # sayit 条目版本
client/src-tauri/tauri.conf.json   # 版本 0.1.9-2
client/src/features/update/releaseHighlights.ts       # 版本 + 亮点文案
client/src/features/update/updateChecker.ts           # 复用共享 compareVersions
client/src/features/update/__tests__/releaseHighlights.test.ts  # 新增
client/src/i18n/locales/en.json    # release.0.1.9-1.1 / 0.1.9-2.1
client/src/i18n/locales/zh-CN.json  # 同上
client/src/lib/version.ts          # 新增：唯一版本比较实现
client/src/lib/__tests__/version.test.ts            # 新增
client/src/services/notice.ts      # 复用共享实现（取反）
client/src/services/__tests__/notice.test.ts       # 加 matchesVersion 断言
client/src/services/textPostProcess.ts              # 规则 4.5 门槛 {3,} + 规则 5
client/src/services/__tests__/textPostProcess.test.ts  # 加负向用例
```

---

## 6. 备注

- 接入的本地模型「qwen3 ASR 1.7B-提速版」是**本地运行配置**，代码里不含该模型改动记录；README 中那句描述的是使用方式，同步上游时无需据此改动代码。
- 本 fork 不向 upstream 提 PR（自用定向修改，与上游官方方向不同）；仅单向从 upstream 拉取更新。
