import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { CONFIG } from '../config.js'

export class FlowerRack {
  constructor(sceneManager, physicsWorld, stemFactory) {
    this.sceneManager = sceneManager
    this.physicsWorld = physicsWorld
    this.stemFactory = stemFactory
    
    this.rackMesh = null
    this.stems = []
    this.rackSlots = []
  }
  
  createRack() {
    const group = new THREE.Group()
    
    const rackMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.rack,
      roughness: 0.8,
      metalness: 0.2
    })
    
    const baseGeo = new THREE.BoxGeometry(2.5, 0.1, 0.8)
    const base = new THREE.Mesh(baseGeo, rackMat)
    base.position.y = 0.05
    base.receiveShadow = true
    base.castShadow = true
    group.add(base)
    
    const backGeo = new THREE.BoxGeometry(2.5, 1.5, 0.08)
    const back = new THREE.Mesh(backGeo, rackMat)
    back.position.set(0, 0.8, -0.36)
    back.castShadow = true
    back.receiveShadow = true
    group.add(back)
    
    const slotGeo = new THREE.CylinderGeometry(0.05, 0.06, 0.3, 8)
    const slotMat = new THREE.MeshStandardMaterial({
      color: 0x5a3d2b,
      roughness: 0.9
    })
    
    const rows = CONFIG.RACK_ROWS
    const cols = CONFIG.RACK_COLS
    const spacingX = CONFIG.RACK_SPACING
    const spacingY = 0.6
    const startX = -((cols - 1) * spacingX) / 2
    const startY = 0.4
    
    for (let row = 0; row < rows; row++) {
      for (let col = 0; col < cols; col++) {
        const slot = new THREE.Mesh(slotGeo, slotMat)
        slot.position.set(
          startX + col * spacingX,
          startY + row * spacingY,
          -0.15
        )
        slot.castShadow = true
        slot.userData = { 
          type: 'rackSlot', 
          col, row, 
          occupied: false,
          worldPos: new THREE.Vector3()
        }
        slot.getWorldPosition(slot.userData.worldPos)
        group.add(slot)
        this.rackSlots.push(slot)
      }
    }
    
    group.position.set(-3, 0, 0)
    group.rotation.y = 0.3
    this.sceneManager.scene.add(group)
    this.rackMesh = group
    
    this._createPhysicsBody()
    this._populateStems()
  }
  
  _createPhysicsBody() {
    const body = new CANNON.Body({
      mass: 0,
      material: this.physicsWorld.rackMaterial,
      type: CANNON.Body.STATIC
    })
    
    const baseShape = new CANNON.Box(new CANNON.Vec3(1.25, 0.05, 0.4))
    body.addShape(baseShape, new CANNON.Vec3(-3, 0.05, 0))
    
    const backShape = new CANNON.Box(new CANNON.Vec3(1.25, 0.75, 0.04))
    body.addShape(backShape, new CANNON.Vec3(-3, 0.8, -0.36))
    
    body.quaternion.setFromAxisAngle(new CANNON.Vec3(0, 1, 0), 0.3)
    
    this.physicsWorld.addBody(body, { type: 'rack' })
    this.rackBody = body
  }
  
  _populateStems() {
    for (const slot of this.rackSlots) {
      const worldPos = new THREE.Vector3()
      slot.getWorldPosition(worldPos)
      worldPos.y += 0.15
      
      const stem = this.stemFactory.createStem(worldPos)
      if (stem) {
        stem.body.type = CANNON.Body.STATIC
        stem.rackSlot = slot
        slot.userData.occupied = true
        this.stems.push(stem)
      }
    }
  }
  
  pickStem(slot) {
    if (!slot.userData.occupied) return null
    
    const stem = this.stems.find(s => s.rackSlot === slot)
    if (stem) {
      slot.userData.occupied = false
      stem.rackSlot = null
      stem.setHeld(true)
      
      const idx = this.stems.indexOf(stem)
      if (idx > -1) this.stems.splice(idx, 1)
      
      return stem
    }
    return null
  }
  
  getSlotMesh(mesh) {
    let obj = mesh
    while (obj && !obj.userData?.type) {
      obj = obj.parent
    }
    if (obj?.userData?.type === 'rackSlot') return obj
    return null
  }
  
  getSlots() {
    return this.rackSlots.filter(s => s.userData.occupied)
  }
  
  reset() {
    for (const stem of this.stems) {
      this.stemFactory.removeStem(stem)
    }
    this.stems = []
    
    for (const slot of this.rackSlots) {
      slot.userData.occupied = false
    }
    
    this._populateStems()
  }
}
