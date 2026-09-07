import { describe, it, expect } from 'vitest'
import {
  convertChineseNumbers,
  normalizeChinesePunctuation,
  restoreHotwordSpacing,
  stripTrailingPunctuation,
  replacePunctuationWithSpace,
} from '../textPostProcess'

describe('normalizeChinesePunctuation', () => {
  // Whisper（Groq 的 whisper-large-v3-turbo）转写中文时混用两种宽度：句号给全角，
  // 逗号和问号给半角。实测改 prompt 无效，只能在文本层归一。
  it('汉字后面的半角标点转成全角', () => {
    expect(normalizeChinesePunctuation('今天天气不错,我们出去走走吧,顺便买点东西。你觉得怎么样?'))
      .toBe('今天天气不错，我们出去走走吧，顺便买点东西。你觉得怎么样？')
    expect(normalizeChinesePunctuation('太好了!')).toBe('太好了！')
    expect(normalizeChinesePunctuation('注意:两点;三点')).toBe('注意：两点；三点')
  })

  // 下面这几条是这个函数存在的全部风险所在：判据写松一点就会破坏内容。
  it('数字里的逗号与小数点绝不动', () => {
    expect(normalizeChinesePunctuation('一共 3,000 元')).toBe('一共 3,000 元')
    expect(normalizeChinesePunctuation('圆周率是 3.14')).toBe('圆周率是 3.14')
  })

  // 已知缺口，且是刻意留的：标点夹在「数字/字母」和汉字之间时不转。
  // 想覆盖 `100,很便宜` 就必然会把 `3:2中文`、`3,000元` 这类也一起改掉，
  // 而少一个全角逗号只是观感问题，改坏数字是内容损坏。宁可漏改。
  it('前一个字符不是汉字时一律不动，即便后面是中文', () => {
    expect(normalizeChinesePunctuation('版本 v1.2,已发布')).toBe('版本 v1.2,已发布')
    expect(normalizeChinesePunctuation('比例 3:2中文')).toBe('比例 3:2中文')
  })

  it('英文句子里的标点不动', () => {
    expect(normalizeChinesePunctuation('Hello, world! Are you ok?'))
      .toBe('Hello, world! Are you ok?')
    expect(normalizeChinesePunctuation('中文A,B')).toBe('中文A,B')
  })

  it('网址与句号一律不动（句号不在转换表里）', () => {
    expect(normalizeChinesePunctuation('访问 example.com 就行')).toBe('访问 example.com 就行')
    // 半角句号即便紧跟汉字也保持原样：小数/域名/文件名的代价高于收益
    expect(normalizeChinesePunctuation('好的.')).toBe('好的.')
  })

  it('本来就是全角、或没有汉字时是空操作', () => {
    expect(normalizeChinesePunctuation('今天不错，我们走吧。')).toBe('今天不错，我们走吧。')
    expect(normalizeChinesePunctuation('')).toBe('')
    expect(normalizeChinesePunctuation(',开头的逗号没有前字符')).toBe(',开头的逗号没有前字符')
  })
})

describe('restoreHotwordSpacing', () => {
  it('还原被拆开加空格的热词', () => {
    expect(restoreHotwordSpacing('这是 Say It 输入法', ['SayIt'])).toBe('这是 SayIt 输入法')
    expect(restoreHotwordSpacing('用 Type less 打字', ['Typeless'])).toBe('用 Typeless 打字')
    expect(restoreHotwordSpacing('试试 GPT 5', ['GPT'])).toBe('试试 GPT 5')
  })

  it('尾字母被小写化也能还原（Say it → SayIt）', () => {
    expect(restoreHotwordSpacing('这是 Say it 输入法', ['SayIt'])).toBe('这是 SayIt 输入法')
    expect(restoreHotwordSpacing('Say it', ['SayIt'])).toBe('SayIt')
  })

  it('连写词的大小写也还原（typeless → Typeless）', () => {
    expect(restoreHotwordSpacing('识别出来了 typeless。', ['Typeless'])).toBe('识别出来了 Typeless。')
    expect(restoreHotwordSpacing('sayit 很好用', ['SayIt'])).toBe('SayIt 很好用')
  })

  it('已正确的热词不改动', () => {
    expect(restoreHotwordSpacing('SayIt 很好用', ['SayIt'])).toBe('SayIt 很好用')
  })

  it('大小写敏感，不误伤普通小写短语', () => {
    expect(restoreHotwordSpacing('I say it loudly', ['SayIt'])).toBe('I say it loudly')
  })

  it('词边界避免错误合并', () => {
    expect(restoreHotwordSpacing('Say Item here', ['SayIt'])).toBe('Say Item here')
  })

  it('无热词或空文本安全', () => {
    expect(restoreHotwordSpacing('Say It', [])).toBe('Say It')
    expect(restoreHotwordSpacing('', ['SayIt'])).toBe('')
  })

  it('忽略含空格或中文的热词', () => {
    expect(restoreHotwordSpacing('你 好 世界', ['你好'])).toBe('你 好 世界')
  })
})

