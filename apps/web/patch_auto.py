import re

with open("src/app/team/[teamId]/automations/page.tsx", "r") as f:
    content = f.read()

# 1. Add imports for Phosphor icons
import_match = re.search(r"import \{([^}]+)\} from '@phosphor-icons/react';", content)
if import_match:
    icons = import_match.group(1)
    if 'Clock' not in icons:
        new_icons = icons + ", Clock, Link, CaretDown, CaretRight, Code"
        content = content.replace(import_match.group(0), f"import {{{new_icons}}} from '@phosphor-icons/react';")

# 2. Add state for showInputJson
state_match = "const [inputRowsJson, setInputRowsJson] = useState('[{}]');"
if state_match in content and "showInputJson" not in content:
    content = content.replace(state_match, state_match + "\n  const [showInputJson, setShowInputJson] = useState(false);")

# 3. Replace the Trigger toggle
trigger_old = """            <div>
              <label className="mb-1 block text-sm font-semibold">Trigger</label>
              <div className="flex gap-2">
                {(['interval', 'webhook'] as const).map(kind => (
                  <button
                    key={kind}
                    type="button"
                    onClick={() => setTriggerType(kind)}
                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition-colors ${
                      triggerType === kind
                        ? 'bg-[var(--app-fg)] text-[var(--app-bg)]'
                        : 'bg-[var(--app-chip)] text-[var(--app-muted)] hover:bg-[var(--app-line)]'
                    }`}
                  >
                    {kind}
                  </button>
                ))}
              </div>
            </div>"""

trigger_new = """            <div className="space-y-2">
              <label className="mb-1 block text-sm font-semibold">Trigger</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setTriggerType('interval')}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                    triggerType === 'interval'
                      ? 'border-[var(--app-blue)] bg-[rgba(59,130,246,0.08)]'
                      : 'border-[var(--app-line)] hover:bg-[var(--app-chip)]'
                  }`}
                >
                  <div className={`rounded-lg p-1.5 ${triggerType === 'interval' ? 'bg-[var(--app-blue)] text-white' : 'bg-[var(--app-chip)] text-[var(--app-muted)]'}`}>
                    <Clock size={18} weight={triggerType === 'interval' ? 'fill' : 'regular'} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm mt-1">Schedule</div>
                    <div className="text-xs text-[var(--app-muted)]">Run automatically on an interval</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => setTriggerType('webhook')}
                  className={`flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors ${
                    triggerType === 'webhook'
                      ? 'border-[var(--app-blue)] bg-[rgba(59,130,246,0.08)]'
                      : 'border-[var(--app-line)] hover:bg-[var(--app-chip)]'
                  }`}
                >
                  <div className={`rounded-lg p-1.5 ${triggerType === 'webhook' ? 'bg-[var(--app-blue)] text-white' : 'bg-[var(--app-chip)] text-[var(--app-muted)]'}`}>
                    <Link size={18} weight={triggerType === 'webhook' ? 'bold' : 'regular'} />
                  </div>
                  <div>
                    <div className="font-semibold text-sm mt-1">Webhook</div>
                    <div className="text-xs text-[var(--app-muted)]">Trigger via an external URL</div>
                  </div>
                </button>
              </div>
            </div>"""

content = content.replace(trigger_old, trigger_new)

# 4. Replace Input rows JSON
input_old = """            <div>
              <label className="mb-1 block text-sm font-semibold">Input rows JSON</label>
              <textarea
                className="input min-h-[120px] font-mono text-xs"
                value={inputRowsJson}
                onChange={e => setInputRowsJson(e.target.value)}
              />
            </div>"""

input_new = """            <div className="rounded-xl border border-[var(--app-line)] overflow-hidden">
              <button
                type="button"
                onClick={() => setShowInputJson(!showInputJson)}
                className="flex w-full items-center justify-between bg-[var(--app-chip)] px-4 py-3 text-sm font-semibold hover:bg-[var(--app-line)] transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Code size={16} className="text-[var(--app-muted)]" />
                  Advanced: Input data (JSON)
                </span>
                {showInputJson ? <CaretDown size={14} /> : <CaretRight size={14} />}
              </button>
              {showInputJson && (
                <div className="p-4 bg-transparent border-t border-[var(--app-line)]">
                  <p className="mb-2 text-xs text-[var(--app-muted)]">
                    Provide an array of objects. The playbook will run once for each item in the array.
                  </p>
                  <textarea
                    className="input min-h-[120px] font-mono text-xs"
                    value={inputRowsJson}
                    onChange={e => setInputRowsJson(e.target.value)}
                  />
                </div>
              )}
            </div>"""

content = content.replace(input_old, input_new)

with open("src/app/team/[teamId]/automations/page.tsx", "w") as f:
    f.write(content)

print("Patch applied")
