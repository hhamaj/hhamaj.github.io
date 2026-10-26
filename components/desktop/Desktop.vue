<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import { useWindowManager } from '~/composables/useWindowManager'
import { useShell } from '~/composables/useShell'
import { useDevMode } from '~/composables/useDevMode'
import { useMsgBox } from '~/composables/useMsgBox'
import { useContextMenu, type MenuItem } from '~/composables/useContextMenu'
import { windowDefs, type WindowDef } from '~/data/windows'

const { isDesktop, open, launch } = useWindowManager()
const { runOpen, openRun, closeRun, jukeboxOpen, startMenuOpen, closeStartMenu, booting } =
  useShell()
const { msgBox, confirmBox } = useMsgBox()
const { openContextMenu } = useContextMenu()

useDevMode()

/* ---------------- desktop icons: arrange + refresh ---------------- */

type IconSort = 'default' | 'name' | 'type'
const iconSort = ref<IconSort>('default')
const refreshing = ref(false)

const iconDefs = computed(() => {
  if (iconSort.value === 'default') return windowDefs
  const key = (d: WindowDef) => (iconSort.value === 'name' ? d.label : `${d.icon} ${d.label}`)
  return [...windowDefs].sort((a, b) => key(a).localeCompare(key(b)))
})

const refresh = () => {
  refreshing.value = true
  setTimeout(() => (refreshing.value = false), 120)
}

/* ---------------- right-click menus ---------------- */

const readOnly = () =>
  msgBox({
    title: 'Desktop',
    icon: 'warn',
    message: 'This desktop is read-only.\nhamza keeps it tidy on purpose.',
  })

const desktopMenu = (): MenuItem[] => [
  {
    label: 'Arrange Icons',
    children: [
      { label: 'by Name', checked: iconSort.value === 'name', action: () => (iconSort.value = 'name') },
      { label: 'by Type', checked: iconSort.value === 'type', action: () => (iconSort.value = 'type') },
      {
        label: 'Original Order',
        checked: iconSort.value === 'default',
        action: () => (iconSort.value = 'default'),
      },
    ],
  },
  { label: 'Refresh', action: refresh },
  { separator: true },
  { label: 'Paste', disabled: true },
  { label: 'Paste Shortcut', disabled: true },
  { separator: true },
  {
    label: 'New',
    children: [
      { label: 'Folder', action: readOnly },
      { label: 'Shortcut', action: readOnly },
      { separator: true },
      { label: 'Text Document', action: readOnly },
    ],
  },
  { separator: true },
  { label: 'Open Terminal Here', action: () => open('terminal') },
  { label: 'Run...', action: openRun },
  { separator: true },
  {
    label: 'Properties',
    action: () =>
      msgBox({
        title: 'Display Properties',
        message: [
          `Screen area: ${window.innerWidth} x ${window.innerHeight} pixels`,
          'Colors: True Color (32 bit)',
          'Wallpaper: (None) — teal, as nature intended',
          'Screen Saver: (None)',
        ].join('\n'),
      }),
  },
]

const iconMenu = (def: WindowDef): MenuItem[] => [
  { label: 'Open', bold: true, action: () => launch(def.id) },
  { separator: true },
  {
    label: 'Rename',
    action: () =>
      msgBox({
        title: 'Rename',
        icon: 'warn',
        message: `Cannot rename ${def.label}: hamza is attached to the name.`,
      }),
  },
  {
    label: 'Delete',
    action: async () => {
      const yes = await confirmBox({
        title: 'Confirm File Delete',
        message: `Are you sure you want to send '${def.label}' to the Recycle Bin?`,
      })
      if (!yes) return
      msgBox({
        title: 'Error Deleting File',
        icon: 'error',
        message: `Cannot delete ${def.label}: Access is denied.\n\nMake sure the file is not currently in use.\n(it is. it's load-bearing.)`,
      })
    },
  },
  { separator: true },
  {
    label: 'Properties',
    action: () =>
      msgBox({
        title: `${def.label} Properties`,
        message: [
          'Type: Application',
          'Location: C:\\HAMZA\\DESKTOP',
          `Size: ${(def.w * def.h) >> 10} KB`,
          'Attributes: Read-only, Hand-made',
        ].join('\n'),
      }),
  },
]