describe('convertChineseNumbers', () => {
  it('百分之 → %', () => {
    expect(convertChineseNumbers('增长了百分之十五')).toBe('增长了15%')
    expect(convertChineseNumbers('百分之百完成')).toBe('100%完成')
    expect(convertChineseNumbers('百分之三点五')).toBe('3.5%')
  })

  it('小数：数字点数字', () => {
    expect(convertChineseNumbers('版本从三点一升级到三点二')).toBe('版本从3.1升级到3.2')
    expect(convertChineseNumbers('圆周率约等于三点一四')).toBe('圆周率约等于3.14')
    expect(convertChineseNumbers('二十三点五度')).toBe('23.5度')
  })

  it('英文后的小数补空格', () => {
    expect(convertChineseNumbers('用的是GPT五点四')).toBe('用的是GPT 5.4')
  })

  it('多段点分数字（版本号）', () => {
    expect(convertChineseNumbers('升级到零点一点零')).toBe('升级到0.1.0')
    expect(convertChineseNumbers('版本一点二点三')).toBe('版本1.2.3')
    expect(convertChineseNumbers('三点一四不变')).toBe('3.14不变')
    expect(convertChineseNumbers('从零点九点五到一点零点零')).toBe('从0.9.5到1.0.0')
  })

  it('分之 → 分数', () => {
    expect(convertChineseNumbers('五分之二')).toBe('2/5')
    expect(convertChineseNumbers('千分之五')).toBe('5/1000')
  })

  it('结构化整数（含位值词）', () => {
    expect(convertChineseNumbers('扩容二十三台')).toBe('扩容23台')
    expect(convertChineseNumbers('三百二十五块钱')).toBe('325块钱')
    expect(convertChineseNumbers('端口号是三千三百零六')).toBe('端口号是3306')
  })

  it('口语省略末位', () => {
    expect(convertChineseNumbers('大概一万五')).toBe('大概15000')
    expect(convertChineseNumbers('花了三千二')).toBe('花了3200')
    expect(convertChineseNumbers('两百五')).toBe('250')
  })

  it('零的间隔正确', () => {
    expect(convertChineseNumbers('三千零二')).toBe('3002')
    expect(convertChineseNumbers('一百零五')).toBe('105')
  })

  it('不误伤成语/口语（无位值词或单位单独成段）', () => {
    expect(convertChineseNumbers('十分感谢你')).toBe('十分感谢你')
    expect(convertChineseNumbers('一心一意做事')).toBe('一心一意做事')
    expect(convertChineseNumbers('千方百计')).toBe('千方百计')
    expect(convertChineseNumbers('十全十美')).toBe('十全十美')
    expect(convertChineseNumbers('百姓的生活')).toBe('百姓的生活')
  })

  it('不误伤连续单位黑名单词', () => {
    expect(convertChineseNumbers('千万不要这样')).toBe('千万不要这样')
    expect(convertChineseNumbers('万一出事了')).toBe('万一出事了')
  })

  it('无位值词的连续逐位串 → 逐字转阿拉伯（语音逐位报数场景）', () => {
    expect(convertChineseNumbers('一二三四五')).toBe('12345')
    expect(convertChineseNumbers('二零零三')).toBe('2003')
    expect(convertChineseNumbers('一零零二三版本')).toBe('10023版本')
    expect(convertChineseNumbers('第一二三点')).toBe('第123点')
  })

  it('两字组合不转（逐位串门槛 ≥3，约数/副词/单位不走报数路径）', () => {
    // 约数：改了就是量级错误（「约七到八个」→ 78 个）
    expect(convertChineseNumbers('七八个人')).toBe('七八个人')
    expect(convertChineseNumbers('来了七八个人')).toBe('来了七八个人')
    expect(convertChineseNumbers('过两三天')).toBe('过两三天')
    expect(convertChineseNumbers('两三天后')).toBe('两三天后')
    expect(convertChineseNumbers('三五分钟')).toBe('三五分钟')
    expect(convertChineseNumbers('三五个人')).toBe('三五个人')
    // 副词「一一」= 逐个，不是 11
    expect(convertChineseNumbers('一一说明')).toBe('一一说明')
    expect(convertChineseNumbers('一一列举')).toBe('一一列举')
    expect(convertChineseNumbers('这些问题我一一回答')).toBe('这些问题我一一回答')
    // 「二两」是重量单位
    expect(convertChineseNumbers('二两肉')).toBe('二两肉')
    // 并列而非报数
    expect(convertChineseNumbers('一二年级')).toBe('一二年级')
    expect(convertChineseNumbers('一二月')).toBe('一二月')
    // 成语（不加黑名单，靠长度门槛自然免疫两字情形）
    expect(convertChineseNumbers('乱七八糟')).toBe('乱七八糟')
    // 三位及以上报数仍然转（门槛不能误伤真实报数）
    expect(convertChineseNumbers('一零零二三版本')).toBe('10023版本')
    expect(convertChineseNumbers('一二三四五')).toBe('12345')
    expect(convertChineseNumbers('三三零六')).toBe('3306')
  })

  it('孤立单字数字不转（避免拆坏 一起/一点 等词内单字与量词前单字）', () => {
    expect(convertChineseNumbers('一起走')).toBe('一起走')
    expect(convertChineseNumbers('一点水')).toBe('一点水')
    expect(convertChineseNumbers('一个人')).toBe('一个人')
    expect(convertChineseNumbers('来了三次')).toBe('来了三次')
  })

  it('时间：数字转阿拉伯，保留点/分/半', () => {
    expect(convertChineseNumbers('上午九点三十二分')).toBe('上午9点32分')
    expect(convertChineseNumbers('九点二十分开会')).toBe('9点20分开会')
    expect(convertChineseNumbers('下午两点半开会')).toBe('下午2点半开会')
    expect(convertChineseNumbers('上午九点开会')).toBe('上午9点开会')
    expect(convertChineseNumbers('十九点三十分')).toBe('19点30分')
  })

  it('时间：无「分」的复合分钟也按时间处理（不再出现 9.3十 之类乱码）', () => {
    expect(convertChineseNumbers('九点三十')).toBe('9点30')
    expect(convertChineseNumbers('九点二十开会')).toBe('9点20开会')
  })

  it('不误伤口语「一点」(a little bit)：无时间信号的裸整点保留中文', () => {
    expect(convertChineseNumbers('把页面调宽一点')).toBe('把页面调宽一点')
    expect(convertChineseNumbers('有一点担心')).toBe('有一点担心')
    expect(convertChineseNumbers('再快一点')).toBe('再快一点')
    expect(convertChineseNumbers('声音大一点')).toBe('声音大一点')
    expect(convertChineseNumbers('一点点小事')).toBe('一点点小事')
    // 无时段词的裸整点也保守不转（宁可不转，交给 AI 整理）
    expect(convertChineseNumbers('九点开会')).toBe('九点开会')
  })

  it('整点：有时间信号才转（时段词 / 钟 / 含十两位）', () => {
    expect(convertChineseNumbers('下午一点开会')).toBe('下午1点开会')
    expect(convertChineseNumbers('晚上八点')).toBe('晚上8点')
    expect(convertChineseNumbers('一点钟到')).toBe('1点钟到')
    expect(convertChineseNumbers('十二点了')).toBe('12点了')
    expect(convertChineseNumbers('十点休息')).toBe('10点休息')
  })

  it('第 N 序号：第 + 单字数字 + 序数后缀 → 第N', () => {
    expect(convertChineseNumbers('第二个')).toBe('第2个')
    expect(convertChineseNumbers('第十个')).toBe('第10个')
    expect(convertChineseNumbers('第一位')).toBe('第1位')
    expect(convertChineseNumbers('第三名')).toBe('第3名')
    expect(convertChineseNumbers('第一章第一节')).toBe('第1章第1节')
    expect(convertChineseNumbers('第一位网友')).toBe('第1位网友')
    // 含单位的多字序号由既有结构化整数规则负责，此处不重复
    expect(convertChineseNumbers('第三十二条')).toBe('第32条')
    expect(convertChineseNumbers('第一千零一夜')).toBe('第1001夜')
  })

  it('第 N 序号：不带序数后缀的「第 + 数字」不误转', () => {
    expect(convertChineseNumbers('我排第一')).toBe('我排第一')
    expect(convertChineseNumbers('排在第一的')).toBe('排在第一的')
    expect(convertChineseNumbers('第一，我们要团结')).toBe('第一，我们要团结')
  })

  it('「第一次/第二次」时间副词不转（「次」不进序号后缀，避免误伤第一次世界大战等）', () => {
    expect(convertChineseNumbers('我第一次听说这事')).toBe('我第一次听说这事')
    expect(convertChineseNumbers('我第一次来北京')).toBe('我第一次来北京')
    expect(convertChineseNumbers('这是我第一次')).toBe('这是我第一次')
    expect(convertChineseNumbers('第一次世界大战')).toBe('第一次世界大战')
  })

  it('编号号码逐位串：不论是否带号码锚词，连续逐位串都逐字转（幺=1）', () => {
    expect(convertChineseNumbers('房间号是二零零三')).toBe('房间号是2003')
    expect(convertChineseNumbers('电话三三零六')).toBe('电话3306')
    expect(convertChineseNumbers('编号一二三四')).toBe('编号1234')
    expect(convertChineseNumbers('门牌号三零六')).toBe('门牌号306')
    expect(convertChineseNumbers('手机号幺三八零零零幺')).toBe('手机号1380001')
    expect(convertChineseNumbers('账号二零二四')).toBe('账号2024')
    expect(convertChineseNumbers('工号是零零二')).toBe('工号是002')
    expect(convertChineseNumbers('房间号一零一')).toBe('房间号101')
    expect(convertChineseNumbers('二零零三开门')).toBe('2003开门')
  })

  it('空文本安全', () => {
    expect(convertChineseNumbers('')).toBe('')
  })
})

