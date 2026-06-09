import { CONFIG } from '../config.js'

export class UIManager {
  constructor() {
    this._listeners = {}
    
    this.stageIndicator = document.getElementById('stage-indicator')
    this.progressText = document.getElementById('progress-text')
    this.progressFill = document.getElementById('progress-fill')
    this.stemCount = document.getElementById('stem-count')
    this.bindForce = document.getElementById('bind-force')
    this.feedbackList = document.getElementById('feedback-list')
    this.hintText = document.getElementById('hint-text')
    
    this.btnReset = document.getElementById('btn-reset')
    this.btnBind = document.getElementById('btn-bind')
    this.btnWrap = document.getElementById('btn-wrap')
    this.btnNext = document.getElementById('btn-next')
    
    this._lastSettleTime = 0
    this._settleCooldown = 800
    
    this._bindButtons()
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
  
  _bindButtons() {
    this.btnReset.addEventListener('click', () => {
      if (this._checkCooldown('reset')) return
      this._emit('reset')
    })
    
    this.btnBind.addEventListener('click', () => {
      if (this._checkCooldown('bind')) return
      this._emit('bind')
    })
    
    this.btnWrap.addEventListener('click', () => {
      if (this._checkCooldown('wrap')) return
      this._emit('wrap')
    })
    
    this.btnNext.addEventListener('click', () => {
      if (this._checkCooldown('next')) return
      this._emit('next')
    })
  }
  
  _checkCooldown(action) {
    const now = Date.now()
    const lastKey = `_last_${action}`
    if (this[lastKey] && now - this[lastKey] < this._settleCooldown) {
      this.addFeedback('warning', '操作太快了，请稍等')
      return true
    }
    this[lastKey] = now
    return false
  }
  
  setStage(stage) {
    const stageNames = {
      1: '第 1 阶段：取花茎',
      2: '第 2 阶段：绑扎丝带',
      3: '第 3 阶段：包装纸折叠'
    }
    this.stageIndicator.textContent = stageNames[stage] || `第 ${stage} 阶段`
    
    const hints = {
      1: '点击料架上的花茎取出，点击花泥插入',
      2: '使用 W/S 或 ↑/↓ 调整绑扎力度，力度适中为最佳',
      3: '正在进行包装纸折叠...'
    }
    this.hintText.textContent = hints[stage] || ''
  }
  
  setProgress(progress) {
    const pct = Math.round(progress)
    this.progressText.textContent = `${pct}%`
    this.progressFill.style.width = `${pct}%`
  }
  
  setStemCount(count) {
    this.stemCount.textContent = `${count} / ${CONFIG.MAX_STEMS}`
  }
  
  setBindForce(force) {
    this.bindForce.textContent = force.toFixed(1) + ' N'
    
    if (force < CONFIG.BIND_FORCE_SCATTER_THRESHOLD) {
      this.bindForce.style.color = '#ffc107'
    } else if (force > CONFIG.BIND_FORCE_BREAK_THRESHOLD) {
      this.bindForce.style.color = '#f44336'
    } else if (force >= CONFIG.BIND_FORCE_OPTIMAL_MIN && force <= CONFIG.BIND_FORCE_OPTIMAL_MAX) {
      this.bindForce.style.color = '#4caf50'
    } else {
      this.bindForce.style.color = '#ffffff'
    }
  }
  
  addFeedback(type, message) {
    const item = document.createElement('div')
    item.className = `feedback-item ${type}`
    item.textContent = message
    
    this.feedbackList.appendChild(item)
    
    const maxItems = 5
    while (this.feedbackList.children.length > maxItems) {
      this.feedbackList.removeChild(this.feedbackList.firstChild)
    }
    
    setTimeout(() => {
      if (item.parentNode) {
        item.style.opacity = '0'
        item.style.transition = 'opacity 0.5s'
        setTimeout(() => item.parentNode?.removeChild(item), 500)
      }
    }, 3000)
  }
  
  clearFeedback() {
    this.feedbackList.innerHTML = ''
  }
  
  setButtonState(btn, enabled) {
    btn.disabled = !enabled
  }
}
