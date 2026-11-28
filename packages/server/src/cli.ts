#!/usr/bin/env bun
import { devCommand } from './dev'
import { buildSite } from './build'
import { supabaseCommand } from '@hashquiz/backend-supabase/cli'
import { parseQuizFile, validateQuiz } from '@hashquiz/parser'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const [,, command, arg, ...flags] = process.argv

function printUsage(): void {
  console.log(`
  hashquiz <command> [options]   (hashquiz from the sources)

  Commands:
    dev <quiz.hashquiz.md | decks-dir> [--decks <dir>]
                            Start the local dev stack. A file is the room
                            deck; a folder is the decks folder (room deck =
                            its first deck by id). Solo runs are stored in
                            .hashquiz/solo.db.
    check <quiz.hashquiz.md>   Validate quiz file format
    build [decks-dir]       Build the static site (host + player) for a decks
                            folder (default: decks). Reads HASHQUIZ_TRANSPORT,
                            HASHQUIZ_SUPABASE_URL, HASHQUIZ_SUPABASE_ANON_KEY,
                            HASHQUIZ_SOLO_SCORING, HASHQUIZ_PLAYER_URL
                            (or their VITE_* names) from the environment, and
                            HASHQUIZ_SITE_URL, HASHQUIZ_LANG,
                            HASHQUIZ_INDEXABLE for search engines.
    supabase deploy --project <ref> [--site-url <url>] [--dry-run]
                            Deploy the solo backend to a Supabase project:
                            migrations, the solo-submit Edge Function and its
                            HASHQUIZ_SITE_URL secret (the site serving
                            decks.json; flag or env). Needs the Supabase CLI
                            (or SUPABASE_BIN), SUPABASE_ACCESS_TOKEN and
                            SUPABASE_DB_PASSWORD.

  Options:
    --port <number>         Port to listen on (default: 3030)
    --decks <dir>           Decks folder for dev with a file (default: the
                            repo's decks/ or tests/fixtures/ from the
                            sources, else the file's folder)
    --out <dir>             Output folder for build (default: dist)
    --public <dir>          Files copied to the site root by build, e.g.
                            robots.txt, llms.txt, og.png (default: ./public
                            when it exists)
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
  if (!positional) {
    console.error('Error: provide a .hashquiz.md file or a decks folder\n  hashquiz dev quiz.hashquiz.md')
    process.exit(1)
  }
  try {
    devCommand(positional, port, flag('--decks'))
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }
} else if (command === 'build') {
  const decksDir = positional ?? 'decks'
  const outDir = flag('--out') ?? 'dist'
  try {
    const count = buildSite({ decksDir, outDir, publicDir: flag('--public') })
    console.log(`✓ Built ${count} deck(s) from ${decksDir} into ${outDir}`)
  } catch (e) {
    console.error(`✗ ${e instanceof Error ? e.message : String(e)}`)
    process.exit(1)
  }
} else if (command === 'supabase') {
  process.exit(await supabaseCommand(args, process.env))
} else if (command === 'check') {
  if (!arg) {
    console.error('Error: provide a .hashquiz.md file path\n  hashquiz check quiz.hashquiz.md')
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
