import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SETTINGS_OPTIONS, SNIPPET_DIFFICULTY } from '../game/constants'
import { Equalizer, Logo, LogoMark, Vinyl } from '../components/brand'
import {
  AnimatedNumber,
  Avatar,
  AvatarGroup,
  AvatarPicker,
  Badge,
  Button,
  Chip,
  CodeInput,
  Icon,
  ICON_NAMES,
  IconButton,
  Input,
  Kbd,
  Modal,
  Panel,
  ProgressDots,
  Segmented,
  Spinner,
  TimerBar,
  TimerRing,
  ToastViewport,
  Tooltip,
  cn,
  type ButtonVariant,
  type ToastViewItem,
} from '../components/ui'

// Living styleguide (#/styleguide): every design-system primitive with its
// states, plus a HUD composition to judge the kit as a whole.

const COVER = 'https://cdn-images.dzcdn.net/images/cover/2e018122cb56986277102d2041a592c8/500x500-000000-80-0-0.jpg'

const PLAYERS = [
  { id: 'a', name: 'Tommy', avatar: 0, color: 0, host: true, submitted: false, connected: true },
  { id: 'b', name: 'Giulia', avatar: 10, color: 1, host: false, submitted: true, connected: true },
  { id: 'c', name: 'DJ Pinguino', avatar: 14, color: 2, host: false, submitted: false, connected: true },
  { id: 'd', name: 'Marco', avatar: 3, color: 3, host: false, submitted: false, connected: false },
  { id: 'e', name: 'Sofi', avatar: 7, color: 4, host: false, submitted: true, connected: true },
  { id: 'f', name: 'Luca', avatar: 12, color: 6, host: false, submitted: false, connected: true },
  { id: 'g', name: 'Ale', avatar: 18, color: 8, host: false, submitted: false, connected: true },
]

const CATEGORIES = ['Hit 2000', 'Anni 80', 'Rap italiano', 'Rock classics', 'Pop', 'Dance', 'Indie']

const TOKENS: Array<{ name: string; cls: string; dark?: boolean }> = [
  { name: 'ink-950', cls: 'bg-ink-950' },
  { name: 'ink-900', cls: 'bg-ink-900' },
  { name: 'ink-800', cls: 'bg-ink-800' },
  { name: 'ink-700', cls: 'bg-ink-700' },
  { name: 'ink-600', cls: 'bg-ink-600' },
  { name: 'ink-400', cls: 'bg-ink-400' },
  { name: 'ink-200', cls: 'bg-ink-200', dark: true },
  { name: 'ink-50', cls: 'bg-ink-50', dark: true },
  { name: 'violet', cls: 'bg-violet' },
  { name: 'magenta', cls: 'bg-magenta' },
  { name: 'cyan', cls: 'bg-cyan', dark: true },
  { name: 'lime', cls: 'bg-lime', dark: true },
  { name: 'gold', cls: 'bg-gold', dark: true },
  { name: 'coral', cls: 'bg-coral' },
  { name: 'orange', cls: 'bg-orange', dark: true },
  { name: 'mint', cls: 'bg-mint', dark: true },
]

