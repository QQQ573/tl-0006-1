import { CONFIG } from '../config.js'

export class ScoringSystem {
  constructor() {
    this._listeners = {}
    
    this.reset()
  }
  
  on(event, callback) {
    if (!this._listeners[event]) this._listeners[event] = []
    this._listeners[event].push(callback)
  }
  
  _emit(event, data) {
    if (this._listeners[event]) {
      for (const cb of this._listeners[event]) cb(data)
    }
  }
  
  reset() {
    this.startTime = null
    this.endTime = null
    this.totalTime = 0
    
    this.uniformityScore = 0
    this.bindForceScore = 0
    this.stemCountScore = 0
    this.timeScore = 0
    
    this.insertCount = 0
    this.insertAngles = []
    this.breakCount = 0
    this.scatterHappened = false
    
    this.bindForceMin = Infinity
    this.bindForceMax = -Infinity
    this.bindForceFinal = 0
    
    this.finalScore = 0
    this.grade = 'C'
    
    this.isComplete = false
  }
  
  start() {
    this.startTime = Date.now()
    this._emitScoreUpdate()
  }
  
  onStemInserted(stem) {
    if (!this.startTime) this.start()
    
    this.insertCount++
    
    if (stem.insertPoint && stem.insertPoint.angle !== undefined) {
      this.insertAngles.push(stem.insertPoint.angle)
    }
    
    this._calculateUniformity()
    this._calculateStemCount()
    this._emitScoreUpdate()
  }
  
  onBindForceChange(force) {
    if (force < this.bindForceMin) this.bindForceMin = force
    if (force > this.bindForceMax) this.bindForceMax = force
    this.bindForceFinal = force
    
    this._calculateBindForce()
    this._emitScoreUpdate()
  }
  
  onBindComplete(result) {
    this.bindForceFinal = result.force || this.bindForceFinal
    this._calculateBindForce()
    this._emitScoreUpdate()
  }
  
  onStemBreak() {
    this.breakCount++
    this._calculateBindForce()
    this._emitScoreUpdate()
  }
  
  onScatter() {
    this.scatterHappened = true
    this._calculateBindForce()
    this._emitScoreUpdate()
  }
  
  complete() {
    if (this.isComplete) return
    
    this.endTime = Date.now()
    this.totalTime = (this.endTime - this.startTime) / 1000
    
    this._calculateTime()
    this._calculateFinalScore()
    
    this.isComplete = true
    this._emit('complete', this.getResult())
    this._emitScoreUpdate()
  }
  
  _calculateUniformity() {
    if (this.insertCount < 2) {
      this.uniformityScore = this.insertCount > 0 ? 50 : 0
      return
    }
    
    const angles = [...this.insertAngles].sort((a, b) => a - b)
    const n = angles.length
    
    const gaps = []
    for (let i = 0; i < n; i++) {
      const next = angles[(i + 1) % n]
      let gap = next - angles[i]
      if (gap < 0) gap += Math.PI * 2
      gaps.push(gap)
    }
    
    const idealGap = (Math.PI * 2) / n
    let totalDeviation = 0
    for (const gap of gaps) {
      totalDeviation += Math.abs(gap - idealGap)
    }
    
    const avgDeviation = totalDeviation / n
    const maxDeviation = idealGap
    const deviationRatio = Math.min(1, avgDeviation / maxDeviation)
    
    this.uniformityScore = Math.round(100 * (1 - deviationRatio * 0.8))
    this.uniformityScore = Math.max(0, Math.min(100, this.uniformityScore))
  }
  
