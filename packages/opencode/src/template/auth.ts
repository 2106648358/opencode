import { Log, Filesystem } from "../util"
import path from "path"
import { Global } from "@opencode-ai/core/global"

const log = Log.create({ service: "template.auth" })

type RepoAuth = {
  [repoName: string]: {
    token?: string
    sshKeyPath?: string
  }
}

let cached: RepoAuth | undefined

function authFilePath(): string {
  return path.join(Global.Path.state, "template-auth.json")
}

async function load(): Promise<RepoAuth> {
  if (cached) return cached
  try {
    cached = await Filesystem.readJson<RepoAuth>(authFilePath())
  } catch {
    cached = {}
  }
  return cached!
}

async function save(): Promise<void> {
  await Filesystem.writeJson(authFilePath(), cached ?? {}, 0o600)
}

export async function getRepoToken(repoName: string): Promise<string | undefined> {
  const data = await load()
  return data[repoName]?.token
}

export async function setRepoToken(repoName: string, token: string): Promise<void> {
  const data = await load()
  data[repoName] = { ...data[repoName], token }
  cached = data
  await save()
  log.info("token saved for repo", { repoName })
}

export async function getRepoSSHKey(repoName: string): Promise<string | undefined> {
  const data = await load()
  return data[repoName]?.sshKeyPath
}

export async function setRepoSSHKey(repoName: string, keyPath: string): Promise<void> {
  const data = await load()
  data[repoName] = { ...data[repoName], sshKeyPath: keyPath }
  cached = data
  await save()
  log.info("SSH key saved for repo", { repoName, keyPath })
}

export async function clearRepoAuth(repoName: string): Promise<void> {
  const data = await load()
  delete data[repoName]
  cached = data
  await save()
  log.info("auth cleared for repo", { repoName })
}
