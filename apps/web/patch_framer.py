with open("src/app/team/[teamId]/runs/[runId]/page.tsx", "r") as f:
    content = f.read()

target = """          ].map(kpi => (
            <div key={kpi.label} className="panel-tight p-4">
              <p className="text-xs font-medium text-[var(--app-muted)]">{kpi.label}</p>
              <p className={`mt-0.5 text-xl font-extrabold ${kpi.capitalize ? 'capitalize' : ''}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {run.use_sandbox && ("""

replacement = """          ].map(kpi => (
            <div key={kpi.label} className="panel-tight p-4">
              <p className="text-xs font-medium text-[var(--app-muted)]">{kpi.label}</p>
              <p className={`mt-0.5 text-xl font-extrabold ${kpi.capitalize ? 'capitalize' : ''}`}>
                {kpi.value}
              </p>
            </div>
          ))}
        </div>

        {/* Success Dopamine Banner */}
        <AnimatePresence>
          {run.status === 'completed' && successRate === 100 && (
            <motion.div
              initial={{ opacity: 0, y: 15, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200, delay: 0.2 }}
              className="mb-6 relative overflow-hidden rounded-[24px] bg-[#0c1218] p-[1px]"
            >
              {/* Shimmering sweeping border effect */}
              <motion.div
                animate={{ x: ['-200%', '200%'] }}
                transition={{ repeat: Infinity, duration: 3, ease: 'linear' }}
                className="absolute inset-0 z-0 h-full w-[150%] bg-gradient-to-r from-transparent via-[#4a8c61] to-transparent opacity-40 skew-x-12"
              />
              
              <div className="relative z-10 flex flex-col sm:flex-row items-center justify-between gap-6 rounded-[23px] bg-gradient-to-br from-[#0c1218] to-[#141d24] px-6 py-5">
                <div className="flex items-center gap-4">
                  <motion.div
                    initial={{ scale: 0, rotate: -45 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', damping: 12, delay: 0.4 }}
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[rgba(76,175,80,0.12)] text-[#4a8c61] border border-[rgba(76,175,80,0.2)] shadow-[0_0_20px_rgba(76,175,80,0.15)]"
                  >
                    <CheckCircle size={28} weight="fill" />
                  </motion.div>
                  <div>
                    <h3 className="text-lg font-extrabold text-white tracking-tight">Run executed flawlessly</h3>
                    <p className="mt-0.5 text-sm text-[var(--app-muted)]">
                      All {Math.max(1, run.total_items)} items processed successfully. No errors detected across the entire playbook flow.
                    </p>
                  </div>
                </div>
                
                {/* Gentle stats glowing stars */}
                <div className="flex gap-2 text-[#4a8c61] opacity-70">
                  <Sparkle size={20} weight="duotone" className="animate-pulse" />
                  <Sparkle size={20} weight="duotone" className="animate-pulse [animation-delay:300ms]" />
                  <Sparkle size={20} weight="duotone" className="animate-pulse [animation-delay:600ms]" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {run.use_sandbox && ("""

if target in content:
    content = content.replace(target, replacement)
    with open("src/app/team/[teamId]/runs/[runId]/page.tsx", "w") as f:
        f.write(content)
    print("Success")
else:
    print("Failed to find target string. Here is roughly what is there:")
    lines = content.splitlines()
    for i in range(180, 200):
        if i < len(lines):
            print(lines[i])

