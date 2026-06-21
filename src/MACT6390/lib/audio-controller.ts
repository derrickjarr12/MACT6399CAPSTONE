import { COURSE } from "./course-config"
import { TRACK_SECONDS } from "./feature-types"

// Authoritative clock for the whole experience. When a real <audio> element is
// attached and ready, its currentTime drives everything. If the WAV is missing,
// a fallback timer advances so the ride still works for development/preview.
export class AudioController {
  private el: HTMLAudioElement | null = null
  private fallbackTime = 0
  private fallbackPlaying = false

  hasAudio = false
  duration = TRACK_SECONDS
  rate = 1

  attach(el: HTMLAudioElement | null) {
    this.el = el
    if (el) {
      this.hasAudio = !!el.src && !Number.isNaN(el.duration)
      el.playbackRate = this.rate
    }
  }

  setReady(duration: number) {
    this.hasAudio = true
    if (Number.isFinite(duration) && duration > 0) this.duration = duration
  }

  get time(): number {
    if (this.el && this.hasAudio) return this.el.currentTime
    return this.fallbackTime
  }

  get playing(): boolean {
    if (this.el && this.hasAudio) return !this.el.paused && !this.el.ended
    return this.fallbackPlaying
  }

  get ended(): boolean {
    return this.time >= this.duration - 0.02
  }

  async play() {
    if (this.el && this.hasAudio) {
      try {
        await this.el.play()
        return
      } catch {
        // autoplay blocked / no source -> fall back
      }
    }
    this.fallbackPlaying = true
  }

  pause() {
    if (this.el && this.hasAudio) this.el.pause()
    this.fallbackPlaying = false
  }

  setRate(rate: number) {
    const ladder = COURSE.rateLadder
    const r = Math.min(ladder[ladder.length - 1], Math.max(ladder[0], rate))
    this.rate = r
    if (this.el) this.el.playbackRate = r
  }

  // Step along the fixed rate ladder so 1.00x is always reachable. We snap the
  // current rate to the nearest ladder index first, then move by `dir`.
  stepRate(dir: 1 | -1) {
    const ladder = COURSE.rateLadder
    let nearest = 0
    for (let i = 1; i < ladder.length; i++) {
      if (Math.abs(ladder[i] - this.rate) < Math.abs(ladder[nearest] - this.rate)) {
        nearest = i
      }
    }
    const next = Math.min(ladder.length - 1, Math.max(0, nearest + dir))
    this.setRate(ladder[next])
  }

  // Advance the fallback clock when no real audio is present.
  tick(delta: number) {
    if ((!this.el || !this.hasAudio) && this.fallbackPlaying) {
      this.fallbackTime = Math.min(this.duration, this.fallbackTime + delta * this.rate)
      if (this.fallbackTime >= this.duration) this.fallbackPlaying = false
    }
  }

  reset() {
    this.fallbackTime = 0
    this.fallbackPlaying = false
    this.rate = COURSE.defaultRate
    if (this.el && this.hasAudio) {
      this.el.currentTime = 0
      this.el.playbackRate = COURSE.defaultRate
    }
  }
}
