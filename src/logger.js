const APP_TAG = '[foto-ao-vivo]'

function ts() {
  return new Date().toISOString()
}

function format(scope, message, payload) {
  if (payload === undefined) return [APP_TAG, ts(), `[${scope}]`, message]
  return [APP_TAG, ts(), `[${scope}]`, message, payload]
}

export function logInfo(scope, message, payload) {
  console.info(...format(scope, message, payload))
}

export function logWarn(scope, message, payload) {
  console.warn(...format(scope, message, payload))
}

export function logError(scope, message, payload) {
  console.error(...format(scope, message, payload))
}
