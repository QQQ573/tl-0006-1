import { Stem } from './Stem.js'
import { CONFIG } from '../config.js'

export class StemFactory {
  constructor(sceneManager, physicsWorld) {
    this.sceneManager = sceneManager
    this.physicsWorld = physicsWorld
    this.stems = []
    this.quality = 'high'
  }
  
  createStem(position, color) {
    const maxBodies = this._isMobile() 
      ? CONFIG.MOBILE_MAX_RIGID_BODIES 
      : CONFIG.DESKTOP_MAX_RIGID_BODIES
    
    if (this.stems.length >= maxBodies * 0.8) {
      console.warn('接近刚体数量上限，停止创建新花茎')
      return null
    }
    
    const stem = new Stem(this.sceneManager, this.physicsWorld, position, color)
    this.stems.push(stem)
    return stem
  }
  
  removeStem(stem) {
    const idx = this.stems.indexOf(stem)
    if (idx > -1) {
      this.stems.splice(idx, 1)
    }
    stem.dispose()
  }
  
  update() {
    for (const stem of this.stems) {
      stem.update()
    }
    
    this._cleanupFallen()
  }
  
  _cleanupFallen() {
    for (let i = this.stems.length - 1; i >= 0; i--) {
      const stem = this.stems[i]
      if (stem.body.position.y < -20) {
        this.removeStem(stem)
      }
    }
  }
  
  setQuality(level) {
    this.quality = level
  }
  
  _isMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || window.innerWidth < 768
  }
  
  getStemCount() {
    return this.stems.length
  }
}
