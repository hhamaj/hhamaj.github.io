<script setup lang="ts">
import { nextTick, onMounted, onUnmounted, reactive, ref, watch } from 'vue'
import { useContextMenu, type MenuItem } from '~/composables/useContextMenu'

const { menu, closeContextMenu } = useContextMenu()

const root = ref<HTMLElement | null>(null)
const subOpen = ref<number | null>(null)
const pos = reactive({ x: 0, y: 0 })
/** open submenus to the left when there is no room on the right */
const flipSub = ref(false)

const itemsOf = (list: HTMLElement | null) =>
  list
    ? Array.from(list.querySelectorAll<HTMLElement>(':scope > div > [role="menuitem"]'))
    : []

const focusFirst = (list: HTMLElement | null) => {
  const items = itemsOf(list)
  ;(items.find((el) => el.getAttribute('aria-disabled') !== 'true') ?? items[0])?.focus()
}

watch(
  () => menu.seq,
  async () => {
    subOpen.value = null
    pos.x = menu.x
    pos.y = menu.y
    await nextTick()
    const el = root.value
    if (!el) return
    const r = el.getBoundingClientRect()
    pos.x = Math.max(0, Math.min(menu.x, window.innerWidth - r.width - 2))
    pos.y = Math.max(0, Math.min(menu.y, window.innerHeight - r.height - 2))
    flipSub.value = pos.x + r.width + 180 > window.innerWidth
    focusFirst(el)
  }
)

const run = async (item: MenuItem, index: number | null, event: MouseEvent) => {
  if (item.disabled) return
  if (item.children && index !== null) {
    subOpen.value = index
    // keyboard activation moves into the submenu; mouse just opens it
    if (event.detail === 0) {
      await nextTick()
      focusFirst((event.currentTarget as HTMLElement)?.nextElementSibling as HTMLElement | null)
    }
    return
  }
  closeContextMenu()
  item.action?.()
}

const hover = (event: MouseEvent, index: number | null) => {
  ;(event.currentTarget as HTMLElement).focus()
  if (index !== null) subOpen.value = menu.items[index]?.children ? index : null
}

const onKeydown = (event: KeyboardEvent) => {
  const current = document.activeElement as HTMLElement | null
  const list = current?.closest<HTMLElement>('[role="menu"]') ?? root.value
  const items = itemsOf(list)
  const i = current ? items.indexOf(current) : -1
  const inSub = list !== root.value

  switch (event.key) {
    case 'ArrowDown':
    case 'ArrowUp': {
      event.preventDefault()
      if (!items.length) return
      const step = event.key === 'ArrowDown' ? 1 : -1
      items[(i + step + items.length) % items.length]?.focus()
      break
    }
    case 'ArrowRight':
      if (!inSub && current?.getAttribute('aria-haspopup')) {
        event.preventDefault()
        current.click()
      }
      break
    case 'ArrowLeft':
      if (inSub) {
        event.preventDefault()
        const parent = list?.previousElementSibling as HTMLElement | null
        subOpen.value = null
        parent?.focus()
      }
      break
    case 'Escape':
      event.preventDefault()
      event.stopPropagation()
      if (inSub) {
        const parent = list?.previousElementSibling as HTMLElement | null
        subOpen.value = null
        parent?.focus()
      } else {
        closeContextMenu()
      }
      break
    case 'Tab':
      event.preventDefault()
      closeContextMenu()
      break
  }
}

const onDocPointerDown = (event: PointerEvent) => {
  if (!menu.open) return
  if ((event.target as HTMLElement).closest('[data-context-menu]')) return
  closeContextMenu()
}

onMounted(() => {
  document.addEventListener('pointerdown', onDocPointerDown, true)
  window.addEventListener('blur', closeContextMenu)
  window.addEventListener('resize', closeContextMenu)
})

onUnmounted(() => {
  document.removeEventListener('pointerdown', onDocPointerDown, true)
  window.removeEventListener('blur', closeContextMenu)
  window.removeEventListener('resize', closeContextMenu)
})
</script>

<template>
  <div
    v-if="menu.open"
    ref="root"
    data-context-menu
    role="menu"
    aria-label="Context menu"
    class="fixed z-[9700] min-w-[172px] bg-win-gray bevel-out hard-shadow-sm p-[2px]"
    :style="{ left: `${pos.x}px`, top: `${pos.y}px` }"
    @keydown="onKeydown"
    @contextmenu.prevent
  >
    <template v-for="(item, i) in menu.items" :key="i">
      <div v-if="item.separator" class="ctx-sep" role="separator" />
      <div v-else class="relative">
        <button
          type="button"
          role="menuitem"
          class="ctx-item"
          :aria-haspopup="item.children ? 'menu' : undefined"
          :aria-expanded="item.children ? subOpen === i : undefined"
          :aria-disabled="item.disabled || undefined"
          :data-open="subOpen === i"
          @mouseenter="hover($event, i)"
          @click="run(item, i, $event)"
        >
          <span class="w-3 shrink-0 text-center" aria-hidden="true">{{ item.checked ? '•' : '' }}</span>
          <span class="flex-1" :class="item.bold && 'font-bold'">{{ item.label }}</span>
          <span v-if="item.children" class="ml-4 text-[8px]" aria-hidden="true">▶</span>
        </button>

        <div
          v-if="item.children && subOpen === i"
          role="menu"
          :aria-label="item.label"
          class="absolute top-[-3px] min-w-[150px] bg-win-gray bevel-out hard-shadow-sm p-[2px]"
          :class="flipSub ? 'right-full' : 'left-full'"
        >
          <template v-for="(child, j) in item.children" :key="j">
            <div v-if="child.separator" class="ctx-sep" role="separator" />
            <div v-else>
              <button
                type="button"
                role="menuitem"
                class="ctx-item"
                :aria-disabled="child.disabled || undefined"
                @mouseenter="hover($event, null)"
                @click="run(child, null, $event)"
              >
                <span class="w-3 shrink-0 text-center" aria-hidden="true">{{ child.checked ? '•' : '' }}</span>
                <span class="flex-1" :class="child.bold && 'font-bold'">{{ child.label }}</span>
              </button>
            </div>
          </template>
        </div>
      </div>
    </template>
  </div>
</template>
