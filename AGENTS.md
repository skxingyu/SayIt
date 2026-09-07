# 项目工作注意事项（SayIt 个人自用 fork）

本仓库是 crosswk/SayIt 的 fork（`origin` = skxingyu/SayIt，`upstream` = crosswk/SayIt）。
以下是在本仓库工作必须知道的坑与约束，照做可避免重复踩雷。

- **动手前先读 `docs/fork-changes.md`**：这是本 fork 相对上游的全部改动记录与「上游更新时如何同步」的步骤模板/冲突矩阵。任何涉及文本处理、版本号、README、update 相关文件的改动，都应先对照它，避免覆盖本 fork 的定向偏好。本 AGENTS.md 是「坑与约束」，fork-changes.md 是「改了什么 + 怎么同步」，两者配套阅读。

---

## 1. 编译/构建环境（最重要）

**绝不能用普通 shell 直接 `npx tauri build` / `cargo build`** —— 会失败或链接出错。
必须用 `C:\code\env\` 下的环境脚本（已配好 MSVC + CMake Ninja + Vulkan）：

- `vc_tauri.cmd` → `npx tauri %*`（**不要**写 `npx tauri build %*`，多一个 build 会把参数当 cargo 参数报错）
- `vc_cargo.cmd` → 纯 cargo 命令

原因（都验证过，不是猜测）：
- Git Bash 的 GNU `link.exe` 会盖掉 MSVC 的 `link.exe`，导致 Rust 链接 `link: extra operand` 失败。
- VS BuildTools 2022 已装，但**未注册为 VS 实例**（vswhere 返回 `[]`、无注册表项），CMake 默认的 "Visual Studio 17 2022" 生成器找不到它。
- `transcribe-cpp-sys` 硬依赖 CMake + MSVC `cl` + Vulkan SDK（`glslc`）。环境脚本用 **Ninja 生成器 + 显式 cl 全路径 + Vulkan 1.4.357.0** 绕过上述问题。

典型命令：
```
cmd //c "C:\code\env\vc_tauri.cmd build"
cmd //c "C:\code\env\vc_cargo.cmd test"
```

---

## 2. 版本号规则（改版本必读）

- **四段号非法**：Cargo/npm 的 semver 拒绝 `0.1.9.1`，必须用预发布号 **`0.1.9-1`、`0.1.9-2`**。
- **改版本要同步 6 处**，少一个都会出问题：
  1. `client/package.json`
  2. `client/src-tauri/Cargo.toml`
  3. `client/src-tauri/tauri.conf.json`
  4. `client/src-tauri/Cargo.lock`（搜 `^name = "sayit"` 那一行下面的 `version`，cargo 不会自动改它）
  5. `client/src/features/update/releaseHighlights.ts`（`version` 字段 + 文案 key）
  6. `client/src/i18n/locales/zh-CN.json` 与 `en.json`（新增 `release.<版本>.<序号>` 键）
- `releaseHighlights.version` 必须与 `tauri.conf.json` 的 `version` **逐字相等**，因为 About 页用字符串全等比较，不一致时亮点会静默消失（已有测试钉住）。

---

## 3. 版本比较（含预发布号的唯一实现）

- 唯一正确实现：`client/src/lib/version.ts` 的 `compareVersions`。
- `updateChecker.ts` 通过 `import + export { compareVersions }` 复用（保持对外导出不变）。
- `notice.ts` 通过 `return -sharedCompareVersions(a, b)` 复用 —— **那个负号是命脉**：notice 旧语义是「a 比 b 新为正」，共享实现是「b 比 a 新为正」，方向相反，取反后调用处才能不改。删掉负号会让公告 min/max 区间两个方向全反转，且无其它测试能发现。
- 反例（别再这么写）：`parseInt('9-1')` 前缀解析得 9；`Number('9-1')` 得 NaN 被 `|| 0` 吞成 0，都会把 `0.1.9-1` 误判（前者判与 `-2` 同版，后者读成 `0.1.0`）。
- 守护测试：`client/src/lib/__tests__/version.test.ts`、`client/src/services/__tests__/notice.test.ts` 的 `matchesVersion`。

---

## 4. gh / git 推送目标

- `gh release` / `gh release create` 默认解析到 **upstream**（crosswk/SayIt），不是你的 fork。
  必须显式 `--repo skxingyu/SayIt`，否则会在上游建 release。
- tag 与分支推到 `origin`（fork），不是 upstream。
- Release 正文**用 `--notes-file`** 传文件，别用 `gh release create -n "..."` 内联带反引号的文本 —— bash 会把反引号当命令替换吞掉。

---

## 5. 数字规范化（`client/src/services/textPostProcess.ts`）

用户已从「激进转换」转为**收窄**（0.1.9-3 起）：含位值词（十百千万亿）的裸整数**一律不转**
（`三千 → 三千`、`三百二十五 → 三百二十五`、`一万五 → 一万五`），只有带明确格式信号的场域才转：
百分比（`百分之三十→30%`）、分之（`五分之二→2/5`）、时间（`九点三十二分→9点32分`）、
小数/多段点分（`三点一四→3.14`）、逐位串、`第N` 序号。上游的「结构化整数」规则（原规则 4）
在本 fork 被整体删除 —— **rebase 冲突时维持删除态**。其余边界：

- **逐位串（现规则 4）正则长度门槛是 `{3,}`，不是 `{2,}`**。两字组合在中文里绝大多数是约数/副词而非报数：
  `七八个人`、`过两三天`、`三五分钟`、`一一说明`、`二两肉`、`乱七八糟`、`一二年级` 都**不能**转。
  真实逐位报数几乎 ≥3 位（`一零零二三`、`一二三四五`、`三三零六`），靠 `{3,}` 分开两者。
- 已知可接受边界（无需改）：四字成语 `三三两两 → 3322` 仍会转（用户选择不加黑名单）；两位数报数（说「一二」想得到 12）不再转。
- **「第 N 序号」的 `ORD_SUFFIX` 刻意不含 `次`**：避免把「第一次/第二次世界大战」误转。
  含位值词的序号（`第三十二条`、`第一千零一夜`）也不转，与位值词整数同规则。
- 单字数字不转（「三个→三个」「一起→一起」），因为这和成语语素同形，无可靠判别信号；
  `幺→1` 等单字映射也**不做**（用户明确：容易歧义的一律不转）。
- 改这条逻辑务必同时更新 `client/src/services/__tests__/textPostProcess.test.ts` 的正向 + 负向用例。

---

## 6. README 结构

- `README.md` = **中文主文档**（GitHub 默认展示）；`README.en.md` = 英文补充。
- 旧的 `README.zh-CN.md` 已并入 `README.md` 并删除。
- 语言切换条：README.md 顶部指向 `README.en.md`，反之指向 `README.md`。改链接时两边要同步。

---

## 7. 其它杂项

- **i18n 闸门**：`client/scripts/check-i18n.mjs --strict` 进 CI。代码里的中文串必须进 locale 文件或用 `// i18n-allow:` 标记；**注释里的中文不报**（先剥注释），测试目录整体跳过。
- **schema 产物噪音**：`client/src-tauri/gen/schemas/*.json` 常有 CRLF 行尾差异，无实际内容改动。
  操作前 `git checkout -- client/src-tauri/gen/schemas` 丢弃即可，别提交它。
- **测试环境**：vitest 用 `node` 环境，`client/src/**/*.test.ts` 自动纳入；改前端后跑 `npx vitest run`（约 340 个用例）。`npx tsc --noEmit` 单独验证类型。
- 本仓库自用版说明：接入的本地模型「qwen3 ASR 1.7B-提速版」是用户本地配置，代码里不含该模型改动记录；README 中该句描述的是使用方式而非仓库代码变更。
