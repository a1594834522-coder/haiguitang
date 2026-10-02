/**
 * 校验剧本：npm run check:stories [文件或目录...]
 *
 * 不带参数时检查 stories/，本地有 stories-private/ 的话一并检查。
 * 规则和服务启动时的一样（server/storyCheck.ts），这里会把所有问题一次列出来。
 */
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs'
import { basename, join, relative } from 'node:path'
import { checkStory } from '../server/storyCheck.ts'
import type { Story } from '../server/stories.ts'

const args = process.argv.slice(2)
const targets = args.length ? args : ['stories', 'stories-private'].filter(d => existsSync(d))

const files = targets.flatMap(t =>
  statSync(t).isDirectory()
    ? readdirSync(t)
        .filter(f => f.endsWith('.json'))
        .sort()
        .map(f => join(t, f))
    : [t],
)

let failed = 0
const seen = new Map<string, string>()

for (const path of files) {
  const name = relative(process.cwd(), path)
  let s: Story
  try {
    s = JSON.parse(readFileSync(path, 'utf8'))
  } catch (e) {
    console.log(`✗ ${name}\n    不是合法的 JSON：${(e as Error).message}`)
    failed++
    continue
  }
  const { errors, warnings } = checkStory(s, basename(path))
  if (typeof s.id === 'string') {
    if (seen.has(s.id)) errors.push(`id ${s.id} 和 ${seen.get(s.id)} 重复`)
    else seen.set(s.id, name)
  }
  if (s.host?.lockReveal && !name.startsWith('stories-private')) {
    warnings.push('lockReveal 只能挡住游戏里的“揭晓”按钮；放在公开仓库里，汤底谁都能在 GitHub 上看到')
  }

  console.log(`${errors.length ? '✗' : '✓'} ${name}${typeof s.title === 'string' ? `《${s.title}》` : ''}`)
  for (const e of errors) console.log(`    错误：${e}`)
  for (const w of warnings) console.log(`    提示：${w}`)
  if (errors.length) failed++
}

if (!files.length) {
  console.log('没有找到剧本文件')
  process.exit(1)
}
console.log(failed ? `\n${failed} 个剧本没通过校验` : `\n${files.length} 个剧本全部通过`)
process.exit(failed ? 1 : 0)
