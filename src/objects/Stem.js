import * as THREE from 'three'
import * as CANNON from 'cannon-es'
import { CONFIG } from '../config.js'

export class Stem {
  constructor(sceneManager, physicsWorld, position, color = CONFIG.COLORS.stem) {
    this.sceneManager = sceneManager
    this.physicsWorld = physicsWorld
    this.height = CONFIG.STEM_HEIGHT
    this.radius = CONFIG.STEM_RADIUS
    this.color = color
    this.isInserted = false
    this.isBroken = false
    this.isHeld = false
    
    this._createMesh(position)
    this._createPhysics(position)
    
    this.sceneManager.scene.add(this.mesh)
    this.physicsWorld.addBody(this.body, { type: 'stem', stem: this })
  }
  
  _createMesh(position) {
    const group = new THREE.Group()
    
    const stemGeo = new THREE.CylinderGeometry(
      this.radius,
      this.radius * 1.1,
      this.height,
      8
    )
    const stemMat = new THREE.MeshStandardMaterial({
      color: this.color,
      roughness: 0.7,
      metalness: 0.1
    })
    const stemMesh = new THREE.Mesh(stemGeo, stemMat)
    stemMesh.castShadow = true
    stemMesh.receiveShadow = true
    stemMesh.position.y = this.height / 2
    group.add(stemMesh)
    
    const flowerColors = [0xff6b6b, 0xffd93d, 0x6bcbff, 0xc56bff, 0xff6bff]
    const flowerColor = flowerColors[Math.floor(Math.random() * flowerColors.length)]
    const flowerGeo = new THREE.SphereGeometry(0.12, 8, 6)
    const flowerMat = new THREE.MeshStandardMaterial({
      color: flowerColor,
      roughness: 0.5,
      metalness: 0.1
    })
    const flower = new THREE.Mesh(flowerGeo, flowerMat)
    flower.position.y = this.height - 0.1
    flower.castShadow = true
    group.add(flower)
    
    const leafGeo = new THREE.ConeGeometry(0.05, 0.25, 4)
    const leafMat = new THREE.MeshStandardMaterial({
      color: CONFIG.COLORS.stemDark,
      roughness: 0.8
    })
    for (let i = 0; i < 3; i++) {
      const leaf = new THREE.Mesh(leafGeo, leafMat)
      leaf.position.y = 0.8 + i * 0.5
      leaf.position.x = 0.08
      leaf.rotation.z = Math.PI / 4
      leaf.rotation.y = (i / 3) * Math.PI * 2
      leaf.castShadow = true
      group.add(leaf)
    }
    
    group.position.copy(position)
    this.mesh = group
    this.stemMesh = stemMesh
    this.mesh.userData = { type: 'stem', stem: this }
  }
  
  _createPhysics(position) {
    const body = new CANNON.Body({
      mass: CONFIG.STEM_MASS,
      material: this.physicsWorld.stemMaterial,
      linearDamping: 0.5,
      angularDamping: 0.5,
      allowSleep: true,
      sleepSpeedLimit: 0.02,
      sleepTimeLimit: 0.3
    })
    
    const segments = 3
    const segmentHeight = this.height / segments
    const segmentRadius = this.radius
    
    for (let i = 0; i < segments; i++) {
      const cylinderShape = new CANNON.Cylinder(
        segmentRadius,
        segmentRadius,
        segmentHeight,
        8
      )
      const yOffset = -this.height / 2 + segmentHeight / 2 + i * segmentHeight
      body.addShape(cylinderShape, new CANNON.Vec3(0, yOffset, 0))
    }
    
    const sphereTop = new CANNON.Sphere(segmentRadius * 1.1)
    body.addShape(sphereTop, new CANNON.Vec3(0, this.height / 2, 0))
    
    body.position.copy(position)
    body.position.y += this.height / 2
    
    this.body = body
  }
  
  update() {
    this.mesh.position.copy(this.body.position)
    this.mesh.position.y -= this.height / 2
    
    this.mesh.quaternion.copy(this.body.quaternion)
  }
  
  setHeld(held) {
    this.isHeld = held
    if (held) {
      this.body.type = CANNON.Body.KINEMATIC
      this.body.wakeUp()
    } else {
      this.body.type = CANNON.Body.DYNAMIC
      this.body.wakeUp()
    }
  }
  
  setInserted(inserted) {
    this.isInserted = inserted
    if (inserted) {
      this.body.type = CANNON.Body.STATIC
      this.body.wakeUp()
    } else {
      this.body.type = CANNON.Body.DYNAMIC
      this.body.wakeUp()
    }
  }
  
  break() {
    if (this.isBroken) return
    this.isBroken = true
    
    this.stemMesh.material.color.setHex(0x8B4513)
    this.stemMesh.material.emissive = new THREE.Color(0x331100)
    this.body.wakeUp()
    
    const breakForce = new CANNON.Vec3(
      (Math.random() - 0.5) * 5,
      2,
      (Math.random() - 0.5) * 5
    )
    this.body.applyImpulse(breakForce, this.body.position)
  }
  
  reset(position) {
    this.isBroken = false
    this.isInserted = false
    this.isHeld = false
    
    this.stemMesh.material.color.setHex(this.color)
    this.stemMesh.material.emissive = new THREE.Color(0x000000)
    
    this.body.position.copy(position)
    this.body.position.y += this.height / 2
    this.body.velocity.set(0, 0, 0)
    this.body.angularVelocity.set(0, 0, 0)
    this.body.quaternion.set(0, 0, 0, 1)
    this.body.type = CANNON.Body.DYNAMIC
    this.body.wakeUp()
  }
  
  dispose() {
    this.sceneManager.scene.remove(this.mesh)
    this.physicsWorld.removeBody(this.body)
    
    this.mesh.traverse((child) => {
      if (child.geometry) child.geometry.dispose()
      if (child.material) child.material.dispose()
    })
  }
}
