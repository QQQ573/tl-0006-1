import * as THREE from 'three'
import { CONFIG } from '../config.js'

export class InputManager {
  constructor(sceneManager, gameState, flowerRack, flowerFoam, ribbonSystem, uiManager, stemFactory) {
    this.sceneManager = sceneManager
    this.gameState = gameState
    this.flowerRack = flowerRack
    this.flowerFoam = flowerFoam
    this.ribbonSystem = ribbonSystem
    this.uiManager = uiManager
    this.stemFactory = stemFactory
    
    this.raycaster = new THREE.Raycaster()
    this.heldStem = null
    this.hoverObject = null
    
    this._lastTapTime = 0
    this._tapCooldown = CONFIG.TAP_COOLDOWN_MS
    
    this._isDragging = false
    this._dragStartPos = new THREE.Vector2()
    this._dragMoved = false
    this._dragThreshold = 5
    
    this._pinchStartDist = 0
    this._isPinching = false
    
    this._lastTouchX = 0
    this._lastTouchY = 0
    
    this._bindEvents()
  }
  
  _bindEvents() {
    const canvas = this.sceneManager.renderer.domElement
    
    canvas.addEventListener('mousedown', (e) => this._onPointerDown(e))
    canvas.addEventListener('mousemove', (e) => this._onPointerMove(e))
    window.addEventListener('mouseup', (e) => this._onPointerUp(e))
    
    canvas.addEventListener('touchstart', (e) => this._onTouchStart(e), { passive: false })
    canvas.addEventListener('touchmove', (e) => this._onTouchMove(e), { passive: false })
    window.addEventListener('touchend', (e) => this._onTouchEnd(e), { passive: false })
    
    canvas.addEventListener('wheel', (e) => {
      e.preventDefault()
      e.stopPropagation()
    }, { passive: false })
    
    canvas.addEventListener('contextmenu', (e) => e.preventDefault())
    
    document.addEventListener('keydown', (e) => this._onKeyDown(e))
  }
  
  _onPointerDown(event) {
    if (this.gameState.stage > 2) return
    
    const mouse = this.sceneManager.getMouseFromEvent(event)
    this._isDragging = true
    this._dragMoved = false
    this._dragStartPos.copy(mouse)
    
    if (this.gameState.stage === 1) {
      this._tryPickStem(mouse)
    }
  }
  
  _onPointerMove(event) {
    const mouse = this.sceneManager.getMouseFromEvent(event)
    
    if (this._isDragging && !this._dragMoved) {
      const dx = (mouse.x - this._dragStartPos.x) * window.innerWidth / 2
      const dy = (mouse.y - this._dragStartPos.y) * window.innerHeight / 2
      if (Math.sqrt(dx * dx + dy * dy) > this._dragThreshold) {
        this._dragMoved = true
        if (this.heldStem) {
          this.sceneManager.controls.enabled = false
        }
      }
    }
    
    if (this.heldStem && this._dragMoved) {
      this._updateHeldStemPosition(event)
    }
    
    if (!this._isDragging || !this.heldStem) {
      this._updateHover(mouse)
    }
  }
  
  _onPointerUp(event) {
    if (!this._isDragging) return
    this._isDragging = false
    
    this.sceneManager.controls.enabled = true
    
    if (this.heldStem) {
      if (this._dragMoved) {
        this._tryInsertStem(event)
      } else {
        this._tryInsertOrDrop(event)
      }
    }
  }
  
  _onTouchStart(event) {
    event.preventDefault()
    event.stopPropagation()
    
    if (event.touches.length === 1) {
      const touch = event.touches[0]
      this._lastTouchX = touch.clientX
      this._lastTouchY = touch.clientY
      
      const mouse = this.sceneManager.getMouseFromEvent(event)
      this._isDragging = true
      this._dragMoved = false
      this._dragStartPos.copy(mouse)
      
      if (this.gameState.stage === 1) {
        this._tryPickStem(mouse)
      }
    } else if (event.touches.length === 2) {
      this._pinchStartDist = this._getTouchDistance(event.touches)
      this._isPinching = true
      if (this.heldStem) {
        this._dropStem()
      }
    }
  }
  
