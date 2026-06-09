export class ScoreArchive {
  constructor() {
    this.storageKey = 'flower_arrangement_scores'
    this.maxRecords = 20
  }
  
  addRecord(record) {
    const records = this.getRecords()
    
    const newRecord = {
      ...record,
      id: Date.now() + Math.random()
    }
    
    records.unshift(newRecord)
    
    if (records.length > this.maxRecords) {
      records.length = this.maxRecords
    }
    
    this._save(records)
    return newRecord
  }
  
  getRecords() {
    try {
      const data = localStorage.getItem(this.storageKey)
      if (data) {
        return JSON.parse(data)
      }
    } catch (e) {
      console.error('Failed to load scores:', e)
    }
    return []
  }
  
  getSortedByScore() {
    const records = this.getRecords()
    return records.sort((a, b) => b.total - a.total)
  }
  
  getBestScore() {
    const records = this.getRecords()
    if (records.length === 0) return null
    return records.reduce((best, r) => r.total > best.total ? r : best, records[0])
  }
  
  getAverageScore() {
    const records = this.getRecords()
    if (records.length === 0) return 0
    const sum = records.reduce((s, r) => s + r.total, 0)
    return Math.round(sum / records.length)
  }
  
  clear() {
    localStorage.removeItem(this.storageKey)
  }
  
  _save(records) {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(records))
    } catch (e) {
      console.error('Failed to save scores:', e)
    }
  }
  
  static formatTime(seconds) {
    const mins = Math.floor(seconds / 60)
    const secs = Math.floor(seconds % 60)
    return `${mins}:${secs.toString().padStart(2, '0')}`
  }
  
  static formatDate(timestamp) {
    const date = new Date(timestamp)
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    const hours = date.getHours().toString().padStart(2, '0')
    const mins = date.getMinutes().toString().padStart(2, '0')
    return `${month}-${day} ${hours}:${mins}`
  }
}
