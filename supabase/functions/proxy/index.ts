// supabase/functions/proxy/index.ts
// Proxy für Transfermarkt und api-fussball.de

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-auth-token',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const targetUrl = url.searchParams.get('url')
    const type = url.searchParams.get('type') || 'transfermarkt'

    if (!targetUrl) {
      return new Response(
        JSON.stringify({ error: 'Missing url parameter' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[PROXY] Type: ${type}, URL: ${targetUrl}`)

    let headers: Record<string, string> = {}

    if (type === 'transfermarkt') {
      // Transfermarkt braucht Browser-ähnliche Headers
      headers = {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8',
        'Cache-Control': 'no-cache',
      }
    } else if (type === 'fussball') {
      // api-fussball.de braucht den Auth Token
      headers = {
        'Content-Type': 'application/json',
      }
      const authToken = req.headers.get('x-auth-token')
      if (authToken) {
        headers['x-auth-token'] = authToken
      }
    }

    // Fetch mit Timeout (10 Sekunden)
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), 10000)

    const response = await fetch(targetUrl, {
      method: 'GET',
      headers,
      signal: controller.signal,
    })

    clearTimeout(timeoutId)

    const contentType = response.headers.get('content-type') || 'text/html'
    const data = await response.text()

    console.log(`[PROXY] Response: ${response.status}, Length: ${data.length}`)

    return new Response(data, {
      status: response.status,
      headers: {
        ...corsHeaders,
        'Content-Type': contentType,
      },
    })

  } catch (error) {
    console.error('[PROXY] Error:', error.message)
    
    const status = error.name === 'AbortError' ? 504 : 500
    const message = error.name === 'AbortError' ? 'Timeout - Server antwortet nicht' : error.message

    return new Response(
      JSON.stringify({ error: message }),
      { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
