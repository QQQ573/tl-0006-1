import { CONFIG } from '../config.js'

export class GameState {
  constructor() {
    this._stage = 1
    this._progress = 0
    this._stemCount = 0
    this._canBind = false
    this._score = 0
    
    this._listeners = {}
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
  
  get stage() { return this._stage }
  get progress() { return this._progress }
  get stemCount() { return this._stemCount }
  get canBind() { return this._canBind }
  get score() { return this._score }
  
  setStage(stage) {
    if (this._stage === stage) return
    this._stage = stage
    this._emit('stageChange', stage)
  }
  
  setProgress(progress) {
    this._progress = Math.max(0, Math.min(100, progress))
    this._emit('progressChange', this._progress)
  }
  
  addStem() {
    this._stemCount++
    this.setProgress((this._stemCount / CONFIG.MAX_STEMS) * 50)
    this._emit('stemCountChange', this._stemCount)
  }
  
  removeStem() {
    this._stemCount = Math.max(0, this._stemCount - 1)
    this.setProgress((this._stemCount / CONFIG.MAX_STEMS) * 50)
    this._emit('stemCountChange', this._stemCount)
  }
  
  resetStems() {
    this._stemCount = 0
    this.setProgress(0)
    this._emit('stemCountChange', 0)
  }
  
  setCanBind(can) {
    if (this._canBind === can) return
    this._canBind = can
    this._emit('canBindChange', can)
  }
  
  addScore(points) {
    this._score += points
    this._emit('scoreChange', this._score)
  }
  
  reset() {
    this._stage = 1
    this._progress = 0
    this._stemCount = 0
    this._canBind = false
    this._score = 0
    
    this._emit('stageChange', 1)
    this._emit('progressChange', 0)
    this._emit('stemCountChange', 0)
    this._emit('canBindChange', false)
    this._emit('scoreChange', 0)
  }
}
