import { CONFIG } from '../config.js'
import { ScoreArchive } from '../systems/ScoreArchive.js'

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
    
    this.scoreTotal = document.getElementById('score-total')
    this.scoreUniformity = document.getElementById('score-uniformity')
    this.scoreBind = document.getElementById('score-bind')
    this.scoreCount = document.getElementById('score-count')
    this.scoreTime = document.getElementById('score-time')
    this.barUniformity = document.getElementById('bar-uniformity')
    this.barBind = document.getElementById('bar-bind')
    this.barCount = document.getElementById('bar-count')
    this.barTime = document.getElementById('bar-time')
    
    this.resultModal = document.getElementById('result-modal')
    this.resultGrade = document.getElementById('result-grade')
    this.resultTotal = document.getElementById('result-total')
    this.resultUniformity = document.getElementById('result-uniformity')
    this.resultBind = document.getElementById('result-bind')
    this.resultCount = document.getElementById('result-count')
    this.resultTime = document.getElementById('result-time')
    this.resultStems = document.getElementById('result-stems')
    this.resultBreaks = document.getElementById('result-breaks')
    this.resultTimeused = document.getElementById('result-timeused')
    
    this.historyList = document.getElementById('history-list')
    
    this.btnReset = document.getElementById('btn-reset')
    this.btnBind = document.getElementById('btn-bind')
    this.btnWrap = document.getElementById('btn-wrap')
    this.btnNext = document.getElementById('btn-next')
    this.btnResultRetry = document.getElementById('btn-result-retry')
    this.btnResultClose = document.getElementById('btn-result-close')
    
    this.scoreArchive = new ScoreArchive()
    
    this._lastSettleTime = 0
    this._settleCooldown = 800
    
    this._bindButtons()
    this._renderHistory()
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
    
    this.btnResultRetry.addEventListener('click', () => {
      this.hideResult()
      if (this._checkCooldown('reset')) return
      this._emit('reset')
    })
    
    this.btnResultClose.addEventListener('click', () => {
      this.hideResult()
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
  
  updateScores(scores) {
    if (scores.total !== null) {
      this.scoreTotal.textContent = scores.total
    } else {
      const estimated = Math.round(
        scores.uniformity * 0.3 +
        scores.bindForce * 0.35 +
        scores.stemCount * 0.2 +
        scores.time * 0.15
      )
      this.scoreTotal.textContent = estimated + '~'
    }
    
    this.scoreUniformity.textContent = scores.uniformity
    this.scoreBind.textContent = scores.bindForce
    this.scoreCount.textContent = scores.stemCount
    this.scoreTime.textContent = scores.time !== null ? scores.time : '--'
    
    this.barUniformity.style.width = `${scores.uniformity}%`
    this.barBind.style.width = `${scores.bindForce}%`
    this.barCount.style.width = `${scores.stemCount}%`
    this.barTime.style.width = `${Math.max(0, scores.time || 0)}%`
  }
  
  showResult(result) {
    this.resultGrade.textContent = result.grade
    this.resultGrade.className = `result-grade ${result.grade}`
    
    this.resultTotal.textContent = result.total
    this.resultUniformity.textContent = result.uniformity
    this.resultBind.textContent = result.bindForce
    this.resultCount.textContent = result.stemCount
    this.resultTime.textContent = result.time
    
    this.resultStems.textContent = result.insertCount
    this.resultBreaks.textContent = result.breakCount
    this.resultTimeused.textContent = ScoreArchive.formatTime(result.totalTime)
    
    this.resultModal.classList.add('show')
    
    this.scoreArchive.addRecord(result)
    this._renderHistory()
  }
  
  hideResult() {
    this.resultModal.classList.remove('show')
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
  
  _renderHistory() {
    const records = this.scoreArchive.getSortedByScore()
    
    if (records.length === 0) {
      this.historyList.innerHTML = '<div class="history-empty">暂无记录，快去挑战吧！</div>'
      return
    }
    
    const top10 = records.slice(0, 10)
    let html = ''
    
    top10.forEach((record, index) => {
      const rankClass = index === 0 ? 'top1' : index === 1 ? 'top2' : index === 2 ? 'top3' : ''
      const date = ScoreArchive.formatDate(record.timestamp)
      
      html += `
        <div class="history-item">
          <span class="rank ${rankClass}">${index + 1}</span>
          <span class="grade-badge ${record.grade}">${record.grade}</span>
          <span class="score">${record.total}</span>
          <span class="date">${date}</span>
        </div>
      `
    })
    
    this.historyList.innerHTML = html
  }
  
  resetHistoryUI() {
    this._renderHistory()
  }
}
