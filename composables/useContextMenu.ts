import { reactive } from 'vue'

export interface MenuItem {
  label?: string
  action?: () => void
  children?: MenuItem[]
  separator?: boolean
  disabled?: boolean
  /** default action, drawn bold like in Win98 */
  bold?: boolean
  /** radio-style bullet */
  checked?: boolean
}

const menu = reactive({
  open: false,
  x: 0,
  y: 0,
  items: [] as MenuItem[],
  /** bumps on every open so a re-open at a new spot re-runs positioning */
  seq: 0,
})

const openContextMenu = (x: number, y: number, items: MenuItem[]) => {
  menu.x = x
  menu.y = y
  menu.items = items
  menu.open = true
  menu.seq++
}

const closeContextMenu = () => {
  menu.open = false
}

export const useContextMenu = () => ({ menu, openContextMenu, closeContextMenu })
