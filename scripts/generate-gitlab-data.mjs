import { mkdir, readFile, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const dataDir = resolve(rootDir, 'data')
await loadDotEnv()

const username = process.env.GITLAB_USERNAME || 'hamajj'
const gitlabToken = process.env.GITLAB_TOKEN
const gitlabUrl = (process.env.GITLAB_URL || 'https://gitlab.com').replace(/\/$/, '')
const api = `${gitlabUrl}/api/v4`

const headers = {
  'User-Agent': `${username}-portfolio-site`,
  ...(gitlabToken ? { 'PRIVATE-TOKEN': gitlabToken } : {}),
}

const defaultProfile = {
  profile: {
    name: username,
    login: username,
    bio: 'Hobbyist Web & Systems-Level Developer',
    avatar: '',
    html_url: `${gitlabUrl}/${username}`,
  },
}

async function loadDotEnv() {
  try {
    const raw = await readFile(resolve(rootDir, '.env'), 'utf8')
    for (const line of raw.split('\n')) {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) continue

      const separatorIndex = trimmed.indexOf('=')
      if (separatorIndex === -1) continue

      const key = trimmed.slice(0, separatorIndex).trim()
      let value = trimmed.slice(separatorIndex + 1).trim()
      if (!key || process.env[key] !== undefined) continue

      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      process.env[key] = value
    }
  } catch {
    // Deployment platforms provide env vars directly; a local .env is optional.
  }
}

function formatDate(date) {
  return date.toISOString().slice(0, 10)
}

function createEmptyContributions() {
  const today = new Date()
  today.setUTCHours(0, 0, 0, 0)

  return Array.from({ length: 365 }, (_, index) => {
    const date = new Date(today)
    date.setUTCDate(today.getUTCDate() - (364 - index))

    return {
      date: formatDate(date),
      count: 0,
      level: 0,
    }
  })
}

async function fetchJson(url) {
  const response = await fetch(url, { headers })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for ${url}`)
  }

  return response.json()
}

async function readJson(filename, fallback) {
  try {
    const raw = await readFile(resolve(dataDir, filename), 'utf8')
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

async function writeJson(filename, data) {
  await writeFile(resolve(dataDir, filename), `${JSON.stringify(data, null, 2)}\n`)
}

async function downloadFavicon(avatarUrl) {
  if (!avatarUrl) return
  try {
    // Gravatar serves a generated identicon when no avatar is set; ask for a
    // 404 instead so the previous favicon is kept.
    const url = avatarUrl.replace(/([?&])d=identicon/, '$1d=404')
    const response = await fetch(url, { headers })
    if (!response.ok) {
      throw new Error(`${response.status} ${response.statusText}`)
    }
    const bytes = Buffer.from(await response.arrayBuffer())
    if (bytes.length < 100) throw new Error('avatar response too small')

    const isPng = bytes.subarray(0, 4).toString('hex') === '89504e47'
    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8
    if (!isPng && !isJpeg) throw new Error('avatar is neither PNG nor JPEG')

    const filename = isPng ? 'favicon.png' : 'favicon.jpg'
    await writeFile(resolve(rootDir, 'public', filename), bytes)
    // drop the other format so only one icon file ships
    const stale = resolve(rootDir, 'public', isPng ? 'favicon.jpg' : 'favicon.png')
    await rm(stale, { force: true })
    console.log(`Updated public/${filename} (${bytes.length} bytes)`)
  } catch (error) {
    console.warn(`Keeping previous favicon: ${error.message}`)
  }
}

function toProfile(user) {
  return {
    profile: {
      name: user.name?.replace(/\s+/g, ' ').trim() || username,
      login: user.username ?? username,
      bio: user.bio?.trim() || defaultProfile.profile.bio,
      avatar: user.avatar_url ?? '',
      html_url: user.web_url ?? defaultProfile.profile.html_url,
    },
  }
}

async function fetchProfile() {
  const [user] = await fetchJson(`${api}/users?username=${encodeURIComponent(username)}`)
  if (!user) throw new Error(`GitLab user ${username} not found`)

  // The public lookup omits bio; the full record needs an authenticated request.
  if (!gitlabToken) return toProfile(user)
  return toProfile(await fetchJson(`${api}/users/${user.id}`))
}

function readmeExcerpt(markdown) {
  const withoutCode = markdown.replace(/```[\s\S]*?```/g, '')
  const lines = withoutCode.split(/\r?\n/)
  const candidates = []
  let buffer = []

  const flush = () => {
    if (!buffer.length) return
    const paragraph = buffer
      .join(' ')
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
      .replace(/[*_`~#>|-]/g, ' ')
      .replace(/<[^>]+>/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
    if (paragraph.length >= 40) candidates.push(paragraph)
    buffer = []
  }

  for (const line of lines) {
    const trimmed = line.trim()
    const isNoise =
      !trimmed ||
      trimmed.startsWith('#') ||
      trimmed.startsWith('>') ||
      trimmed.startsWith('|') ||
      trimmed.startsWith('!') ||
      trimmed.startsWith('[![') ||
      /^[-*+]\s/.test(trimmed) ||
      /^\d+\.\s/.test(trimmed) ||
      trimmed.startsWith('<')

    if (isNoise) {
      flush()
      continue
    }
    buffer.push(trimmed)
  }
  flush()

  if (!candidates.length) return null
  const text = candidates[0]
  if (text.length <= 220) return text
  return `${text.slice(0, 217).replace(/\s+\S*$/, '')}…`
}