  _onTouchMove(event) {
    event.preventDefault()
    event.stopPropagation()
    
    if (event.touches.length === 2 && this._isPinching) {
      return
    }
    
    if (event.touches.length === 1) {
      const touch = event.touches[0]
      this._lastTouchX = touch.clientX
      this._lastTouchY = touch.clientY
    }
    
    const mouse = this.sceneManager.getMouseFromEvent(event)
    
    if (this._isDragging && !this._dragMoved) {
      const dx = (mouse.x - this._dragStartPos.x) * window.innerWidth / 2
      const dy = (mouse.y - this._dragStartPos.y) * window.innerHeight / 2
      if (Math.sqrt(dx * dx + dy * dy) > this._dragThreshold) {
        this._dragMoved = true
        if (this.heldStem) {
          this.sceneManager.controls.enabled = false
        }
      }
    }
    
    if (this.heldStem && this._dragMoved) {
      this._updateHeldStemPosition(event)
    }
  }
  
  _onTouchEnd(event) {
    if (event.touches.length === 0) {
      const wasDragging = this._isDragging
      this._isDragging = false
      this._isPinching = false
      
      this.sceneManager.controls.enabled = true
      
      if (this.heldStem && wasDragging) {
        const fakeEvent = { 
          touches: [{ 
            clientX: this._lastTouchX, 
            clientY: this._lastTouchY 
          }] 
        }
        if (this._dragMoved) {
          this._tryInsertStem(fakeEvent)
        } else {
          this._tryInsertOrDrop(fakeEvent)
        }
      }
    }
  }
  
  _getTouchDistance(touches) {
    const dx = touches[0].clientX - touches[1].clientX
    const dy = touches[0].clientY - touches[1].clientY
    return Math.sqrt(dx * dx + dy * dy)
  }
  
  _tryPickStem(mouse) {
    if (this.heldStem) return
    
    const now = Date.now()
    if (now - this._lastTapTime < this._tapCooldown) {
      return
    }
    
    this.raycaster.setFromCamera(mouse, this.sceneManager.camera)
    
    const rackSlots = this.flowerRack.getSlots()
    const rackIntersects = this.raycaster.intersectObjects(rackSlots, true)
    
    if (rackIntersects.length > 0) {
      let slotMesh = null
      for (const hit of rackIntersects) {
        slotMesh = this.flowerRack.getSlotMesh(hit.object)
        if (slotMesh && slotMesh.userData.occupied) break
      }
      
      if (slotMesh && slotMesh.userData.occupied) {
        this._lastTapTime = now
        const stem = this.flowerRack.pickStem(slotMesh)
        if (stem) {
          this.heldStem = stem
          this.uiManager.addFeedback('success', '已拿起花茎，拖到花泥处插入')
        }
        return
      }
    }
    
    const groundStems = this.stemFactory.stems.filter(s => 
      !s.isInserted && !s.isHeld && s.body.position.y < CONFIG.STEM_HEIGHT * 0.6
    )
    const stemMeshes = groundStems.map(s => s.mesh)
    
    if (stemMeshes.length > 0) {
      const stemIntersects = this.raycaster.intersectObjects(stemMeshes, true)
      
      if (stemIntersects.length > 0) {
        this._lastTapTime = now
        let stemObj = stemIntersects[0].object
        while (stemObj && !stemObj.userData?.stem) {
          stemObj = stemObj.parent
        }
        
        if (stemObj?.userData?.stem) {
          const stem = stemObj.userData.stem
          stem.setHeld(true)
          this.heldStem = stem
          this.uiManager.addFeedback('success', '已拾起花茎，拖到花泥处插入')
        }
      }
    }
  }
  
  _updateHover(mouse) {
    this.raycaster.setFromCamera(mouse, this.sceneManager.camera)
    
    const rackSlots = this.flowerRack.getSlots()
    const allObjects = [...rackSlots]
    
    if (this.flowerFoam.foamMesh) {
      allObjects.push(this.flowerFoam.foamMesh)
    }
    
    const groundStems = this.stemFactory.stems.filter(s => !s.isInserted && !s.isHeld)
    for (const stem of groundStems) {
      allObjects.push(stem.mesh)
    }
    
    const intersects = this.raycaster.intersectObjects(allObjects, true)
    
    if (this.hoverObject) {
      this._setHoverEffect(this.hoverObject, false)
      this.hoverObject = null
    }
    
    if (intersects.length > 0) {
      let obj = intersects[0].object
      while (obj && !obj.userData?.type) {
        obj = obj.parent
      }
      if (obj?.userData?.type) {
        this.hoverObject = obj
        this._setHoverEffect(obj, true)
      }
    }
    
    if (this.heldStem) {
      document.body.style.cursor = 'grabbing'
    } else if (this.hoverObject) {
      document.body.style.cursor = 'pointer'
    } else {
      document.body.style.cursor = 'grab'
    }
  }
  
