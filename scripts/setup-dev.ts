#!/usr/bin/env zx

import 'zx/globals'
import { resolve } from 'node:path'

// ---------------------------- Config ----------------------------
$.verbose = true

const SESS_NAME = 'inpageedit-next'
const PROJECT_ROOT = resolve(import.meta.dirname, '../../')
const DEV_COMMANDS: ((target: string) => ProcessPromise)[] = [
  (target) => $`tmux send-keys -t ${target} "pnpm --filter core dev" C-m`,
  (target) => $`tmux send-keys -t ${target} "pnpm --filter docs dev" C-m`,
] as const
const DEFAULT_WINDOW = 0

// ---------------------------- Usage ----------------------------
function printHelp() {
  console.log(`
用法：
  pnpm setup-dev [--start] [--stop] [--quiet] [--restart] [--status] [--help]

选项：
  --start       创建并启动 tmux 会话
  --stop        直接结束并删除 "${SESS_NAME}" 会话
  --quiet       启动 tmux 会话但不附着（CI/非交互环境推荐）
  --restart     结束旧会话后重启并（默认）附着
  --status      显示当前 tmux 会话列表（并标注是否存在目标会话）
  --help        显示本帮助
`)
}

// ---------------------------- Arg Parse ----------------------------
type Flags = {
  help?: boolean
  start?: boolean
  stop?: boolean
  quiet?: boolean
  restart?: boolean
  status?: boolean
}
const flags = minimist<Flags>(process.argv.slice(2), {
  boolean: ['help', 'start', 'stop', 'quiet', 'restart', 'status'],
  alias: {
    h: 'help',
    q: 'quiet',
    r: 'restart',
    s: 'status',
    kill: 'stop',
  },
})

// ---------------------------- Main ----------------------------
await main().catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})

async function main() {
  if (flags.help || Object.keys(flags).length === 0) return printHelp()

  cd(PROJECT_ROOT)

  await ensureTmuxInstalled()

  if (flags.status) {
    await printStatus()
    return
  }

  if (flags.stop) {
    const existed = await hasSession(SESS_NAME)
    if (!existed) {
      console.log(`会话 "${SESS_NAME}" 不存在；无需清理。`)
      return
    }
    await killSession(SESS_NAME)
    console.log(`已结束 tmux 会话 "${SESS_NAME}"。`)
    return
  }

  if (flags.restart) {
    if (await hasSession(SESS_NAME)) {
      await killSession(SESS_NAME)
      console.log(`已结束旧会话 "${SESS_NAME}"，准备重启…`)
    }
    await startSessionAndMaybeAttach()
    return
  }

  if (flags.start) {
    if (!(await hasSession(SESS_NAME))) {
      await createSession(SESS_NAME)
      await splitWindowRight(SESS_NAME, DEFAULT_WINDOW)
      await startDevCommands(SESS_NAME, DEV_COMMANDS)
    } else {
      console.log(`复用已存在的会话 "${SESS_NAME}"。`)
    }

    await maybeAttach(SESS_NAME, !flags.quiet)
    return
  }

  return printHelp()
}

// ---------------------------- Actions ----------------------------
async function ensureTmuxInstalled() {
  const r = await $({ nothrow: true })`command -v tmux`
  if (r.exitCode !== 0) {
    throw new Error('tmux 未安装，请先安装 tmux。')
  }
}

async function hasSession(name: string) {
  const r = await $({ nothrow: true })`tmux has-session -t ${name}`
  return r.exitCode === 0
}

async function killSession(name: string) {
  const r = await $({ nothrow: true })`tmux kill-session -t ${name}`
  if (r.exitCode !== 0) {
    throw new Error(`kill-session 失败：${r.stderr || r.stdout}`)
  }
}

async function createSession(name: string) {
  // -n dev：命名第一个窗口；-d：后台创建
  await $`tmux new-session -d -s ${name} -n dev`
}

async function splitWindowRight(name: string, windowIndex = 0) {
  await $`tmux split-window -h -t ${name}:${windowIndex}`
}

async function startDevCommands(
  name: string,
  cmds: readonly (string | ((target: string) => any))[]
) {
  for (let i = 0; i < cmds.length; i++) {
    const paneTarget = `${name}:${DEFAULT_WINDOW}.${i}`
    const cmd = cmds[i]
    await (typeof cmd === 'function'
      ? cmd(paneTarget)
      : await $`tmux send-keys -t ${paneTarget} "${cmd}" C-m`)
  }
}

async function attach(name: string) {
  const TERM = process.env.TERM ?? 'xterm-256color'
  // 让 tmux 直接占用当前 TTY
  await $({ env: { ...process.env, TERM }, stdio: 'inherit' })`tmux attach -t ${name}`
}

async function maybeAttach(name: string, shouldAttach: boolean) {
  if (!shouldAttach) {
    console.log(`会话 "${name}" 已启动。手动附着：tmux attach -t ${name}`)
    return
  }
  const hasTTY = Boolean(process.stdin.isTTY && process.stdout.isTTY)
  if (!hasTTY) {
    console.log(`非交互环境，已跳过 attach。手动附着：tmux attach -t ${name}`)
    return
  }
  await attach(name)
}

async function startSessionAndMaybeAttach() {
  await createSession(SESS_NAME)
  await splitWindowRight(SESS_NAME, DEFAULT_WINDOW)
  await startDevCommands(SESS_NAME, DEV_COMMANDS)
  await maybeAttach(SESS_NAME, !flags.quiet)
}

async function printStatus() {
  const r = await $({ nothrow: true })`tmux ls`
  if (r.exitCode !== 0) {
    console.log('当前没有任何 tmux 会话。')
    return
  }
  const lines = (r.stdout || '').trim().split('\n').filter(Boolean)
  const hit = lines.find((l) => l.startsWith(`${SESS_NAME}:`))
  if (!hit) {
    console.log(`找不到会话 "${SESS_NAME}"。现有会话：\n${lines.join('\n')}`)
  } else {
    console.log(`找到会话：${hit}`)
  }
}

// ---------------------------- Utils ----------------------------
function parseFlags<T extends Record<string, any>>(argv: string[]): T {
  const out: Record<string, any> = {}
  for (const arg of argv) {
    if (!arg.startsWith('--')) continue
    const [k, v] = arg.slice(2).split('=')
    out[k] = v ?? true
  }
  return out as T
}
