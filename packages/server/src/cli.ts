#!/usr/bin/env bun
import { devCommand } from './dev'
import { buildSite } from './build'
import { parseQuizFile, validateQuiz } from '@quizv/parser'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [,, command, arg, ...flags] = process.argv

function printUsage(): void {
  console.log(`
  hashquiz <command> [options]   (quizv from the sources)

  Commands:
    dev <quiz.quizv.md>     Start local dev server with hot-reload
    check <quiz.quizv.md>   Validate quiz file format
    build [decks-dir]       Build the static site (host + player) for a decks
                            folder (default: decks). Reads HASHQUIZ_TRANSPORT,
                            HASHQUIZ_SUPABASE_URL, HASHQUIZ_SUPABASE_ANON_KEY
                            (or their QUIZV_* / VITE_* names) from the environment.

  Options:
    --port <number>         Port to listen on (default: 3030)
    --out <dir>             Output folder for build (default: dist)
`)
}

if (!command || command === '--help' || command === '-h') {
  printUsage()
  process.exit(0)
}

const args = [arg, ...flags].filter((a): a is string => a !== undefined)
function flag(name: string): string | undefined {
  const i = args.indexOf(name)
  return i !== -1 ? args[i + 1] : undefined
}
const port = parseInt(flag('--port') ?? '3030')
const positional = args.find((a, i) => !a.startsWith('--') && !(i > 0 && args[i - 1]!.startsWith('--')))

if (command === 'dev') {
  if (!arg) {
    console.error('Error: provide a .quizv.md file path\n  quizv dev quiz.quizv.md')
    process.exit(1)
  }
  devCommand(arg, port)
} else if (command === 'build') {
  const decksDir = positional ?? 'decks'
  const outDir = flag('--out') ?? 'dist'
  try {
    const count = buildSite({ decksDir, outDir })
    console.log(`✓ Built ${count} deck(s) from ${decksDir} into ${outDir}`)
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }
} else if (command === 'check') {
  if (!arg) {
    console.error('Error: provide a .quizv.md file path\n  quizv check quiz.quizv.md')
    process.exit(1)
  }
  try {
    const content = readFileSync(resolve(arg), 'utf-8')
    const quiz = parseQuizFile(content)
    const result = validateQuiz(quiz)
    if (result.valid) {
      console.log(`✓ ${arg} is valid`)
      console.log(`  ${quiz.questions.length} questions, theme: ${quiz.meta.theme}`)
    } else {
      console.error(`✗ ${arg} has errors:`)
      for (const err of result.errors) {
        const loc = err.questionIndex !== undefined ? ` [Q${err.questionIndex + 1}]` : ''
        console.error(`  ${err.field}${loc}: ${err.message}`)
      }
      process.exit(1)
    }
  } catch (e) {
    console.error('Failed to read file:', e instanceof Error ? e.message : String(e))
    process.exit(1)
  }
} else {
  console.error(`Unknown command: ${command}`)
  printUsage()
  process.exit(1)
}
