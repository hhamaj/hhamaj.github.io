<script setup lang="ts">
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { useShell } from '~/composables/useShell'

/** sessionStorage key; also mirrored as `html.booted` by the inline head script in nuxt.config */
const BOOTED_KEY = 'hamza98:booted'

const biosLines = [
  'HamzaBIOS v4.98   (C) 1998-2026 hamza corp.',
  '',
  'CPU     : Curiosity-class processor @ 3.14 GHz',
  'Memory  : 640K OK (ought to be enough for anybody)',
  'Drive 0 : RUST_SSD        Drive 1 : C_LEGACY.HDD',
  'Coffee  : detected, 1 mug, half full',
  '',
  'Booting from C:\\HAMZA ...',
]

const { booting, finishBoot } = useShell()

const phase = ref<'bios' | 'splash'>('bios')
const shownLines = ref(0)

let timers: ReturnType<typeof setTimeout>[] = []

const clearTimers = () => {
  timers.forEach(clearTimeout)
  timers = []
}

const later = (ms: number, fn: () => void) => {
  timers.push(setTimeout(fn, ms))
}

const finish = () => {
  if (!booting.value) return
  clearTimers()
  try {
    sessionStorage.setItem(BOOTED_KEY, '1')
  } catch {}
  finishBoot()
}

const run = () => {
  clearTimers()
  document.documentElement.classList.remove('booted')
  phase.value = 'bios'
  shownLines.value = 0

  let t = 250
  biosLines.forEach((_, i) => {
    later(t, () => (shownLines.value = i + 1))
    t += 140
  })
  t += 450
  later(t, () => (phase.value = 'splash'))
  later(t + 1900, finish)
}

const onKeydown = (event: KeyboardEvent) => {
  if (!booting.value) return
  event.preventDefault()
  event.stopPropagation()
  finish()
}

watch(booting, (now) => {
  if (now) run()
})

onMounted(() => {
  window.addEventListener('keydown', onKeydown, true)
  let seen = false
  try {
    seen = sessionStorage.getItem(BOOTED_KEY) === '1'
  } catch {}
  if (seen) finishBoot()
  else run()
})

onUnmounted(() => {
  clearTimers()
  window.removeEventListener('keydown', onKeydown, true)
})
</script>

<template>
  <div
    v-if="booting"
    class="boot-screen fixed inset-0 z-[10000] cursor-wait select-none overflow-hidden bg-black"
    role="status"
    aria-live="polite"
    aria-label="Starting Hamza 98. Press any key to skip."
    @click="finish"
  >
    <!-- POST screen -->
    <div v-if="phase === 'bios'" class="h-full p-5 font-vt text-[20px] leading-snug text-[#c0c0c0] sm:p-8">
      <div class="flex items-start justify-between gap-4">
        <div>
          <p v-for="(line, i) in biosLines.slice(0, shownLines)" :key="i" class="min-h-[1.375em] whitespace-pre">{{ line }}</p>
          <span class="animate-blink inline-block">_</span>
        </div>
        <div class="hidden shrink-0 text-right sm:block" aria-hidden="true">
          <p class="font-pixel text-[14px] leading-tight text-acc-lime">hamza</p>
          <p class="font-pixel text-[10px] leading-tight text-[#5a5a5a]">energy star-ish</p>
        </div>
      </div>
      <p class="absolute bottom-5 left-5 right-5 text-[#808080] sm:bottom-8 sm:left-8">
        Press DEL to enter SETUP (there is no setup) · any key or click to skip
      </p>
    </div>

    <!-- splash -->
    <div v-else class="boot-sky flex h-full flex-col items-center justify-center">
      <div class="flex items-center gap-4">
        <PixelIcon name="flag" class="h-16 w-16 sm:h-20 sm:w-20" />
        <p class="font-ui text-[44px] font-bold italic leading-none text-white [text-shadow:2px_2px_0_#000080] sm:text-[56px]">
          Hamza<sup class="ml-1 text-[0.5em] not-italic text-acc-orange [text-shadow:1px_1px_0_#000]">98</sup>
        </p>
      </div>
      <p class="mt-4 font-vt text-[22px] text-[#000080]">starting up...</p>
      <div class="boot-bar absolute bottom-0 left-0 right-0 h-3" aria-hidden="true" />
    </div>
  </div>
</template>

<style scoped>
.boot-sky {
  background:
    radial-gradient(ellipse 22% 9% at 18% 22%, rgba(255, 255, 255, 0.85), transparent 70%),
    radial-gradient(ellipse 28% 10% at 76% 16%, rgba(255, 255, 255, 0.75), transparent 70%),
    radial-gradient(ellipse 30% 11% at 62% 78%, rgba(255, 255, 255, 0.8), transparent 70%),
    radial-gradient(ellipse 18% 8% at 12% 70%, rgba(255, 255, 255, 0.7), transparent 70%),
    linear-gradient(180deg, #3d7bd6 0%, #8db8ee 70%, #b9d4f5 100%);
}

.boot-bar {
  background: linear-gradient(
    90deg,
    #000080,
    #1084d0,
    #00e5ff,
    #ff69b4,
    #ff7a00,
    #000080
  );
  background-size: 50% 100%;
  animation: boot-bar 1.1s linear infinite;
}

@keyframes boot-bar {
  from {
    background-position: 0 0;
  }
  to {
    background-position: 100% 0;
  }
}
</style>
