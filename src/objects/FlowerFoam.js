import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { CONFIG } from '../config.js'

export class FlowerFoam {
  constructor(sceneManager, physicsWorld) {
    this.sceneManager = sceneManager
    this.physicsWorld = physicsWorld
    
    this.foamMesh = null
    this.foamBody = null
    this.insertedStems = []
    this.insertPoints = []
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
  
  createFoam() {
    const group = new THREE.Group()
    
    const foamGeo = new THREE.ConeGeometry(CONFIG.FOAM_RADIUS_TOP, CONFIG.FOAM_HEIGHT, 12)
    const foamMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.foam,
      roughness: 0.9,
      transparent: true,
      opacity: 0.85
    })
    const foam = new THREE.Mesh(foamGeo, foamMat)
    foam.position.y = CONFIG.FOAM_HEIGHT / 2
    foam.castShadow = true
    foam.receiveShadow = true
    foam.userData = { type: 'flowerFoam' }
    group.add(foam)
    this.foamMesh = foam
    
    const baseGeo = new THREE.CylinderGeometry(CONFIG.FOAM_RADIUS_BOTTOM + 0.05, CONFIG.FOAM_RADIUS_BOTTOM + 0.08, 0.1, 16)
    const baseMat = new THREE.MeshStandardMaterial({
      color: 0x654321,
      roughness: 0.9
    })
    const base = new THREE.Mesh(baseGeo, baseMat)
    base.position.y = 0.05
    base.receiveShadow = true
    base.castShadow = true
    group.add(base)
    
    group.position.set(0, 0, 0)
    this.sceneManager.scene.add(group)
    this.group = group
    
    this._createPhysicsBody()
    this._generateInsertPoints()
  }
  
  _createPhysicsBody() {
    const body = new CANNON.Body({
      mass: 0,
      material: this.physicsWorld.foamMaterial,
      type: CANNON.Body.STATIC
    })
    
    const cylinderShape = new CANNON.Cylinder(
      CONFIG.FOAM_RADIUS_TOP,
      CONFIG.FOAM_RADIUS_BOTTOM,
      CONFIG.FOAM_HEIGHT,
      12
    )
    body.addShape(cylinderShape, new CANNON.Vec3(0, CONFIG.FOAM_HEIGHT / 2, 0))
    
    this.physicsWorld.addBody(body, { type: 'foam' })
    this.foamBody = body
  }
  
  _generateInsertPoints() {
    const rings = [
      { r: 0, count: 1, y: 0.7 },
      { r: 0.05, count: 5, y: 0.65 },
      { r: 0.1, count: 8, y: 0.6 }
    ]
    
    for (const ring of rings) {
      for (let i = 0; i < ring.count; i++) {
        const angle = (i / ring.count) * Math.PI * 2
        this.insertPoints.push({
          x: Math.cos(angle) * ring.r,
          z: Math.sin(angle) * ring.r,
          y: ring.y,
          angle: angle,
          occupied: false
        })
      }
    }
  }
  
  tryInsert(stem, hitPoint) {
    if (!stem || stem.isInserted) return false
    
    const foamWorldPos = new THREE.Vector3()
    this.group.getWorldPosition(foamWorldPos)
    
    const localX = hitPoint.x - foamWorldPos.x
    const localZ = hitPoint.z - foamWorldPos.z
    const localY = hitPoint.y - foamWorldPos.y
    
    const dist = Math.sqrt(localX * localX + localZ * localZ)
    const foamTopRadius = CONFIG.FOAM_RADIUS_TOP
    
    if (dist > foamTopRadius * 0.9) return false
    if (localY < CONFIG.FOAM_HEIGHT * 0.5) return false
    
    let nearestPoint = null
    let nearestDist = Infinity
    
    for (const point of this.insertPoints) {
      if (point.occupied) continue
      const d = Math.sqrt(
        Math.pow(point.x - localX, 2) + 
        Math.pow(point.z - localZ, 2)
      )
      if (d < nearestDist) {
        nearestDist = d
        nearestPoint = point
      }
    }
    
    if (!nearestPoint || nearestDist > 0.15) {
      nearestPoint = this._findClosestFreeRing(localX, localZ)
    }
    
    if (nearestPoint) {
      this._insertStemAtPoint(stem, nearestPoint)
      return true
    }
    
    return false
  }
  
  _findClosestFreeRing(localX, localZ) {
    let best = null
    let bestDist = Infinity
    
    for (const point of this.insertPoints) {
      if (point.occupied) continue
      const d = Math.sqrt(
        Math.pow(point.x - localX, 2) + 
        Math.pow(point.z - localZ, 2)
      )
      if (d < bestDist) {
        bestDist = d
        best = point
      }
    }
    
    return best
  }
  
  _insertStemAtPoint(stem, point) {
    point.occupied = true
    stem.insertPoint = point
    
    const foamWorldPos = new THREE.Vector3()
    this.group.getWorldPosition(foamWorldPos)
    
    const worldX = foamWorldPos.x + point.x
    const worldZ = foamWorldPos.z + point.z
    const worldY = foamWorldPos.y + point.y - stem.height / 2
    
    stem.setInserted(true)
    stem.body.position.set(worldX, worldY + stem.height / 2, worldZ)
    stem.body.quaternion.set(0, 0, 0, 1)
    
    stem.body.velocity.set(0, 0, 0)
    stem.body.angularVelocity.set(0, 0, 0)
    
    const angle = point.angle || 0
    const leanAngle = 0.05
    stem.body.quaternion.setFromEuler(
      Math.cos(angle) * leanAngle,
      0,
      -Math.sin(angle) * leanAngle
    )
    
    this.insertedStems.push(stem)
    this._emit('stemInserted', stem)
  }
  
  releaseStem(stem) {
    if (stem.insertPoint) {
      stem.insertPoint.occupied = false
      stem.insertPoint = null
    }
    
    const idx = this.insertedStems.indexOf(stem)
    if (idx > -1) {
      this.insertedStems.splice(idx, 1)
    }
    
    stem.setInserted(false)
  }
  
  getTopPosition() {
    const foamWorldPos = new THREE.Vector3()
    this.group.getWorldPosition(foamWorldPos)
    return new THREE.Vector3(
      foamWorldPos.x,
      foamWorldPos.y + CONFIG.FOAM_HEIGHT,
      foamWorldPos.z
    )
  }
  
  getBindPosition() {
    const foamWorldPos = new THREE.Vector3()
    this.group.getWorldPosition(foamWorldPos)
    return new THREE.Vector3(
      foamWorldPos.x,
      foamWorldPos.y + CONFIG.FOAM_HEIGHT * 0.7,
      foamWorldPos.z
    )
  }
}