  _calculateBindForce() {
    if (this.scatterHappened) {
      this.bindForceScore = 30
      return
    }
    
    if (this.breakCount > 0) {
      this.bindForceScore = Math.max(20, 60 - this.breakCount * 20)
      return
    }
    
    const finalForce = this.bindForceFinal
    if (finalForce <= 0) {
      this.bindForceScore = 0
      return
    }
    
    const optimalMin = CONFIG.BIND_FORCE_OPTIMAL_MIN
    const optimalMax = CONFIG.BIND_FORCE_OPTIMAL_MAX
    const optimalMid = (optimalMin + optimalMax) / 2
    
    if (finalForce >= optimalMin && finalForce <= optimalMax) {
      const distFromMid = Math.abs(finalForce - optimalMid)
      const halfRange = (optimalMax - optimalMin) / 2
      const bonus = (1 - distFromMid / halfRange) * 15
      this.bindForceScore = Math.round(85 + bonus)
    } else if (finalForce < optimalMin) {
      const dist = optimalMin - finalForce
      const penalty = (dist / optimalMin) * 50
      this.bindForceScore = Math.round(Math.max(40, 75 - penalty))
    } else {
      const dist = finalForce - optimalMax
      const breakThreshold = CONFIG.BIND_FORCE_BREAK_THRESHOLD
      const range = breakThreshold - optimalMax
      const penalty = (dist / range) * 60
      this.bindForceScore = Math.round(Math.max(30, 75 - penalty))
    }
    
    this.bindForceScore = Math.max(0, Math.min(100, this.bindForceScore))
  }
  
  _calculateStemCount() {
    const maxStems = CONFIG.MAX_STEMS
    const minStems = CONFIG.MIN_STEMS_FOR_BIND
    
    if (this.insertCount >= maxStems) {
      this.stemCountScore = 100
    } else if (this.insertCount >= minStems) {
      const ratio = (this.insertCount - minStems) / (maxStems - minStems)
      this.stemCountScore = Math.round(60 + ratio * 40)
    } else {
      this.stemCountScore = Math.round((this.insertCount / minStems) * 50)
    }
    
    this.stemCountScore = Math.max(0, Math.min(100, this.stemCountScore))
  }
  
  _calculateTime() {
    const idealTime = 45
    const maxTime = 180
    
    if (this.totalTime <= idealTime) {
      this.timeScore = 100
    } else if (this.totalTime >= maxTime) {
      this.timeScore = 40
    } else {
      const ratio = (this.totalTime - idealTime) / (maxTime - idealTime)
      this.timeScore = Math.round(100 - ratio * 60)
    }
    
    this.timeScore = Math.max(0, Math.min(100, this.timeScore))
  }
  
  _calculateFinalScore() {
    const weights = {
      uniformity: 0.3,
      bindForce: 0.35,
      stemCount: 0.2,
      time: 0.15
    }
    
    this.finalScore = Math.round(
      this.uniformityScore * weights.uniformity +
      this.bindForceScore * weights.bindForce +
      this.stemCountScore * weights.stemCount +
      this.timeScore * weights.time
    )
    
    this.finalScore = Math.max(0, Math.min(100, this.finalScore))
    
    if (this.finalScore >= 90) {
      this.grade = 'S'
    } else if (this.finalScore >= 80) {
      this.grade = 'A'
    } else if (this.finalScore >= 70) {
      this.grade = 'B'
    } else if (this.finalScore >= 60) {
      this.grade = 'C'
    } else {
      this.grade = 'D'
    }
  }
  
  _emitScoreUpdate() {
    this._emit('scoreUpdate', this.getCurrentScores())
  }
  
  getCurrentScores() {
    return {
      uniformity: this.uniformityScore,
      bindForce: this.bindForceScore,
      stemCount: this.stemCountScore,
      time: this.timeScore,
      total: this.isComplete ? this.finalScore : null,
      grade: this.isComplete ? this.grade : null,
      insertCount: this.insertCount,
      breakCount: this.breakCount,
      scatterHappened: this.scatterHappened,
      elapsed: this.startTime ? (Date.now() - this.startTime) / 1000 : 0,
      isComplete: this.isComplete
    }
  }
  
  getResult() {
    return {
      uniformity: this.uniformityScore,
      bindForce: this.bindForceScore,
      stemCount: this.stemCountScore,
      time: this.timeScore,
      total: this.finalScore,
      grade: this.grade,
      totalTime: this.totalTime,
      insertCount: this.insertCount,
      breakCount: this.breakCount,
      scatterHappened: this.scatterHappened,
      timestamp: Date.now()
    }
  }
}
