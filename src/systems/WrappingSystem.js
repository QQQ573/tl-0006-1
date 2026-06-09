import * as THREE from 'three'
import { CONFIG } from '../config.js'

export class WrappingSystem {
  constructor(sceneManager) {
    this.sceneManager = sceneManager
    this.isWrapping = false
    this.wrapProgress = 0
    this.wrapDuration = CONFIG.WRAP_DURATION
    this.wrapPaper = null
    this.stems = []
    this.callback = null
  }
  
  startWrapping(stems, callback) {
    if (this.isWrapping) return
    
    this.isWrapping = true
    this.stems = stems
    this.wrapProgress = 0
    this.callback = callback
    
    this._createWrapPaper()
  }
  
  _createWrapPaper() {
    this._clearWrap()
    
    const group = new THREE.Group()
    
    const paperMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.wrap,
      roughness: 0.7,
      metalness: 0.1,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.9
    })
    
    const sheets = []
    const sheetCount = 4
    
    for (let i = 0; i < sheetCount; i++) {
      const sheetGeo = new THREE.PlaneGeometry(1.2, 1.8, 8, 12)
      const sheet = new THREE.Mesh(sheetGeo, paperMat.clone())
      
      sheet.castShadow = true
      sheet.receiveShadow = true
      
      const angle = (i / sheetCount) * Math.PI * 2
      sheet.position.set(
        Math.cos(angle) * 0.3,
        0.8,
        Math.sin(angle) * 0.3
      )
      sheet.rotation.y = angle + Math.PI / 2
      
      group.add(sheet)
      sheets.push(sheet)
    }
    
    group.position.set(0, 0, 0)
    group.scale.set(0, 0, 0)
    
    this.sceneManager.scene.add(group)
    this.wrapPaper = group
    this.wrapSheets = sheets
  }
  
  update(dt) {
    if (!this.isWrapping || !this.wrapPaper) return
    
    this.wrapProgress += dt / this.wrapDuration
    
    const t = Math.min(1, this.wrapProgress)
    const easeT = this._easeOutBack(t)
    
    this.wrapPaper.scale.setScalar(easeT)
    
    if (this.wrapSheets) {
      for (let i = 0; i < this.wrapSheets.length; i++) {
        const sheet = this.wrapSheets[i]
        const angle = (i / this.wrapSheets.length) * Math.PI * 2
        
        const foldAmount = Math.sin(t * Math.PI) * 0.5
        const radius = 0.25 + foldAmount * 0.15
        
        sheet.position.x = Math.cos(angle) * radius
        sheet.position.z = Math.sin(angle) * radius
        
        sheet.rotation.y = angle + Math.PI / 2 + foldAmount * 0.3 * (i % 2 === 0 ? 1 : -1)
        
        this._bendSheet(sheet, t)
      }
    }
    
    if (t >= 1 && this.callback) {
      const cb = this.callback
      this.callback = null
      setTimeout(() => cb(), 300)
    }
  }
  
  _bendSheet(sheet, t) {
    const geo = sheet.geometry
    const positions = geo.attributes.position
    
    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i)
      const bendFactor = y / 1.8
      
      const originalX = (i % 9) / 8 - 0.5
      
      const bendAmount = Math.sin(t * Math.PI * 0.5) * 0.3 * bendFactor
      
      positions.setX(i, originalX * (1 + bendAmount))
    }
    
    positions.needsUpdate = true
    geo.computeVertexNormals()
  }
  
  _easeOutBack(t) {
    const c1 = 1.70158
    const c3 = c1 + 1
    return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
  }
  
  _clearWrap() {
    if (this.wrapPaper) {
      this.sceneManager.scene.remove(this.wrapPaper)
      this.wrapPaper.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
      this.wrapPaper = null
      this.wrapSheets = []
    }
  }
  
  reset() {
    this.isWrapping = false
    this.wrapProgress = 0
    this.stems = []
    this.callback = null
    this._clearWrap()
  }
}
