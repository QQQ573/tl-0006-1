import * as CANNON from 'cannon-es'
import { CONFIG } from '../config.js'

export class PhysicsWorld {
  constructor() {
    this.world = new CANNON.World({
      gravity: new CANNON.Vec3(0, CONFIG.PHYSICS_GRAVITY, 0)
    })
    
    this.world.broadphase = new CANNON.NaiveBroadphase()
    
    this.world.solver.iterations = 10
    this.world.defaultContactMaterial.contactEquationStiffness = 1e6
    this.world.defaultContactMaterial.contactEquationRelaxation = 3
    
    this.world.allowSleep = true
    this.world.sleepSpeedLimit = 0.05
    this.world.sleepTimeLimit = 0.5
    
    this._setupMaterials()
    this._setupGround()
    
    this.bodies = new Map()
    this._stepCount = 0
  }
  
  _setupMaterials() {
    this.groundMaterial = new CANNON.Material('ground')
    this.stemMaterial = new CANNON.Material('stem')
    this.foamMaterial = new CANNON.Material('foam')
    this.rackMaterial = new CANNON.Material('rack')
    
    const groundStemContact = new CANNON.ContactMaterial(
      this.groundMaterial,
      this.stemMaterial,
      { friction: 0.6, restitution: 0.1 }
    )
    this.world.addContactMaterial(groundStemContact)
    
    const stemStemContact = new CANNON.ContactMaterial(
      this.stemMaterial,
      this.stemMaterial,
      { friction: 0.4, restitution: 0.05 }
    )
    this.world.addContactMaterial(stemStemContact)
    
    const foamStemContact = new CANNON.ContactMaterial(
      this.foamMaterial,
      this.stemMaterial,
      { friction: 0.9, restitution: 0.0 }
    )
    this.world.addContactMaterial(foamStemContact)
    
    const rackStemContact = new CANNON.ContactMaterial(
      this.rackMaterial,
      this.stemMaterial,
      { friction: 0.7, restitution: 0.1 }
    )
    this.world.addContactMaterial(rackStemContact)
  }
  
  _setupGround() {
    const groundBody = new CANNON.Body({
      mass: 0,
      shape: new CANNON.Plane(),
      material: this.groundMaterial,
      collisionFilterGroup: 1,
      collisionFilterMask: -1
    })
    groundBody.quaternion.setFromAxisAngle(new CANNON.Vec3(1, 0, 0), -Math.PI / 2)
    this.world.addBody(groundBody)
  }
  
  step(dt) {
    const steps = CONFIG.PHYSICS_STEPS
    const stepDt = dt / steps
    
    for (let i = 0; i < steps; i++) {
      this.world.step(1 / 60, stepDt, 1)
    }
    
    this._stepCount++
  }
  
  addBody(body, userData = {}) {
    this.world.addBody(body)
    this.bodies.set(body.id, { body, userData })
    return body
  }
  
  removeBody(body) {
    this.world.removeBody(body)
    this.bodies.delete(body.id)
  }
  
  getBodyCount() {
    return this.world.bodies.length
  }
  
  getActiveBodyCount() {
    let count = 0
    for (const body of this.world.bodies) {
      if (body.type === CANNON.Body.DYNAMIC && !body.sleeping) {
        count++
      }
    }
    return count
  }
}
