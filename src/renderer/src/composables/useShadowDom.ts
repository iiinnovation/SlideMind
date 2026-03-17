import { ref, watch, onBeforeUnmount } from 'vue'

/**
 * Manages a Shadow DOM for isolated slide rendering.
 * Provides incremental CSS and HTML updates without full document rebuilds.
 */
export function useShadowDom() {
  const hostRef = ref<HTMLElement | null>(null)
  const contentHeight = ref(720)

  let shadowRoot: ShadowRoot | null = null
  let resetStyleEl: HTMLStyleElement | null = null
  let marpStyleEl: HTMLStyleElement | null = null
  let slideContainer: HTMLDivElement | null = null

  // Pending state for updates before shadow root is initialized
  let pendingCSS: string | null = null
  let pendingSlideHTML: string | null = null
  let currentSlideHTML = ''

  function initShadow(host: HTMLElement) {
    shadowRoot = host.attachShadow({ mode: 'open' })

    // Reset style: isolate from host page styles
    resetStyleEl = document.createElement('style')
    resetStyleEl.textContent = `
:host {
  all: initial;
  contain: content;
  display: block;
  width: 1280px;
  height: var(--slide-preview-height, 720px);
}
.slide-container {
  width: 1280px;
  min-height: var(--slide-preview-height, 720px);
  position: relative;
  overflow: hidden;
}
.slide-container > section {
  width: 1280px;
  min-height: var(--slide-preview-height, 720px);
  overflow: hidden;
}
.slide-container > section.preview-flow {
  min-height: 0;
  height: auto;
}
`
    shadowRoot.appendChild(resetStyleEl)

    // Marp CSS style element
    marpStyleEl = document.createElement('style')
    shadowRoot.appendChild(marpStyleEl)

    // Slide container
    slideContainer = document.createElement('div')
    slideContainer.className = 'slide-container'
    shadowRoot.appendChild(slideContainer)

    // Apply any pending updates
    if (pendingCSS !== null) {
      marpStyleEl.textContent = pendingCSS
      pendingCSS = null
    }
    if (pendingSlideHTML !== null) {
      slideContainer.innerHTML = pendingSlideHTML
      currentSlideHTML = pendingSlideHTML
      pendingSlideHTML = null
    }
  }

  function updateCSS(css: string) {
    if (!marpStyleEl) {
      pendingCSS = css
      return
    }
    if (marpStyleEl.textContent !== css) {
      marpStyleEl.textContent = css
      queueMeasure()
    }
  }

  function updateSlide(slideHTML: string) {
    if (!slideContainer) {
      pendingSlideHTML = slideHTML
      return
    }
    if (slideHTML !== currentSlideHTML) {
      slideContainer.innerHTML = slideHTML
      currentSlideHTML = slideHTML
      queueMeasure()
    }
  }

  function clear() {
    if (slideContainer) {
      slideContainer.innerHTML = ''
      currentSlideHTML = ''
    }
    pendingSlideHTML = null
    contentHeight.value = 720
  }

  function queueMeasure() {
    requestAnimationFrame(() => {
      if (!slideContainer) return
      const section = slideContainer.querySelector('section') as HTMLElement | null
      if (!section) {
        contentHeight.value = 720
        return
      }
      const measured = Math.ceil(section.scrollHeight || section.getBoundingClientRect().height || 720)
      contentHeight.value = Math.max(1, measured)
    })
  }

  // Watch for host element mounting
  watch(hostRef, (host) => {
    if (host && !shadowRoot) {
      initShadow(host)
    }
  })

  onBeforeUnmount(() => {
    shadowRoot = null
    resetStyleEl = null
    marpStyleEl = null
    slideContainer = null
    pendingCSS = null
    pendingSlideHTML = null
    currentSlideHTML = ''
    contentHeight.value = 720
  })

  return {
    hostRef,
    contentHeight,
    updateCSS,
    updateSlide,
    clear
  }
}
