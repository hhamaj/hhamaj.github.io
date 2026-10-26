const MAX_COMMAND_LENGTH = 200

function corsHeaders(origin) {
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

// Keep the command inside an inline code span so Discord renders it verbatim.
function toCodeSpan(text) {
  return `\`${text.replace(/`/g, 'ˋ')}\``
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') ?? ''
    const allowed = (env.ALLOWED_ORIGINS ?? '').split(',').map((value) => value.trim())
    if (!allowed.includes(origin)) return new Response('forbidden', { status: 403 })

    const cors = corsHeaders(origin)
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors })
    if (request.method !== 'POST') return new Response('method not allowed', { status: 405, headers: cors })

    const ip = request.headers.get('CF-Connecting-IP') ?? 'unknown'
    if (env.LIMITER) {
      const { success } = await env.LIMITER.limit({ key: ip })
      if (!success) return new Response('slow down', { status: 429, headers: cors })
    }

    let command
    try {
      ;({ command } = await request.json())
    } catch {
      return new Response('bad request', { status: 400, headers: cors })
    }
    if (typeof command !== 'string' || !command.trim()) {
      return new Response('bad request', { status: 400, headers: cors })
    }

    command = command.replace(/[\r\n]+/g, ' ').trim()
    if (command.length > MAX_COMMAND_LENGTH) command = `${command.slice(0, MAX_COMMAND_LENGTH)}…`
    const country = request.cf?.country ?? '??'

    const response = await fetch(env.DISCORD_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        username: 'C:\\HAMZA>',
        content: `${toCodeSpan(command)} · ${country}`,
        allowed_mentions: { parse: [] },
      }),
    })

    return new Response(null, { status: response.ok ? 204 : 502, headers: cors })
  },
}
