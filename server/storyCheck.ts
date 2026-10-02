/**
 * 剧本校验。服务启动时和 `npm run check:stories` 共用同一套规则：
 * errors 会让服务拒绝启动、让 PR 检查失败；warnings 只提示，不拦。
 */
import type { Story } from './stories.ts'

const ID = /^[a-z0-9-]+$/
const ANSWERS = ['是', '否', '不是', '是也不是', '无关', '不知道']

const isStr = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0
const isArr = (v: unknown): v is unknown[] => Array.isArray(v) && v.length > 0

export function checkStory(s: Story, file: string): { errors: string[]; warnings: string[] } {
  const errors: string[] = []
  const warnings: string[] = []
  const err = (m: string) => errors.push(m)
  const warn = (m: string) => warnings.push(m)

  // ---------- 基本字段 ----------
  for (const k of ['id', 'title', 'difficulty', 'teaser', 'surface', 'oneLine'] as const) if (!isStr(s[k])) err(`${k} 必须是非空字符串`)
  for (const k of ['tags', 'bottom', 'storyline', 'clues', 'qa', 'hints'] as const) if (!isArr(s[k])) err(`${k} 必须是非空数组`)
  for (const k of ['challenges', 'hostNotes'] as const) if (!Array.isArray(s[k])) err(`${k} 必须是数组（可以为空）`)
  if (!s.scoring || typeof s.scoring !== 'object') err('缺少 scoring')
  if (!s.host || typeof s.host !== 'object') err('缺少 host')
  if (errors.length) return { errors, warnings }

  if (!ID.test(s.id)) err('id 只能包含小写字母、数字和连字符')
  if (file.replace(/\.json$/, '') !== s.id) err(`文件名要和 id 一致：应为 ${s.id}.json`)
  if (s.bottom.some(b => !isStr(b))) err('bottom 的每一段都必须是非空字符串')
  s.storyline.forEach((x, i) => (!isStr(x?.stage) || !isStr(x?.text)) && err(`storyline[${i}] 需要 stage 和 text`))
  s.clues.forEach((c, i) => (!isStr(c?.surface) || !isStr(c?.truth)) && err(`clues[${i}] 需要 surface 和 truth`))
  s.challenges.forEach((c, i) => (!isStr(c?.q) || !isStr(c?.a)) && err(`challenges[${i}] 需要 q 和 a`))

  // ---------- 参考问答 ----------
  let qaCount = 0
  s.qa.forEach((g, gi) => {
    if (!isStr(g?.group) || !isArr(g?.items)) return err(`qa[${gi}] 需要 group 和非空的 items`)
    g.items.forEach((it, ii) => {
      qaCount++
      if (!isStr(it?.q)) err(`qa[${gi}].items[${ii}] 缺少 q`)
      if (!ANSWERS.includes(it?.a)) err(`qa[${gi}].items[${ii}].a 只能是 ${ANSWERS.join(' / ')}，现在是“${it?.a}”`)
    })
  })
  if (qaCount < 20) warn(`参考问答只有 ${qaCount} 条，建议至少 20 条，主持人的回答会更稳定`)

  // ---------- 里程碑 ----------
  const h = s.host
  if (!isArr(h.milestones)) {
    err('host.milestones 必须是非空数组')
    return { errors, warnings }
  }
  const ids = new Set<string>()
  h.milestones.forEach((m, i) => {
    if (!isStr(m?.id) || !ID.test(m.id)) err(`host.milestones[${i}].id 只能包含小写字母、数字和连字符`)
    else if (ids.has(m.id)) err(`host.milestones 里有重复的 id：${m.id}`)
    else ids.add(m.id)
    if (!isStr(m?.label)) err(`host.milestones[${i}] 缺少 label`)
    if (!isStr(m?.desc)) err(`host.milestones[${i}] 缺少 desc（写清玩家问到什么才算达成）`)
    if (m?.keywords !== undefined && !(Array.isArray(m.keywords) && m.keywords.every(isStr))) err(`host.milestones[${i}].keywords 必须是字符串数组`)
  })

  // ---------- 计分 ----------
  const items = s.scoring.items
  if (!isArr(items)) err('scoring.items 必须是非空数组')
  else {
    let sum = 0
    items.forEach((it, i) => {
      if (!isStr(it?.point)) err(`scoring.items[${i}] 缺少 point`)
      if (!Number.isInteger(it?.score) || it.score <= 0) err(`scoring.items[${i}].score 必须是正整数`)
      else sum += it.score
      if (!isStr(it?.title)) err(`scoring.items[${i}] 缺少 title（玩家看到的模糊标题，如“关于爷爷”）`)
      if (!it?.milestones?.length) warn(`scoring.items[${i}] 没有 milestones：玩家在提问里问出来也不会自动得分，只能靠还原拿分`)
      for (const m of it?.milestones ?? []) if (!ids.has(m)) err(`scoring.items[${i}].milestones 指向不存在的里程碑 ${m}`)
    })
    if (s.scoring.total !== sum) err(`scoring.total 是 ${s.scoring.total}，但各项分数加起来是 ${sum}`)
  }
  if (!isStr(s.scoring.pass)) err('scoring.pass 缺少通关说明')
  if (!Number.isInteger(h.passScore) || h.passScore <= 0 || h.passScore > s.scoring.total) err(`host.passScore 必须是 1 到 ${s.scoring.total} 之间的整数`)

  // ---------- 提示 ----------
  const levels = s.hints.map(x => x?.level)
  s.hints.forEach((x, i) => {
    if (!Number.isInteger(x?.level)) err(`hints[${i}].level 必须是整数`)
    if (!isStr(x?.text)) err(`hints[${i}] 缺少 text`)
  })
  if (new Set(levels).size !== levels.length) err('hints 里有重复的 level')
  for (const [lvl, target] of Object.entries(h.hintTargets ?? {})) {
    if (!levels.includes(Number(lvl))) err(`hintTargets.${lvl} 没有对应的提示`)
    if (!ids.has(target)) err(`hintTargets.${lvl} 指向不存在的里程碑 ${target}`)
  }

  // ---------- 防剧透 ----------
  if (!isArr(h.spoilerTerms) || !h.spoilerTerms.every(isStr)) err('host.spoilerTerms 必须是非空的字符串数组')
  else {
    // 汤面里本来就有的词，玩家看得到，放进来只会让主持人的正常备注被误删
    const shown = [s.title, s.teaser, s.surface].join('\n')
    const leaked = h.spoilerTerms.filter(t => shown.includes(t))
    if (leaked.length) err(`spoilerTerms 里的词出现在标题、简介或汤面里：${leaked.join('、')}`)
  }

  // ---------- 其他 ----------
  if (h.cues !== undefined) {
    const cueIds = (h.cues ?? []).map(c => c?.id)
    h.cues.forEach((c, i) => (!isStr(c?.id) || !isStr(c?.desc)) && err(`host.cues[${i}] 需要 id 和 desc`))
    if (new Set(cueIds).size !== cueIds.length) err('host.cues 里有重复的 id')
  }
  if (h.lockReveal !== undefined && typeof h.lockReveal !== 'boolean') err('host.lockReveal 必须是 true 或 false')
  if (s.credits !== undefined && typeof s.credits !== 'string') err('credits 必须是字符串')

  return { errors, warnings }
}