const onContextMenu = (event: MouseEvent) => {
  if (!isDesktop.value) return
  const target = event.target as HTMLElement
  const icon = target.closest<HTMLElement>('[data-icon-id]')
  if (icon) {
    const def = windowDefs.find((d) => d.id === icon.dataset.iconId)
    if (!def) return
    event.preventDefault()
    icon.focus()
    openContextMenu(event.clientX, event.clientY, iconMenu(def))
    return
  }
  // only the bare wallpaper gets the desktop menu; windows keep the native one
  if (target === event.currentTarget || target.closest('[data-desktop-icons]')) {
    event.preventDefault()
    openContextMenu(event.clientX, event.clientY, desktopMenu())
  }
}

/* ---------------- startup (after the boot screen) ---------------- */

let mounted = false
let started = false

const startup = () => {
  if (!mounted || started) return
  started = true
  if (isDesktop.value) {
    open('sysinfo')
    jukeboxOpen.value = true
  }
}

watch(booting, (now) => {
  if (!now) startup()
})

const onKeydown = (event: KeyboardEvent) => {
  const target = event.target as HTMLElement | null
  const inField =
    target &&
    (target.tagName === 'INPUT' ||
      target.tagName === 'TEXTAREA' ||
      target.isContentEditable)

  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
    event.preventDefault()
    if (runOpen.value) closeRun()
    else openRun()
    return
  }

  if (event.key === '/' && !inField) {
    event.preventDefault()
    openRun()
    return
  }

  if (event.key === 'Escape') {
    if (startMenuOpen.value) closeStartMenu()
  }
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  open('welcome')
  mounted = true
  if (!booting.value) startup()
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
})
</script>

<template>
  <div class="relative flex h-[100dvh] w-full flex-col overflow-hidden">
    <!-- workspace (wallpaper comes from body) -->
    <main
      class="relative min-h-0 flex-1"
      :class="isDesktop ? 'overflow-hidden' : 'overflow-y-auto overflow-x-hidden'"
      @contextmenu="onContextMenu"
    >
      <!-- desktop icons -->
      <div
        v-if="isDesktop"
        data-desktop-icons
        class="absolute left-1 top-1 bottom-2 z-0 flex flex-col flex-wrap content-start gap-y-1"
        :class="refreshing && 'invisible'"
        aria-label="Desktop icons"
      >
        <DesktopIcon
          v-for="def in iconDefs"
          :key="def.id"
          :id="def.id"
          :label="def.label"
          :icon="def.icon"
        />
      </div>

      <!-- mobile icon grid -->
      <div
        v-else
        class="grid grid-cols-4 gap-1 p-2 sm:grid-cols-6"
        aria-label="Apps"
      >
        <DesktopIcon
          v-for="def in windowDefs"
          :key="def.id"
          :id="def.id"
          :label="def.label"
          :icon="def.icon"
        />
      </div>

      <!-- windows: overlaid on desktop, stacked on mobile -->
      <div
        :class="
          isDesktop
            ? 'pointer-events-none absolute inset-0 z-10 overflow-hidden'
            : 'relative z-10 space-y-3 px-2 pb-6'
        "
      >
        <WinWindow id="welcome"><WelcomeWindow /></WinWindow>
        <WinWindow id="about"><AboutWindow /></WinWindow>
        <WinWindow id="projects"><ProjectsWindow /></WinWindow>
        <WinWindow id="currently"><CurrentlyWindow /></WinWindow>
        <WinWindow id="guestbook"><GuestbookWindow /></WinWindow>
        <WinWindow id="links"><LinksWindow /></WinWindow>
        <WinWindow id="sysinfo"><SysInfoWindow /></WinWindow>
        <WinWindow id="activity"><ActivityWindow /></WinWindow>
        <WinWindow id="terminal"><TerminalWindow /></WinWindow>
      </div>

      <!-- desktop-only companions -->
      <template v-if="isDesktop">
        <PixelPet />
        <MusicPlayer />
      </template>
    </main>

    <Taskbar class="relative z-[9600]" />
    <StartMenu />

    <RunDialog />
    <MsgBox />
    <ShutdownFlow />
    <ContextMenu />
    <BootScreen />
  </div>
</template>
