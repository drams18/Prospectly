import { useState } from 'react'
import { SCRIPTS, type ScriptType } from '@/data/scripts'

const TYPE_LABELS: Record<ScriptType, string> = { call: 'Appel', sms: 'SMS', email: 'Email' }

export default function ScriptsPage() {
  const [type, setType] = useState<ScriptType>('call')
  const [copied, setCopied] = useState<number | null>(null)

  const grouped = SCRIPTS
    .filter(s => s.type === type)
    .reduce<Record<string, typeof SCRIPTS>>((acc, s) => {
      acc[s.category] = [...(acc[s.category] ?? []), s]
      return acc
    }, {})

  async function copy(index: number, text: string) {
    await navigator.clipboard.writeText(text)
    setCopied(index)
    setTimeout(() => setCopied(null), 1200)
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <h1 className="text-2xl font-semibold text-text">Scripts de prospection</h1>

      <div className="mt-4 flex gap-2">
        {(['call', 'sms', 'email'] as ScriptType[]).map((t) => (
          <button
            key={t}
            onClick={() => setType(t)}
            className={`rounded-app border px-3 py-1.5 text-sm ${type === t ? 'border-primary bg-primary-light text-primary' : 'border-border-strong text-text-secondary hover:bg-bg'}`}
          >
            {TYPE_LABELS[t]}
          </button>
        ))}
      </div>

      <div className="mt-6 space-y-6">
        {Object.entries(grouped).map(([category, scripts]) => (
          <div key={category}>
            <h2 className="text-xs font-semibold uppercase text-text-muted">{category}</h2>
            <div className="mt-2 space-y-3">
              {scripts.map((s, i) => {
                const key = `${category}-${i}`
                const idx = SCRIPTS.indexOf(s)
                return (
                  <div key={key} className="rounded-app-lg border border-border bg-surface p-4">
                    {s.label && <div className="mb-1 text-sm font-medium text-text">{s.label}</div>}
                    {s.subject && <div className="mb-1 text-sm italic text-text-secondary">Objet : {s.subject}</div>}
                    <p className="whitespace-pre-line text-sm text-text-secondary">{s.content}</p>
                    <button
                      onClick={() => copy(idx, s.content)}
                      className="mt-2 rounded-app border border-border-strong px-3 py-1.5 text-xs text-text-secondary hover:bg-bg"
                    >
                      {copied === idx ? 'Copié !' : 'Copier'}
                    </button>
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