async function fetchReadmeExcerpt(project) {
  // readme_url looks like https://gitlab.com/<ns>/<repo>/-/blob/<branch>/README.md
  const marker = `/-/blob/${project.default_branch}/`
  const markerIndex = project.readme_url?.indexOf(marker) ?? -1
  if (markerIndex === -1) return null
  const path = project.readme_url.slice(markerIndex + marker.length)

  try {
    const response = await fetch(
      `${api}/projects/${project.id}/repository/files/${encodeURIComponent(path)}/raw?ref=${encodeURIComponent(project.default_branch)}`,
      { headers },
    )
    if (!response.ok) return null
    return readmeExcerpt(await response.text())
  } catch {
    return null
  }
}

async function fetchPrimaryLanguage(project) {
  try {
    const languages = await fetchJson(`${api}/projects/${project.id}/languages`)
    const [top] = Object.entries(languages).sort((a, b) => b[1] - a[1])
    return top?.[0] ?? null
  } catch {
    return null
  }
}

async function toRepos(projects) {
  const active = projects.filter((project) => !project.forked_from_project && !project.archived)
  const mapped = []

  for (const project of active) {
    const hasDescription = Boolean(project.description?.trim())
    const readme = hasDescription ? null : await fetchReadmeExcerpt(project)
    const language = await fetchPrimaryLanguage(project)

    mapped.push({
      title: project.name?.toUpperCase() ?? 'UNKNOWN',
      desc: project.description?.trim() || 'No description.',
      tags: [language ?? 'UNKNOWN', 'GITLAB'],
      url: project.web_url,
      topics: project.topics ?? [],
      ...(readme ? { readme } : {}),
    })
  }

  return mapped
}

// GitLab's calendar only gives counts, so bucket them into GitHub-style
// quartile levels relative to the busiest day.
function toContributionLevel(count, max) {
  if (!count || !max) return 0
  return Math.min(4, Math.ceil((count / max) * 4))
}

async function fetchContributionCalendar() {
  const response = await fetch(`${gitlabUrl}/users/${encodeURIComponent(username)}/calendar.json`, {
    headers,
  })
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText} for GitLab contribution calendar`)
  }

  const counts = await response.json()
  const days = createEmptyContributions()
  const max = Math.max(0, ...days.map((day) => counts[day.date] ?? 0))

  return days.map((day) => {
    const count = counts[day.date] ?? 0
    return { ...day, count, level: toContributionLevel(count, max) }
  })
}

async function syncFile(filename, producer, fallback) {
  try {
    const nextData = await producer()
    await writeJson(filename, nextData)
    console.log(`Updated data/${filename}`)
    return
  } catch (error) {
    const cachedData = await readJson(filename, fallback)
    await writeJson(filename, cachedData)
    console.warn(`Using cached data/${filename}: ${error.message}`)
  }
}

await mkdir(dataDir, { recursive: true })

await syncFile('gitlab-profile.json', fetchProfile, defaultProfile)

await syncFile(
  'gitlab-repos.json',
  async () =>
    toRepos(
      await fetchJson(
        `${api}/users/${encodeURIComponent(username)}/projects?per_page=100&order_by=last_activity_at&visibility=public`,
      ),
    ),
  [],
)

await syncFile(
  'gitlab-contributions.json',
  fetchContributionCalendar,
  createEmptyContributions(),
)

const syncedProfile = await readJson('gitlab-profile.json', defaultProfile)
await downloadFavicon(syncedProfile.profile?.avatar)
