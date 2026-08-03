// The last line of defense against the white screen. Any error thrown while
// rendering ANY screen lands here and becomes a readable crash page with
// recovery actions instead of a silent blank <div id="root">.
//
// Styling is inline on purpose: this screen must render correctly even when
// the app's stylesheets failed to load (one of the ways a boot goes wrong).

import { Component, type ReactNode } from 'react'
import { deleteSave } from '@/state/persist'

interface Props {
  children: ReactNode
}

interface State {
  error: Error | null
  confirmDelete: boolean
  busy: boolean
}

// Unregister every service worker and empty CacheStorage, then reload.
// Deliberately does NOT touch IndexedDB — the career save always survives.
async function repairAndReload(): Promise<void> {
  try {
    const jobs: Promise<unknown>[] = []
    if ('serviceWorker' in navigator) {
      jobs.push(
        navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))),
      )
    }
    if ('caches' in window) {
      jobs.push(caches.keys().then((ks) => Promise.all(ks.map((k) => caches.delete(k)))))
    }
    await Promise.race([Promise.all(jobs), new Promise((res) => setTimeout(res, 3000))])
  } catch {
    // repair is best-effort; the reload is the point
  }
  location.reload()
}

const S = {
  wrap: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    padding: 24,
    background: '#0b1020',
    color: '#e8ecf8',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    textAlign: 'center',
  },
  h1: { fontSize: 22, fontWeight: 800, margin: 0 },
  p: { fontSize: 14, opacity: 0.8, margin: 0, maxWidth: 340, lineHeight: 1.5 },
  pre: {
    maxWidth: '90vw',
    maxHeight: '30vh',
    overflow: 'auto',
    fontSize: 11,
    textAlign: 'left',
    background: 'rgba(255,255,255,0.06)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 10,
    padding: 12,
    whiteSpace: 'pre-wrap',
    wordBreak: 'break-word',
  },
  btn: {
    width: 260,
    padding: '12px 16px',
    borderRadius: 12,
    border: '1px solid rgba(255,255,255,0.18)',
    background: 'rgba(255,255,255,0.08)',
    color: '#e8ecf8',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
  },
  primary: { background: '#2f6df6', border: '1px solid #2f6df6' },
  danger: { background: 'rgba(230,70,70,0.15)', border: '1px solid rgba(230,70,70,0.5)', color: '#ff9c9c' },
} as const

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, confirmDelete: false, busy: false }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, confirmDelete: false }
  }

  componentDidCatch(error: Error, info: { componentStack?: string | null }): void {
    console.error('NTM crash:', error, info.componentStack)
    // Keep the last crash around so it can be reported even after a reload.
    try {
      localStorage.setItem(
        'ntm:lastCrash',
        JSON.stringify({ at: Date.now(), message: String(error?.message ?? error), stack: error?.stack?.slice(0, 2000) }),
      )
    } catch {
      // storage may be unavailable; the on-screen report still shows
    }
  }

  render() {
    const { error, confirmDelete, busy } = this.state
    if (!error) return this.props.children

    const detail = [String(error.message || error), ...(error.stack ? [error.stack.split('\n').slice(1, 8).join('\n')] : [])].join('\n')

    return (
      <div style={S.wrap as React.CSSProperties}>
        <div style={{ fontSize: 40 }}>🟥</div>
        <h1 style={S.h1}>Something broke</h1>
        <p style={S.p}>
          The game hit an error it couldn&apos;t recover from. Your save is safe — none of the buttons
          below touch it except the red one.
        </p>
        <pre style={S.pre as React.CSSProperties}>{detail}</pre>

        <button
          style={{ ...S.btn, ...S.primary }}
          disabled={busy}
          onClick={() => location.reload()}
        >
          Reload the game
        </button>
        <button
          style={S.btn}
          disabled={busy}
          onClick={() => {
            this.setState({ busy: true })
            void repairAndReload()
          }}
        >
          Repair app &amp; reload
        </button>
        {!confirmDelete ? (
          <button style={{ ...S.btn, ...S.danger }} disabled={busy} onClick={() => this.setState({ confirmDelete: true })}>
            Delete save &amp; start over…
          </button>
        ) : (
          <button
            style={{ ...S.btn, ...S.danger }}
            disabled={busy}
            onClick={() => {
              this.setState({ busy: true })
              void deleteSave().finally(() => location.reload())
            }}
          >
            Tap again to confirm — this erases your career
          </button>
        )}
        <p style={{ ...S.p, fontSize: 12, opacity: 0.5 }}>
          If this keeps happening, &quot;Repair app &amp; reload&quot; clears cached code and usually fixes it.
        </p>
      </div>
    )
  }
}
