export class PerformanceMonitor {
  constructor() {
    this._lastTime = performance.now()
    this._delta = 0
    this._fps = 60
    this._fpsHistory = []
    this._historyLength = 60
    
    this._frameCount = 0
    this._fpsUpdateTime = 0
    
    this._isMobile = this._detectMobile()
    this._targetFPS = this._isMobile ? 30 : 60
    this._lowFPSTime = 0
    this._shouldScaleDown = false
  }
  
  _detectMobile() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || window.innerWidth < 768
  }
  
  getDelta() {
    const now = performance.now()
    this._delta = (now - this._lastTime) / 1000
    this._lastTime = now
    return this._delta
  }
  
  update() {
    this._frameCount++
    const now = performance.now()
    
    if (now - this._fpsUpdateTime >= 1000) {
      this._fps = this._frameCount
      this._frameCount = 0
      this._fpsUpdateTime = now
      
      this._fpsHistory.push(this._fps)
      if (this._fpsHistory.length > this._historyLength) {
        this._fpsHistory.shift()
      }
      
      const avgFPS = this._fpsHistory.reduce((a, b) => a + b, 0) / this._fpsHistory.length
      
      if (avgFPS < this._targetFPS * 0.7) {
        this._lowFPSTime++
        if (this._lowFPSTime >= 3) {
          this._shouldScaleDown = true
        }
      } else {
        this._lowFPSTime = Math.max(0, this._lowFPSTime - 0.5)
      }
    }
  }
  
  shouldScaleDown() {
    return this._shouldScaleDown
  }
  
  getFPS() {
    return this._fps
  }
  
  isMobile() {
    return this._isMobile
  }
  
  resetScaleDown() {
    this._shouldScaleDown = false
    this._lowFPSTime = 0
  }
}
