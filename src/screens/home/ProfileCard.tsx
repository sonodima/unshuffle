// "Who am I" row on Home: avatar (opens the picker sheet) + nickname field
// with a random-name die. Edits are committed live; the field keeps its own
// draft so typing a space or clearing it never fights the sanitized store value.
import { useEffect, useRef, useState } from 'react'
import { MAX_NAME_LENGTH } from '../../game/constants'
import { randomPlayerName, sanitizeName } from '../../game/names'
import type { PlayerProfile } from '../../game/types'
import { useT } from '../../i18n/react'
import { Avatar, AvatarPicker, Button, Icon, IconButton, Input, Modal, cn, playSfx, playerColor } from '../../components/ui'

export type ProfilePatch = Partial<Omit<PlayerProfile, 'id'>>

interface ProfileCardProps {
  profile: PlayerProfile
  onChange(patch: ProfilePatch): void
  disabled?: boolean
  className?: string
}

export function ProfileCard({ profile, onChange, disabled = false, className }: ProfileCardProps) {
  const t = useT()
  const [draft, setDraft] = useState(profile.name)
  const [pickerOpen, setPickerOpen] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const editing = useRef(false)

  // Adopt outside changes (random name, another tab) unless the user is typing.
  useEffect(() => {
    if (!editing.current) setDraft(profile.name)
  }, [profile.name])

  const commit = (raw: string) => {
    const clean = sanitizeName(raw)
    if (clean && clean !== profile.name) onChange({ name: clean })
    return clean
  }

  const randomName = () => {
    let next = randomPlayerName()
    for (let i = 0; i < 5 && next === profile.name; i++) next = randomPlayerName()
    playSfx('pop')
    setDraft(next)
    onChange({ name: next })
  }

  const color = playerColor(profile.color)

  return (
    <div className={cn('flex items-end gap-3 sm:gap-4', className)}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => {
          playSfx('pop')
          setPickerOpen(true)
        }}
        aria-label={t('home.profile.changeAvatar')}
        className="group relative isolate shrink-0 rounded-full tap-none transition-transform duration-200 ease-[var(--ease-spring)] hover:scale-105 active:scale-95 disabled:opacity-60 disabled:hover:scale-100"
      >
        <Avatar avatar={profile.avatar} color={profile.color} size="lg" />
        <span
          aria-hidden
          className="absolute -right-1 -bottom-1 grid size-7 place-items-center rounded-full border-2 border-ink-900 bg-ink-50 text-ink-950 shadow-[0_4px_10px_-2px_rgb(0_0_0/0.6)] transition-transform duration-200 group-hover:rotate-12"
        >
          <Icon name="pencil" size={13} strokeWidth={2.6} />
        </span>
        <span
          aria-hidden
          className="pointer-events-none absolute -inset-2 -z-10 rounded-full opacity-60 blur-xl transition-opacity group-hover:opacity-90"
          style={{ background: color }}
        />
      </button>

      <Input
        ref={inputRef}
        label={t('home.profile.nameLabel')}
        value={draft}
        maxLength={MAX_NAME_LENGTH}
        showCount={false}
        disabled={disabled}
        autoComplete="nickname"
        autoCapitalize="words"
        autoCorrect="off"
        spellCheck={false}
        enterKeyHint="done"
        placeholder={t('home.profile.namePlaceholder')}
        containerClassName="min-w-0 flex-1"
        onFocus={() => {
          editing.current = true
        }}
        onChange={(e) => {
          setDraft(e.target.value)
          commit(e.target.value)
        }}
        onBlur={() => {
          editing.current = false
          setDraft(commit(draft) || profile.name)
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') inputRef.current?.blur()
        }}
        rightSlot={
          <IconButton
            icon="dice"
            label={t('home.profile.randomName')}
            variant="ghost"
            size="sm"
            sound={false}
            disabled={disabled}
            onClick={randomName}
            tooltipSide="top"
          />
        }
      />

      <Modal
        open={pickerOpen}
        onClose={() => setPickerOpen(false)}
        title={t('home.profile.lookTitle')}
        description={t('home.profile.lookDescription')}
        size="md"
        footer={
          <Button variant="primary" size="lg" onClick={() => setPickerOpen(false)} rightIcon="check">
            {t('home.profile.done')}
          </Button>
        }
      >
        <div className="mb-5 flex items-center gap-4 rounded-3xl border border-white/[0.06] bg-ink-950/40 p-3.5 shadow-well sm:p-4">
          <Avatar avatar={profile.avatar} color={profile.color} size="lg" active className="sm:scale-110" />
          <div className="min-w-0">
            <p className="eyebrow">{t('home.profile.preview')}</p>
            <p className="display display-skew mt-1.5 truncate text-xl text-ink-50">{sanitizeName(draft) || profile.name}</p>
          </div>
        </div>
        <AvatarPicker avatar={profile.avatar} color={profile.color} onChange={(next) => onChange(next)} />
      </Modal>
    </div>
  )
}
