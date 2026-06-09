import * as THREE from 'three'
import { CONFIG } from '../config.js'

export class RibbonSystem {
  constructor(sceneManager, physicsWorld) {
    this.sceneManager = sceneManager
    this.physicsWorld = physicsWorld
    
    this.isBinding = false
    this.bindForce = 0
    this.stems = []
    this.foam = null
    
    this.ribbonMesh = null
    this.bowMesh = null
    
    this._listeners = {}
    
    this._bindAnimationTime = 0
    this._bindDuration = 1.5
    this._currentForce = 0
    this._hasCheckedResult = false
    
    this._breakCheckInterval = 0.3
    this._breakTimer = 0
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
  
  startBinding(stems, foam) {
    if (this.isBinding) return
    
    this.isBinding = true
    this.stems = stems.slice()
    this.foam = foam
    this._bindAnimationTime = 0
    this._currentForce = CONFIG.BIND_FORCE_MIN
    this._hasCheckedResult = false
    this._breakTimer = 0
    
    this._createRibbonMesh()
    this._emit('bindForceChange', this._currentForce)
  }
  
  _createRibbonMesh() {
    this._clearRibbon()
    
    const bindPos = this.foam.getBindPosition()
    const group = new THREE.Group()
    
    const ribbonMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ribbon,
      roughness: 0.4,
      metalness: 0.3,
      side: THREE.DoubleSide
    })
    
    const torusGeo = new THREE.TorusGeometry(0.2, 0.04, 8, 32)
    const torus = new THREE.Mesh(torusGeo, ribbonMat)
    torus.rotation.x = Math.PI / 2
    torus.castShadow = true
    group.add(torus)
    this.torusMesh = torus
    
    const bowGroup = new THREE.Group()
    const bowMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.ribbon,
      roughness: 0.4,
      metalness: 0.3
    })
    
    const loopGeo = new THREE.TorusGeometry(0.06, 0.02, 6, 12)
    const loop1 = new THREE.Mesh(loopGeo, bowMat)
    loop1.position.set(0.07, 0, 0)
    loop1.rotation.y = Math.PI / 2
    bowGroup.add(loop1)
    
    const loop2 = new THREE.Mesh(loopGeo, bowMat)
    loop2.position.set(-0.07, 0, 0)
    loop2.rotation.y = Math.PI / 2
    bowGroup.add(loop2)
    
    const knotGeo = new THREE.SphereGeometry(0.03, 8, 6)
    const knot = new THREE.Mesh(knotGeo, bowMat)
    bowGroup.add(knot)
    
    const tailGeo = new THREE.PlaneGeometry(0.04, 0.2)
    const tail1 = new THREE.Mesh(tailGeo, ribbonMat)
    tail1.position.set(0.015, -0.1, 0)
    tail1.rotation.z = 0.2
    bowGroup.add(tail1)
    
    const tail2 = new THREE.Mesh(tailGeo, ribbonMat)
    tail2.position.set(-0.015, -0.1, 0)
    tail2.rotation.z = -0.2
    bowGroup.add(tail2)
    
    bowGroup.position.set(0, 0, 0.2)
    bowGroup.visible = false
    this.bowMesh = bowGroup
    group.add(bowGroup)
    
    group.position.copy(bindPos)
    group.scale.set(0, 0, 0)
    this.sceneManager.scene.add(group)
    this.ribbonMesh = group
  }
  
  update(dt) {
    if (!this.isBinding || !this.ribbonMesh) return
    
    this._bindAnimationTime += dt
    
    const progress = Math.min(1, this._bindAnimationTime / this._bindDuration)
    const easeProgress = 1 - Math.pow(1 - progress, 3)
    
    const startScale = 2
    const forceRatio = this._currentForce / CONFIG.BIND_FORCE_MAX
    const endScale = 1 - forceRatio * 0.5
    const currentScale = startScale * (1 - easeProgress) + endScale * easeProgress
    
    this.ribbonMesh.scale.set(currentScale, currentScale, currentScale)
    
    const targetForce = this._calculateTargetForce()
    const forceSpeed = 8
    if (this._currentForce < targetForce) {
      this._currentForce = Math.min(targetForce, this._currentForce + dt * forceSpeed)
    }
    this._emit('bindForceChange', Math.round(this._currentForce * 10) / 10)
    
    if (progress >= 1 && !this._hasCheckedResult) {
      this._hasCheckedResult = true
      this._checkBindResult()
    }
    
    if (this._hasCheckedResult && this._currentForce >= CONFIG.BIND_FORCE_BREAK_THRESHOLD * 0.9) {
      this._breakTimer += dt
      if (this._breakTimer >= this._breakCheckInterval) {
        this._breakTimer = 0
        this._checkStemBreak()
      }
    }
  }
  
  _calculateTargetForce() {
    const baseForce = this.stems.length * 2.5 + 6
    return Math.min(baseForce, CONFIG.BIND_FORCE_MAX)
  }
  
  _checkBindResult() {
    const force = this._currentForce
    
    let success = true
    let message = ''
    
    if (force < CONFIG.BIND_FORCE_SCATTER_THRESHOLD) {
      success = false
      setTimeout(() => this._emit('stemsScatter'), 600)
      message = '绑扎过松，花束会散落'
    } else if (force > CONFIG.BIND_FORCE_BREAK_THRESHOLD) {
      success = false
      message = '绑扎过紧，有花茎折断风险'
      setTimeout(() => this._checkStemBreak(), 300)
    } else if (force >= CONFIG.BIND_FORCE_OPTIMAL_MIN && force <= CONFIG.BIND_FORCE_OPTIMAL_MAX) {
      message = '绑扎力度完美！'
      if (this.bowMesh) this.bowMesh.visible = true
    } else {
      message = '绑扎完成'
      if (this.bowMesh) this.bowMesh.visible = true
    }
    
    this._emit('bindComplete', { success, force, message })
  }
  
  _checkStemBreak() {
    if (this.stems.length === 0) return
    
    const breakChance = (this._currentForce - CONFIG.BIND_FORCE_BREAK_THRESHOLD) / 15
    
    if (Math.random() < Math.max(0.1, breakChance)) {
      const idx = Math.floor(Math.random() * this.stems.length)
      const brokenStem = this.stems[idx]
      
      if (brokenStem && !brokenStem.isBroken) {
        brokenStem.break()
        this.stems.splice(idx, 1)
        this._emit('stemBreak', brokenStem)
      }
    }
  }
  
  adjustForce(delta) {
    if (!this.isBinding) return
    
    this._currentForce = Math.max(
      CONFIG.BIND_FORCE_MIN,
      Math.min(CONFIG.BIND_FORCE_MAX, this._currentForce + delta)
    )
  }
  
  _clearRibbon() {
    if (this.ribbonMesh) {
      this.sceneManager.scene.remove(this.ribbonMesh)
      this.ribbonMesh.traverse((child) => {
        if (child.geometry) child.geometry.dispose()
        if (child.material) child.material.dispose()
      })
      this.ribbonMesh = null
    }
    this.torusMesh = null
    this.bowMesh = null
  }
  
  reset() {
    this.isBinding = false
    this.stems = []
    this.foam = null
    this.bindForce = 0
    this._currentForce = 0
    this._bindAnimationTime = 0
    this._hasCheckedResult = false
    this._clearRibbon()
  }
}