describe('stripTrailingPunctuation', () => {
  it('去除句末标点', () => {
    expect(stripTrailingPunctuation('今天天气不错。')).toBe('今天天气不错')
    expect(stripTrailingPunctuation('真的吗？！')).toBe('真的吗')
    expect(stripTrailingPunctuation('好的...')).toBe('好的')
  })

  it('逐段处理', () => {
    expect(stripTrailingPunctuation('第一段。\n第二段！')).toBe('第一段\n第二段')
  })

  it('句中标点保留', () => {
    expect(stripTrailingPunctuation('你好，世界。')).toBe('你好，世界')
  })

  it('空文本安全', () => {
    expect(stripTrailingPunctuation('')).toBe('')
  })
})

describe('replacePunctuationWithSpace', () => {
  it('标点转空格并折叠', () => {
    expect(replacePunctuationWithSpace('你好，世界！')).toBe('你好 世界')
    expect(replacePunctuationWithSpace('一、二、三')).toBe('一 二 三')
  })

  it('保留数字小数点与百分号', () => {
    expect(replacePunctuationWithSpace('圆周率是3.14，约等于')).toBe('圆周率是3.14 约等于')
    expect(replacePunctuationWithSpace('增长15%，很好')).toBe('增长15% 很好')
  })

  it('保留换行', () => {
    expect(replacePunctuationWithSpace('第一行。\n第二行。')).toBe('第一行\n第二行')
  })

  it('空文本安全', () => {
    expect(replacePunctuationWithSpace('')).toBe('')
  })
})
