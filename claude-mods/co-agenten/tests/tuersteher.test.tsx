import { expect, test } from 'claude-code/testing'

const SPAWN = {
  tool_use_id: 't1',
  prompt: 'Suche X',
  description: 'Suche X',
  subagentType: 'general-purpose',
  provider: { plugin: 'engine', tier: 'core' },
  parentModel: 'opus',
  background: true,
  fork: false,
} as const

const PANE = {
  plugin: 'co-agenten',
  component: 'Pane',
  requestId: 'co-agenten',
  props: { title: 'Co-Agenten', isFocused: false, bodyColumns: 44, placement: 'dock', scroll: { offset: 0, bodyRows: 40 }, view: {} },
} as const

function engine(on: Parameters<Parameters<typeof test>[1]>[1]) {
  on('command.register', () => ({ value: { command: 'coagenten' } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_, e) => ({ cwd: e.cwd }))
  on('agent.spawn', (_, e) => ({ model: e.model ?? 'opus', agentId: 'a-' + e.tool_use_id }))
  on('agent.list', () => ({ value: [] }))
  on('store.get', () => ({ value: undefined }))
  on('store.set', () => ({ value: undefined }))
  on('command.run', () => ({ text: '' }))
  on('ui.status', () => ({ value: undefined }))
  on('clock.now', () => ({ value: 1000 }))
}

test('im Modus Aus wird jeder Co-Agent abgelehnt', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'coagenten', args: 'aus' })
  const r = await $.agent.spawn(SPAWN as never)
  expect(String((r as { deny?: string }).deny)).toContain('ausgeschaltet')
})

test('Limit und Modell werden durchgesetzt', async ($, on) => {
  engine(on)
  await $.session.start({ cwd: '/', surface: 'desktop', isInteractive: true })
  await $.command.run({ command: 'coagenten', args: '1' })
  const erster = await $.agent.spawn(SPAWN as never)
  expect((erster as { deny?: string }).deny).toBe(undefined)
  const zweiter = await $.agent.spawn({ ...SPAWN, tool_use_id: 't2' } as never)
  expect(String((zweiter as { deny?: string }).deny)).toContain('Limit erreicht')

  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  expect((await ui.find({ type: 'Text', text: /CREW/ }))?.text).toContain('1 von 1 aktiv')
  await ui.unmount()
})