  _setHoverEffect(obj, hovered) {
    const type = obj.userData.type
    if (type === 'rackSlot' || type === 'flowerFoam') {
      if (obj.material && obj.material.emissive) {
        obj.material.emissive.setHex(hovered ? 0x333300 : 0x000000)
      }
    } else if (type === 'stem') {
      const stem = obj.userData.stem
      if (stem && stem.stemMesh && stem.stemMesh.material && stem.stemMesh.material.emissive) {
        stem.stemMesh.material.emissive.setHex(hovered ? 0x224422 : 0x000000)
      }
    }
  }
  
  _updateHeldStemPosition(event) {
    if (!this.heldStem) return
    
    const mouse = this.sceneManager.getMouseFromEvent(event)
    this.raycaster.setFromCamera(mouse, this.sceneManager.camera)
    
    const targetY = 1.0
    const planeNormal = new THREE.Vector3(0, 1, 0)
    const planePoint = new THREE.Vector3(0, targetY, 0)
    const plane = new THREE.Plane(planeNormal, -planePoint.dot(planeNormal))
    
    const intersectPoint = new THREE.Vector3()
    this.raycaster.ray.intersectPlane(plane, intersectPoint)
    
    if (intersectPoint) {
      const bodyY = intersectPoint.y + CONFIG.STEM_HEIGHT / 2
      this.heldStem.body.position.set(intersectPoint.x, bodyY, intersectPoint.z)
      this.heldStem.body.velocity.set(0, 0, 0)
      this.heldStem.body.angularVelocity.set(0, 0, 0)
      this.heldStem.body.quaternion.set(0, 0, 0, 1)
    }
  }
  
  _tryInsertOrDrop(event) {
    if (!this.heldStem) return
    
    const mouse = this.sceneManager.getMouseFromEvent(event)
    this.raycaster.setFromCamera(mouse, this.sceneManager.camera)
    
    if (this.flowerFoam.foamMesh) {
      const intersects = this.raycaster.intersectObject(this.flowerFoam.foamMesh, true)
      
      if (intersects.length > 0) {
        const hitPoint = intersects[0].point
        if (this.flowerFoam.tryInsert(this.heldStem, hitPoint)) {
          this.heldStem = null
          return
        }
      }
    }
    
    this._dropStem()
  }
  
  _tryInsertStem(event) {
    if (!this.heldStem) return
    
    const stemPos = this.heldStem.body.position.clone()
    stemPos.y -= CONFIG.STEM_HEIGHT / 2
    
    const foamTop = this.flowerFoam.getTopPosition()
    const dist = Math.sqrt(
      Math.pow(stemPos.x - foamTop.x, 2) +
      Math.pow(stemPos.z - foamTop.z, 2)
    )
    
    const insertRange = CONFIG.FOAM_RADIUS_TOP + 0.2
    
    if (dist < insertRange && stemPos.y > foamTop.y - 0.5) {
      if (this.flowerFoam.tryInsert(this.heldStem, foamTop)) {
        this.heldStem = null
        return
      }
    }
    
    this._dropStem()
  }
  
  _dropStem() {
    if (!this.heldStem) return
    
    this.heldStem.setHeld(false)
    this.heldStem.body.velocity.set(0, -1, 0)
    const dropped = this.heldStem
    this.heldStem = null
    
    setTimeout(() => {
      if (dropped && dropped.body) {
        dropped.body.wakeUp()
      }
    }, 50)
    
    this.uiManager.addFeedback('warning', '花茎已放下')
  }
  
  _onKeyDown(e) {
    if (this.gameState.stage === 2) {
      if (e.key === 'ArrowUp' || e.key === 'w' || e.key === 'W') {
        this.ribbonSystem.adjustForce(1)
      } else if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') {
        this.ribbonSystem.adjustForce(-1)
      }
    }
    
    if (e.key === 'r' || e.key === 'R') {
      this.uiManager._emit('reset')
    }
  }
  
  update() {
  }
}