function Section({ id, kicker, title, children, className }: { id: string; kicker: string; title: string; children: ReactNode; className?: string }) {
  return (
    <section id={id} className={cn('scroll-mt-24', className)}>
      <div className="mb-5 flex items-baseline gap-3 sm:mb-6">
        <span className="num text-xs font-bold text-magenta">{kicker}</span>
        <h2 className="display display-skew text-2xl text-ink-50 sm:text-[2rem]">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Label({ children }: { children: ReactNode }) {
  return <p className="eyebrow mb-3">{children}</p>
}

const NAV = [
  ['brand', 'Brand'],
  ['type', 'Tipo & colori'],
  ['buttons', 'Bottoni'],
  ['icons', 'Icone'],
  ['panels', 'Pannelli'],
  ['fields', 'Campi'],
  ['avatars', 'Avatar'],
  ['controls', 'Controlli'],
  ['timers', 'Timer'],
  ['feedback', 'Feedback'],
  ['hud', 'HUD'],
] as const

export function StyleguideScreen() {
  const [replay, setReplay] = useState(0)

  return (
    <div className="h-dvh overflow-y-auto overflow-x-hidden">
      <div className="mx-auto flex max-w-6xl flex-col gap-16 px-4 pt-safe-8 pb-safe-24 sm:gap-20 sm:px-8 sm:pt-safe-14">
        <header className="flex flex-col items-center gap-6 text-center">
          <Badge tone="violet" icon="sparkles" size="md">
            Design system
          </Badge>
          <Logo size="hero" replayKey={replay} />
          <p className="max-w-md text-balance text-ink-300">
            La hit è stata fatta a pezzi. Rimettila in ordine prima degli altri.
          </p>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="glass" size="sm" leftIcon="shuffle" onClick={() => setReplay((r) => r + 1)}>
              Rimescola logo
            </Button>
          </div>
          <nav aria-label="Sezioni" className="no-scrollbar -mx-4 flex max-w-[100vw] gap-2 overflow-x-auto px-4 pt-2 sm:flex-wrap sm:justify-center">
            {NAV.map(([id, label]) => (
              <a
                key={id}
                href={`#sg-${id}`}
                onClick={(e) => {
                  e.preventDefault()
                  document.getElementById(`sg-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                }}
                className="shrink-0 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-bold text-ink-200 transition-colors hover:bg-white/10 hover:text-white"
              >
                {label}
              </a>
            ))}
          </nav>
        </header>

        <BrandSection />
        <TypeSection />
        <ButtonsSection />
        <IconsSection />
        <PanelsSection />
        <FieldsSection />
        <AvatarsSection />
        <ControlsSection />
        <TimersSection />
        <FeedbackSection />
        <HudSection />

        <footer className="flex items-center justify-center gap-3 text-xs text-ink-400">
          <LogoMark size={22} animate={false} />
          UNSHUFFLE · componenti in <code className="num text-ink-300">src/components/ui</code>
        </footer>
      </div>
    </div>
  )
}

function BrandSection() {
  return (
    <Section id="sg-brand" kicker="01" title="Brand">
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        <Panel padding="lg" className="flex flex-col gap-7 overflow-hidden">
          <Label>Wordmark · taglie</Label>
          <div className="flex flex-col items-start gap-6">
            <Logo size="lg" animate={false} />
            <Logo size="md" animate={false} />
            <div className="flex flex-wrap items-center gap-6">
              <Logo size="sm" mark animate={false} />
              <Logo size="md" mark animate={false} />
            </div>
          </div>
        </Panel>
        <Panel padding="lg" className="flex flex-col gap-6">
          <Label>Marchio compatto</Label>
          <div className="flex flex-wrap items-end gap-5">
            <LogoMark size={96} />
            <LogoMark size={64} />
            <LogoMark size={44} />
            <LogoMark size={32} />
            <LogoMark size={24} />
          </div>
          <p className="text-sm leading-relaxed text-ink-300">
            Quattro barre di equalizzatore che si mettono in ordine da sole: il gioco in un'icona.
          </p>
        </Panel>
      </div>
    </Section>
  )
}

function TypeSection() {
  return (
    <Section id="sg-type" kicker="02" title="Tipo & colori">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel padding="lg" className="flex flex-col gap-5">
          <Label>Tipografia</Label>
          <div>
            <p className="display display-skew text-4xl text-ink-50 sm:text-5xl">Round 2 / 5</p>
            <p className="mt-2 text-xs text-ink-400">
              <code className="num">.display .display-skew</code> — Unbounded 800, maiuscolo
            </p>
          </div>
          <div>
            <p className="text-lg font-bold text-ink-50">Giulia ha confermato — 15 secondi!</p>
            <p className="text-sm text-ink-300">Manrope per testi e interfaccia. Leggibile, amichevole, compatto.</p>
          </div>
          <div className="flex items-baseline gap-4">
            <span className="num text-4xl font-bold text-gold">13.840</span>
            <span className="num text-2xl font-bold text-lime">+4.250</span>
            <span className="num text-lg text-ink-300">1:05</span>
          </div>
          <p className="text-xs text-ink-400">
            <code className="num">.num</code> — JetBrains Mono tabulare per punteggi e timer
          </p>
          <p className="display text-gradient-brand text-3xl">Neon club</p>
        </Panel>
        <Panel padding="lg">
          <Label>Token colore</Label>
          <div className="grid grid-cols-4 gap-2.5 sm:grid-cols-4">
            {TOKENS.map((t) => (
              <div key={t.name} className="flex flex-col gap-1.5">
                <div className={cn('aspect-[4/3] rounded-xl border border-white/10 shadow-[inset_0_1px_0_rgb(255_255_255/0.15)]', t.cls)} />
                <span className="num truncate text-[10px] text-ink-300">{t.name}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </Section>
  )
}

function ButtonsSection() {
  const variants: ButtonVariant[] = ['primary', 'secondary', 'danger', 'glass', 'ghost']
  const [loading, setLoading] = useState(false)
  return (
    <Section id="sg-buttons" kicker="03" title="Bottoni">
      <div className="flex flex-col gap-4">
        <Panel padding="lg" className="flex flex-col gap-8">
          <div>
            <Label>Varianti</Label>
            <div className="flex flex-wrap items-center gap-3">
              {variants.map((v) => (
                <Button key={v} variant={v}>
                  {v === 'primary' ? 'Crea stanza' : v === 'secondary' ? 'Entra' : v === 'danger' ? 'Esci' : v === 'glass' ? 'Copia link' : 'Annulla'}
                </Button>
              ))}
            </div>
          </div>
          <div>
            <Label>Taglie</Label>
            <div className="flex flex-wrap items-end gap-3">
              <Button size="sm">Piccolo</Button>
              <Button size="md">Medio</Button>
              <Button size="lg">Grande</Button>
              <Button size="xl" rightIcon="arrow-right">
                Via!
              </Button>
            </div>
            <p className="mt-3 text-xs text-ink-400">
              Su touch <code className="num text-ink-300">sm</code> (36px) ha un'area di tocco invisibile di 48px; per controlli custom c'è{' '}
              <code className="num text-ink-300">hit-slop</code>.
            </p>
          </div>
          <div>
            <Label>Icone · stati</Label>
            <div className="flex flex-wrap items-center gap-3">
              <Button variant="secondary" leftIcon="play">
                Ascolta
              </Button>
              <Button variant="glass" leftIcon="copy">
                Copia link
              </Button>
              <Button variant="primary" loading={loading} leftIcon="bolt" onClick={() => { setLoading(true); setTimeout(() => setLoading(false), 1800) }}>
                Inizia partita
              </Button>
              <Button disabled leftIcon="lock">
                Scegli playlist
              </Button>
              <Button variant="danger" size="sm" leftIcon="kick">
                Rimuovi
              </Button>
            </div>
          </div>
        </Panel>
        <div className="grid gap-4 sm:grid-cols-2">
          <Panel padding="lg" className="flex flex-col gap-4">
            <Label>CTA a tutta larghezza (mobile)</Label>
            <Button size="xl" fullWidth leftIcon="check">
              Conferma
            </Button>
            <Button size="lg" variant="secondary" fullWidth rightIcon="chevron-right">
              Prossimo round
            </Button>
          </Panel>
          <Panel padding="lg" className="flex flex-col gap-4">
            <Label>IconButton · tooltip · Kbd</Label>
            <div className="flex flex-wrap items-center gap-3">
              <IconButton icon="play" label="Riproduci tutto" variant="secondary" size="lg" shortcut="Spazio" />
              <IconButton icon="stop" label="Stop" size="lg" />
              <IconButton icon="copy" label="Copia link" />
              <IconButton icon="qr" label="Mostra QR" />
              <VolumeToggle />
              <IconButton icon="help" label="Come si gioca" variant="ghost" />
              <IconButton icon="settings" label="Impostazioni" size="sm" />
              <IconButton icon="x" label="Chiudi" size="sm" variant="danger" />
            </div>
            <p className="flex flex-wrap items-center gap-2 text-sm text-ink-300">
              Premi <Kbd>Spazio</Kbd> per ascoltare, <Kbd>←</Kbd>
              <Kbd>→</Kbd> per spostare, <Kbd>Invio</Kbd> per confermare.
            </p>
          </Panel>
        </div>
      </div>
    </Section>
  )
}

function VolumeToggle() {
  const [muted, setMuted] = useState(false)
  return <IconButton icon={muted ? 'mute' : 'volume'} label={muted ? 'Riattiva audio' : 'Silenzia'} active={muted} onClick={() => setMuted((m) => !m)} />
}

function IconsSection() {
  return (
    <Section id="sg-icons" kicker="04" title="Icone">
      <Panel padding="lg">
        <div className="grid grid-cols-4 gap-2 sm:grid-cols-8 lg:grid-cols-10">
          {ICON_NAMES.map((name) => (
            <div key={name} className="group flex flex-col items-center gap-2 rounded-2xl px-1 py-3 transition-colors hover:bg-white/5">
              <Icon name={name} size={24} className="text-ink-100 transition-colors group-hover:text-lime" />
              <span className="num w-full truncate text-center text-[10px] text-ink-400">{name}</span>
            </div>
          ))}
        </div>
      </Panel>
    </Section>
  )
}

const SURFACES = [
  { cls: 'glass-flat', text: 'Pannelli e card nel flusso, sopra lo sfondo. È il look di Panel.' },
  { cls: 'glass-dock', text: 'Dock e barre fisse sopra contenuti che scorrono: quasi opaco, nessun blur.' },
  { cls: 'glass', text: 'Vetro smerigliato vero (blur). Solo overlay brevi sopra contenuti: toast, popover.' },
] as const

function PanelsSection() {
  return (
    <Section id="sg-panels" kicker="05" title="Pannelli">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Panel>
          <Label>glass</Label>
          <p className="text-sm text-ink-300">Superficie di default: vetro scuro sopra lo shader, senza blur.</p>
        </Panel>
        <Panel variant="solid">
          <Label>solid</Label>
          <p className="text-sm text-ink-300">Opaco, per contenuti densi.</p>
        </Panel>
        <Panel variant="outline">
          <Label>outline</Label>
          <p className="text-sm text-ink-300">Solo bordo, per aree secondarie.</p>
        </Panel>
        <Panel>
          <Label>inset (annidato)</Label>
          <Panel variant="inset" padding="sm">
            <p className="text-sm text-ink-300">Pozzetto incassato.</p>
          </Panel>
        </Panel>
        <Panel glow="lime">
          <Label>glow lime</Label>
          <p className="text-sm text-ink-300">Risposta giusta, vincitore.</p>
        </Panel>
        <Panel glow="magenta">
          <Label>glow magenta</Label>
          <p className="text-sm text-ink-300">Momenti di brand.</p>
        </Panel>
        <Panel glow="gold">
          <Label>glow gold</Label>
          <p className="text-sm text-ink-300">Primo posto.</p>
        </Panel>
        <Panel interactive padding="sm" className="flex items-center gap-3" onClick={() => undefined}>
          <img src={COVER} alt="" className="size-14 rounded-xl object-cover shadow-lift" />
          <div className="min-w-0">
            <p className="truncate font-bold text-ink-50">00s Hits</p>
            <p className="text-xs text-ink-400">100 brani · Deezer</p>
          </div>
          <Icon name="chevron-right" className="ml-auto text-ink-400" />
        </Panel>
      </div>
      <div className="mt-8">
        <Label>Superfici vetro (classi CSS)</Label>
        <div className="grid gap-4 sm:grid-cols-3">
          {SURFACES.map((s) => (
            <div key={s.cls} className={cn(s.cls, 'relative rounded-panel p-5')}>
              <code className="num text-sm font-bold text-ink-50">.{s.cls}</code>
              <p className="mt-2 text-sm text-ink-300">{s.text}</p>
            </div>
          ))}
        </div>
        <p className="mt-3 text-xs text-ink-400">
          Il blur sopra lo shader si ricalcola a ogni frame: anche un solo elemento sfocato a schermo costa GPU (e batteria). Usalo solo per overlay brevi.
        </p>
      </div>
    </Section>
  )
}

function FieldsSection() {
  const [name, setName] = useState('DJ Pinguino')
  const [query, setQuery] = useState('')
  const [code, setCode] = useState('')
  const [codeState, setCodeState] = useState<'idle' | 'ok' | 'bad'>('idle')

  return (
    <Section id="sg-fields" kicker="06" title="Campi">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel padding="lg" className="flex flex-col gap-5">
          <Input label="Il tuo nome" value={name} maxLength={16} onChange={(e) => setName(e.target.value)} icon="user" placeholder="Come ti chiami?" />
          <Input
            label="Cerca playlist"
            icon="search"
            placeholder="Artista, genere, link Deezer…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            hint="Puoi anche incollare un link deezer.com/playlist/…"
            rightSlot={query ? <IconButton icon="x" label="Svuota" size="sm" variant="ghost" tooltip={false} onClick={() => setQuery('')} /> : null}
          />
          <Input label="Nome" defaultValue="" placeholder="Nome" error="Scegli un nome di almeno 1 carattere." />
        </Panel>
        <Panel padding="lg" className="flex flex-col items-center gap-5 text-center">
          <Label>Codice stanza</Label>
          <CodeInput
            value={code}
            invalid={codeState === 'bad'}
            onChange={(c) => {
              setCode(c)
              if (codeState !== 'idle') setCodeState('idle')
            }}
            onComplete={(c) => setCodeState(c === 'KXQPM' ? 'ok' : 'bad')}
          />
          <p className={cn('min-h-5 text-sm', codeState === 'bad' ? 'font-semibold text-coral' : codeState === 'ok' ? 'font-semibold text-lime' : 'text-ink-400')}>
            {codeState === 'bad' ? 'Stanza non trovata. Controlla il codice.' : codeState === 'ok' ? 'Stanza trovata!' : 'Prova KXQPM, oppure incolla un link …#/r/KXQPM'}
          </p>
          <Button variant="secondary" size="lg" fullWidth className="max-w-[372px]" disabled={code.length < 5} rightIcon="arrow-right">
            Entra
          </Button>
        </Panel>
      </div>
    </Section>
  )
}

function AvatarsSection() {
  const [me, setMe] = useState({ avatar: 7, color: 5 })
  return (
    <Section id="sg-avatars" kicker="07" title="Avatar">
      <div className="grid gap-4 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-4">
          <Panel padding="lg">
            <Label>Taglie</Label>
            <div className="flex flex-wrap items-end gap-4">
              <Avatar avatar={0} color={0} size="xs" name="Tommy" />
              <Avatar avatar={10} color={1} size="sm" name="Giulia" />
              <Avatar avatar={14} color={2} size="md" name="DJ Pinguino" />
              <Avatar avatar={3} color={3} size="lg" name="Marco" />
              <Avatar avatar={7} color={4} size="xl" name="Sofi" />
            </div>
          </Panel>
          <Panel padding="lg">
            <Label>Stati</Label>
            <div className="grid grid-cols-4 gap-y-6">
              {[
                { l: 'host', el: <Avatar avatar={0} color={0} size="lg" host name="Tommy" /> },
                { l: 'confermato', el: <Avatar avatar={10} color={1} size="lg" submitted name="Giulia" /> },
                { l: 'offline', el: <Avatar avatar={3} color={3} size="lg" connected={false} name="Marco" /> },
                { l: 'attivo', el: <Avatar avatar={14} color={2} size="lg" active name="DJ" /> },
                { l: 'online', el: <Avatar avatar={16} color={7} size="lg" showStatus name="Alien" /> },
                { l: '1º', el: <Avatar avatar={23} color={3} size="lg" rank={1} name="Re" /> },
                { l: '2º', el: <Avatar avatar={9} color={8} size="lg" rank={2} name="Robo" /> },
                { l: '3º', el: <Avatar avatar={12} color={6} size="lg" rank={3} name="Volpe" /> },
              ].map((x) => (
                <div key={x.l} className="flex flex-col items-center gap-2.5">
                  {x.el}
                  <span className="text-[11px] font-semibold text-ink-400">{x.l}</span>
                </div>
              ))}
            </div>
          </Panel>
          <Panel padding="lg" className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Label>Gruppo</Label>
              <AvatarGroup players={PLAYERS} max={5} size="sm" />
            </div>
            <AvatarGroup players={PLAYERS.slice(0, 3)} size="md" />
          </Panel>
        </div>
        <Panel padding="lg" className="flex flex-col gap-6">
          <div className="flex items-center gap-4">
            <Avatar avatar={me.avatar} color={me.color} size="xl" name="Tu" />
            <div>
              <p className="eyebrow">Anteprima</p>
              <p className="display display-skew mt-1 text-2xl">DJ Pinguino</p>
            </div>
          </div>
          <AvatarPicker avatar={me.avatar} color={me.color} onChange={setMe} />
        </Panel>
      </div>
    </Section>
  )
}

function ControlsSection() {
  const [rounds, setRounds] = useState(5)
  const [snippets, setSnippets] = useState(8)
  const [time, setTime] = useState(90)
  const [finalT, setFinalT] = useState(15)
  const [cats, setCats] = useState<string[]>(['Hit 2000'])
  return (
    <Section id="sg-controls" kicker="08" title="Controlli">
      <div className="grid gap-4 lg:grid-cols-2">
        <Panel padding="lg" className="flex flex-col gap-5">
          <div>
            <Label>Round</Label>
            <Segmented label="Numero di round" value={rounds} onChange={setRounds} options={SETTINGS_OPTIONS.rounds.map((v) => ({ value: v, label: v }))} />
          </div>
          <div>
            <Label>Spezzoni</Label>
            <Segmented
              label="Numero di spezzoni"
              value={snippets}
              onChange={setSnippets}
              options={SETTINGS_OPTIONS.snippets.map((v) => ({ value: v, label: v, sublabel: SNIPPET_DIFFICULTY[v] }))}
            />
          </div>
          <div>
            <Label>Tempo per round</Label>
            <Segmented label="Tempo per round" tone="cyan" value={time} onChange={setTime} options={SETTINGS_OPTIONS.roundTime.map((v) => ({ value: v, label: `${v}s` }))} />
          </div>
          <div>
            <Label>Timer finale · sola lettura</Label>
            <Segmented label="Timer finale" readOnly value={finalT} onChange={setFinalT} options={SETTINGS_OPTIONS.finalTimer.map((v) => ({ value: v, label: `${v}s` }))} />
          </div>
        </Panel>
        <Panel padding="lg" className="flex flex-col gap-6">
          <div>
            <Label>Chip categorie</Label>
            <div className="flex flex-wrap gap-2">
              {CATEGORIES.map((c) => (
                <Chip key={c} selected={cats.includes(c)} onClick={() => setCats((s) => (s.includes(c) ? s.filter((x) => x !== c) : [...s, c]))}>
                  {c}
                </Chip>
              ))}
              <Chip icon="search" tone="cyan">
                Cerca
              </Chip>
              <Chip leading="🔥" tone="magenta" selected>
                Top
              </Chip>
            </div>
          </div>
          <div>
            <Label>Badge</Label>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="gold" icon="crown">
                Host
              </Badge>
              <Badge tone="lime" icon="check">
                Confermato
              </Badge>
              <Badge tone="coral">Tempo scaduto</Badge>
              <Badge tone="magenta" dot>
                Live
              </Badge>
              <Badge tone="cyan">8 spezzoni</Badge>
              <Badge tone="violet">Round 3</Badge>
              <Badge>Spettatore</Badge>
              <Badge tone="lime" variant="solid" size="md" icon="star">
                Perfetto
              </Badge>
              <Badge tone="coral" variant="outline">
                Offline
              </Badge>
            </div>
          </div>
          <div>
            <Label>Tooltip (solo desktop)</Label>
            <Tooltip content="Il codice si copia negli appunti" shortcut="⌘C">
              <Button variant="glass" size="sm" leftIcon="copy">
                Passa sopra
              </Button>
            </Tooltip>
          </div>
        </Panel>
      </div>
    </Section>
  )
}

function useDemoTimer(totalMs: number) {
  const [endsAt, setEndsAt] = useState(() => Date.now() + totalMs)
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250)
    return () => window.clearInterval(id)
  }, [])
  return {
    remaining: Math.max(0, endsAt - now),
    restart: () => setEndsAt(Date.now() + totalMs),
    jump: (ms: number) => setEndsAt(Date.now() + ms),
  }
}

function TimersSection() {
  const TOTAL = 30_000
  const t = useDemoTimer(TOTAL)
  return (
    <Section id="sg-timers" kicker="09" title="Timer">
      <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
        <Panel padding="lg" className="flex flex-col gap-6">
          <div className="flex flex-wrap items-center justify-around gap-6">
            <TimerRing remainingMs={t.remaining} totalMs={TOTAL} size={132} caption="secondi" />
            <TimerRing remainingMs={t.remaining} totalMs={TOTAL} size={88} />
            <TimerRing remainingMs={t.remaining} totalMs={TOTAL} size={56} />
            <TimerRing remainingMs={75_000} totalMs={90_000} size={88} running={false} />
          </div>
          <div className="flex flex-wrap justify-center gap-3">
            <Button variant="glass" size="sm" leftIcon="refresh" onClick={t.restart}>
              Riavvia
            </Button>
            <Button variant="glass" size="sm" leftIcon="bolt" onClick={() => t.jump(8_000)}>
              Salta a 8s
            </Button>
          </div>
        </Panel>
        <Panel padding="lg" className="flex flex-col justify-center gap-6">
          <Label>TimerBar (HUD mobile)</Label>
          <TimerBar remainingMs={t.remaining} totalMs={TOTAL} />
          <TimerBar remainingMs={60_000} totalMs={90_000} running={false} />
          <TimerBar remainingMs={20_000} totalMs={90_000} running={false} size="sm" />
          <TimerBar remainingMs={6_000} totalMs={90_000} running={false} size="sm" />
        </Panel>
      </div>
    </Section>
  )
}

function FeedbackSection() {
  const [score, setScore] = useState(13_840)
  const [gain, setGain] = useState(0)
  const [round, setRound] = useState(2)
  const [spin, setSpin] = useState(true)
  const [modal, setModal] = useState(false)
  const [sheet, setSheet] = useState(false)
  const [toasts, setToasts] = useState<ToastViewItem[]>([])
  const nextId = useRef(1)

  const push = (t: Omit<ToastViewItem, 'id'>) => {
    const id = nextId.current++
    setToasts((s) => [...s, { ...t, id }])
    window.setTimeout(() => setToasts((s) => s.filter((x) => x.id !== id)), 4000)
  }

  return (
    <Section id="sg-feedback" kicker="10" title="Feedback">
      <div className="grid gap-4 lg:grid-cols-3">
        <Panel padding="lg" className="flex flex-col gap-5">
          <Label>Punti · progresso</Label>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="eyebrow">Totale</p>
              <AnimatedNumber value={score} className="text-4xl font-bold text-gold" />
            </div>
            {gain > 0 && <AnimatedNumber key={gain} value={gain} from={0} signed className="text-2xl font-bold text-lime" />}
          </div>
          <ProgressDots total={5} current={round} doneTone={(i) => (i === 0 ? 'gold' : 'lime')} />
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              leftIcon="plus"
              onClick={() => {
                const g = 1000 + Math.round(Math.random() * 4000)
                setGain(g)
                setScore((s) => s + g)
              }}
            >
              Punti
            </Button>
            <Button size="sm" variant="glass" onClick={() => setRound((r) => (r + 1) % 6)}>
              Round +1
            </Button>
          </div>
        </Panel>
        <Panel padding="lg" className="flex flex-col gap-5">
          <Label>Loader</Label>
          <div className="flex items-center justify-around gap-4">
            <Vinyl cover={COVER} size={120} spin={spin} arm />
            <div className="flex flex-col items-center gap-5">
              <Equalizer playing={spin} size={36} bars={6} />
              <Equalizer playing={spin} size={20} tone="lime" />
              <Spinner size={24} className="text-violet-bright" />
            </div>
          </div>
          <Button variant="glass" size="sm" leftIcon={spin ? 'pause' : 'play'} onClick={() => setSpin((s) => !s)}>
            {spin ? 'Pausa' : 'Riprendi'}
          </Button>
        </Panel>
        <Panel padding="lg" className="flex flex-col gap-3">
          <Label>Overlay · notifiche</Label>
          <Button variant="secondary" leftIcon="help" onClick={() => setModal(true)}>
            Come si gioca
          </Button>
          <Button variant="glass" leftIcon="settings" onClick={() => setSheet(true)}>
            Bottom sheet
          </Button>
          <div className="grid grid-cols-2 gap-2 pt-2">
            <Button size="sm" variant="glass" onClick={() => push({ tone: 'success', icon: '🎸', title: 'Giulia è in stanza', body: 'Ora siete in 5.' })}>
              Ingresso
            </Button>
            <Button size="sm" variant="glass" onClick={() => push({ tone: 'warning', icon: 'clock', title: 'Giulia ha confermato', body: '15 secondi per tutti gli altri!' })}>
              Conferma
            </Button>
            <Button size="sm" variant="glass" onClick={() => push({ tone: 'danger', title: 'Connessione persa', body: 'Riconnessione in corso…' })}>
              Errore
            </Button>
            <Button size="sm" variant="glass" onClick={() => push({ tone: 'accent', icon: '🔥', title: 'Tommy' })}>
              Reazione
            </Button>
          </div>
        </Panel>
      </div>

      <ToastViewport items={toasts} onDismiss={(id) => setToasts((s) => s.filter((t) => t.id !== id))} />

      <Modal
        open={modal}
        onClose={() => setModal(false)}
        title="Come si gioca"
        description="Tre passi, trenta secondi di musica, zero pietà."
        footer={
          <Button size="lg" onClick={() => setModal(false)} rightIcon="arrow-right">
            Ho capito
          </Button>
        }
      >
        <ol className="flex flex-col gap-4">
          {[
            { icon: 'scissors' as const, t: 'La hit è fatta a pezzi', d: 'Ogni round una canzone famosa viene tagliata in spezzoni a tempo e mescolata.' },
            { icon: 'shuffle' as const, t: 'Rimettila in ordine', d: 'Trascina i blocchi, tocca per ascoltarli, premi ▶ per sentire tutta la sequenza.' },
            { icon: 'bolt' as const, t: 'Conferma per primo', d: 'Quando qualcuno conferma, agli altri restano pochi secondi. Più sei preciso, più punti fai.' },
          ].map((s, i) => (
            <li key={s.t} className="flex gap-4">
              <span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-violet/20 text-violet-bright">
                <Icon name={s.icon} size={22} />
              </span>
              <div>
                <p className="font-extrabold text-ink-50">
                  <span className="num mr-2 text-magenta">{i + 1}</span>
                  {s.t}
                </p>
                <p className="mt-0.5 text-sm leading-relaxed text-ink-300">{s.d}</p>
              </div>
            </li>
          ))}
        </ol>
      </Modal>

      <Modal open={sheet} onClose={() => setSheet(false)} title="Impostazioni" presentation="sheet">
        <div className="flex flex-col gap-4 pb-2">
          <Segmented label="Numero di round" value={5} options={SETTINGS_OPTIONS.rounds.map((v) => ({ value: v, label: v }))} readOnly />
          <Input label="Il tuo nome" defaultValue="Tommy" maxLength={16} />
          <Button fullWidth size="lg" onClick={() => setSheet(false)}>
            Salva
          </Button>
        </div>
      </Modal>
    </Section>
  )
}

function HudSection() {
  const t = useDemoTimer(90_000)
  return (
    <Section id="sg-hud" kicker="11" title="HUD">
      <Panel padding="none" className="overflow-hidden">
        {/* Top bar */}
        <div className="flex items-center gap-3 border-b border-white/[0.07] px-4 py-3 sm:px-6 sm:py-4">
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="display display-skew text-lg leading-none sm:text-xl">
              Round <span className="text-lime">3</span>
              <span className="text-ink-400"> / 5</span>
            </span>
            <ProgressDots total={5} current={2} size="sm" />
          </div>
          <div className="mx-auto hidden sm:block">
            <TimerRing remainingMs={t.remaining} totalMs={90_000} size={72} />
          </div>
          <div className="ml-auto flex flex-col items-end">
            <span className="eyebrow">Punti</span>
            <AnimatedNumber value={13_840} className="text-xl font-bold text-gold sm:text-2xl" />
          </div>
        </div>
        <div className="px-4 pt-3 sm:hidden">
          <TimerBar remainingMs={t.remaining} totalMs={90_000} />
        </div>
        {/* Players strip */}
        <div className="no-scrollbar flex gap-4 overflow-x-auto px-4 py-4 sm:px-6">
          {PLAYERS.slice(0, 6).map((p, i) => (
            <div key={p.id} className="flex w-14 shrink-0 flex-col items-center gap-1.5">
              <Avatar {...p} size="md" active={i === 0} />
              <span className={cn('w-full truncate text-center text-[11px] font-bold', p.connected ? 'text-ink-200' : 'text-ink-500')}>{p.name}</span>
            </div>
          ))}
        </div>
        {/* Board stand-in */}
        <div className="grid grid-cols-2 gap-2.5 px-4 sm:grid-cols-4 sm:px-6">
          {[312, 22, 190, 95, 258, 140, 48, 5].map((h, i) => (
            <div
              key={h}
              className="relative flex h-20 items-center justify-center overflow-hidden rounded-block border border-white/15 sm:h-24"
              style={{
                background: `linear-gradient(160deg, hsl(${h} 95% 64%), hsl(${h} 85% 44%))`,
                boxShadow: `inset 0 1px 0 rgb(255 255 255 / 0.4), 0 4px 0 hsl(${h} 70% 28%), 0 10px 24px -10px hsl(${h} 90% 50%)`,
              }}
            >
              <span className="absolute inset-x-0 top-0 h-1/2 bg-linear-to-b from-white/25 to-transparent" />
              <span className="display relative text-2xl text-white/90 drop-shadow">{String.fromCharCode(65 + i)}</span>
            </div>
          ))}
        </div>
        {/* Transport + CTA */}
        <div className="flex items-center gap-3 px-4 pt-6 pb-5 sm:px-6">
          <IconButton icon="play" label="Riproduci tutto" variant="secondary" size="lg" shortcut="Spazio" />
          <Button size="lg" fullWidth leftIcon="check" className="sm:ml-auto sm:w-auto">
            Conferma
          </Button>
        </div>
      </Panel>
    </Section>
  )
}
